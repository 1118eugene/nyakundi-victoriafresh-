import crypto from 'node:crypto'
import mongoose from 'mongoose'
import express from 'express'
import { config, getMpesaConfigurationStatus } from '../config/index.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { calculateShippingFee } from '../lib/orderUtils.js'
import { getInventoryExpiry } from '../lib/inventoryUtils.js'
import { normalizePhone, validateSuccessfulPayment } from '../lib/paymentUtils.js'
import { extractMpesaReceipt, initiateStkPush, isMpesaConfigured } from '../services/mpesa.js'
import { requireCustomer } from '../middleware/auth.js'

const router = express.Router()

function createOrderNumber() {
  const date = new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const random = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `VFF-${y}${m}${d}-${random}`
}

function requireAdminKey(req) {
  const candidate = Buffer.from(req.get('x-admin-key') || '')
  const expected = Buffer.from(config.adminDashboardKey || '')
  return Boolean(expected.length > 0 && candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected))
}

function requireConfiguredAdminKey(req, res) {
  if (!config.adminDashboardKey) {
    res.status(503).json({ status: 'error', message: 'Admin access is not configured on this server' })
    return false
  }

  if (!requireAdminKey(req)) {
    res.status(401).json({ status: 'error', message: 'Admin access key required' })
    return false
  }

  return true
}

async function reserveInventory(items) {
  const reserved = []

  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, active: true, inStock: true, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { new: true },
      )

      if (!product) {
        const error = new Error(`${item.name} is no longer available in the requested quantity`)
        error.status = 409
        throw error
      }

      reserved.push(item)
    }

    return reserved
  } catch (error) {
    await releaseInventory(reserved)
    throw error
  }
}

async function releaseInventory(items) {
  await Promise.all(items.map((item) => Product.updateOne(
    { _id: item.productId },
    { $inc: { quantity: item.quantity } },
  )))
}

async function releaseOrderInventory(order) {
  const claimedOrder = await Order.findOneAndUpdate(
    { _id: order._id, inventoryReserved: true, paymentStatus: { $in: ['pending', 'initiated'] } },
    { $set: { inventoryReserved: false, inventoryExpiresAt: null } },
    { new: true },
  )
  if (!claimedOrder) return
  await releaseInventory(claimedOrder.items)
  order.inventoryReserved = false
  order.inventoryExpiresAt = null
}

router.get('/', async (req, res, next) => {
  try {
    const { status, paymentStatus, phone, skip = 0, limit = config.defaultLimit } = req.query
    const filters = {}

    if (!requireConfiguredAdminKey(req, res)) return

    if (status) {
      filters.status = status
    }

    if (paymentStatus) {
      filters.paymentStatus = paymentStatus
    }

    if (phone) {
      filters['customer.phone'] = phone
    }

    const safeLimit = Math.min(Number(limit) || config.defaultLimit, config.maxLimit)
    const safeSkip = Number(skip) || 0
    const [data, total] = await Promise.all([
      Order.find(filters).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit),
      Order.countDocuments(filters),
    ])

    res.json({
      status: 'success',
      data,
      pagination: {
        total,
        skip: safeSkip,
        limit: safeLimit,
        returned: data.length,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/mpesa/status', async (_req, res) => {
  const readiness = getMpesaConfigurationStatus()
  const configured = readiness.configured
  res.json({
    status: 'success',
    data: {
      configured,
      mode: readiness.mode,
      callbackReady: readiness.callbackReady,
      missing: readiness.missing,
      mpesaBaseUrl: configured ? config.mpesaBaseUrl : null,
      mpesaShortcode: configured ? config.mpesaShortcode : null,
      mpesaCallbackUrl: configured ? config.mpesaCallbackUrl : null,
    },
    message: configured ? 'M-Pesa is ready to receive payment callbacks.' : 'M-Pesa is not ready for live payment callbacks.',
  })
})

router.get('/my-orders', requireCustomer, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, config.maxLimit)
      : config.defaultLimit
    const data = await Order.find({ $or: [{ customerId: req.customer._id }, { userId: req.customer._id }] }).sort({ createdAt: -1 }).limit(limit)
    res.json({ status: 'success', data, pagination: { limit, returned: data.length } })
  } catch (error) {
    next(error)
  }
})

router.get('/mine', requireCustomer, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, config.maxLimit)
      : config.defaultLimit
    const data = await Order.find({ $or: [{ customerId: req.customer._id }, { userId: req.customer._id }] }).sort({ createdAt: -1 }).limit(limit)
    res.json({ status: 'success', data, pagination: { limit, returned: data.length } })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    }
    const order = await Order.findById(req.params.id).select('+trackingToken')

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      })
    }

    const isAdmin = config.adminDashboardKey && requireAdminKey(req)
    if (!isAdmin && req.get('x-order-token') !== order.trackingToken) {
      return res.status(401).json({ status: 'error', message: 'Order tracking token required' })
    }

    res.json({
      status: 'success',
      data: order,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/checkout', requireCustomer, async (req, res, next) => {
  try {
    if (!isMpesaConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'M-Pesa checkout is unavailable until the server has valid credentials and a public HTTPS callback URL.',
      })
    }

    const { paymentPhone, county, town, addressLine, landmark, notes, items } = req.body
    const customerName = req.customer.customerName
    const email = req.customer.email
    const phone = req.customer.phone

    if (!county || !town || !addressLine) {
      return res.status(400).json({
        status: 'error',
        message: 'County, town, and address are required',
      })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cart items are required',
      })
    }

    const normalizedPaymentPhone = normalizePhone(paymentPhone || phone)
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^2547\d{8}$/.test(normalizedPaymentPhone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Enter a valid email address and Kenyan M-Pesa phone number.',
      })
    }

    const quantities = new Map()
    for (const item of items) {
      if (!mongoose.isValidObjectId(item.productId)) {
        return res.status(400).json({ status: 'error', message: 'Each cart item must use a valid product ID.' })
      }
      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ status: 'error', message: 'Each cart quantity must be an integer between 1 and 100.' })
      }
      const totalQuantity = (quantities.get(item.productId) || 0) + quantity
      if (totalQuantity > 100) {
        return res.status(400).json({ status: 'error', message: 'The total quantity for a product cannot exceed 100.' })
      }
      quantities.set(item.productId, totalQuantity)
    }
    const ids = [...quantities.keys()]
    const products = await Product.find({ _id: { $in: ids }, active: true, inStock: true })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const orderItems = []
    let subtotal = 0

    for (const [productId, quantity] of quantities) {
      const product = productMap.get(productId)
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'One or more products are no longer available',
        })
      }

      if (product.quantity < quantity) {
        return res.status(400).json({
          status: 'error',
          message: `${product.name} only has ${product.quantity} unit(s) available right now`,
        })
      }

      const lineTotal = product.price * quantity
      subtotal += lineTotal
      orderItems.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        price: product.price,
        quantity,
        lineTotal,
        image: product.image,
      })
    }

    const shippingFee = calculateShippingFee(county)
    const totalPrice = subtotal + shippingFee
    const reservedItems = await reserveInventory(orderItems)
    const trackingToken = crypto.randomBytes(24).toString('hex')
    let order

    try {
      order = await Order.create({
        orderNumber: createOrderNumber(),
        userId: req.customer._id,
        customerId: req.customer._id,
        trackingToken,
        inventoryReserved: true,
        inventoryExpiresAt: getInventoryExpiry(),
        customer: {
          name: customerName,
          email,
          phone,
        },
        delivery: {
          county,
          town,
          addressLine,
          landmark: landmark || '',
          notes: notes || '',
        },
        items: orderItems,
        subtotal,
        shippingFee,
        totalPrice,
        mpesa: {
          phone: normalizedPaymentPhone,
        },
      })
    } catch (error) {
      await releaseInventory(reservedItems)
      throw error
    }

    try {
      const stkResponse = await initiateStkPush({
        phone: paymentPhone || phone,
        amount: totalPrice,
        orderNumber: order.orderNumber,
        description: `Fish order ${order.orderNumber}`,
      })

      order.paymentStatus = 'initiated'
      order.mpesa.phone = stkResponse.normalizedPhone
      order.mpesa.merchantRequestID = stkResponse.MerchantRequestID || ''
      order.mpesa.checkoutRequestID = stkResponse.CheckoutRequestID || ''
      order.mpesa.resultDescription = stkResponse.ResponseDescription || ''
      order.mpesa.requestedAt = stkResponse.requestedAt

      if (config.mpesaMode === 'mock') {
        order.paymentStatus = 'paid'
        order.status = 'confirmed'
        order.inventoryExpiresAt = null
        order.mpesa.resultCode = 0
        order.mpesa.receiptNumber = stkResponse.mockReceiptNumber
        order.mpesa.paidAt = new Date()
      }

      await order.save()

      return res.status(201).json({
        status: 'success',
        message: 'Order created and M-Pesa prompt sent successfully.',
        data: order,
        payment: {
          configured: true,
          status: config.mpesaMode === 'mock' ? 'paid' : 'initiated',
          trackingToken,
          customerMessage: stkResponse.CustomerMessage || stkResponse.ResponseDescription || '',
          mode: config.mpesaMode,
        },
      })
    } catch (paymentError) {
      await releaseOrderInventory(order)
      order.paymentStatus = 'failed'
      order.mpesa.resultDescription = paymentError.message
      await order.save()

      return res.status(paymentError.status || 502).json({
        status: 'error',
        message: paymentError.message,
        data: order,
        payment: {
          configured: true,
          status: 'failed',
          customerMessage: paymentError.message,
        },
      })
    }
  } catch (error) {
    next(error)
  }
})

router.post('/mpesa/callback', async (req, res, next) => {
  try {
    const callback = req.body?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) {
      return res.status(400).json({
        ResultCode: 1,
        ResultDesc: 'Invalid callback payload',
      })
    }

    if (!config.mpesaCallbackSecret || req.query.secret !== config.mpesaCallbackSecret) {
      return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized callback' })
    }

    const order = await Order.findOne({ 'mpesa.checkoutRequestID': callback.CheckoutRequestID }).select('+trackingToken')
    if (!order) {
      return res.status(404).json({
        ResultCode: 1,
        ResultDesc: 'Order not found',
      })
    }

    if (order.paymentStatus === 'paid' || order.paymentStatus === 'failed') {
      return res.json({ ResultCode: 0, ResultDesc: 'Callback already processed' })
    }

    const metadata = callback.CallbackMetadata?.Item || []
    const receipt = extractMpesaReceipt(metadata)

    order.mpesa.callbackPayload = callback
    order.mpesa.resultCode = callback.ResultCode
    order.mpesa.resultDescription = callback.ResultDesc || ''

    if (callback.ResultCode === 0) {
      if (!validateSuccessfulPayment({ receipt, expectedAmount: order.totalPrice, expectedPhone: order.mpesa.phone })) {
        order.mpesa.resultDescription = 'Payment verification failed: amount, receipt, or phone did not match the order.'
        await order.save()
        return res.status(422).json({ ResultCode: 1, ResultDesc: 'Payment verification failed' })
      }

      const paidOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: 'initiated',
          inventoryReserved: true,
          inventoryExpiresAt: { $gt: new Date() },
        },
        {
          $set: {
            paymentStatus: 'paid',
            status: 'confirmed',
            inventoryExpiresAt: null,
            'mpesa.callbackPayload': callback,
            'mpesa.resultCode': callback.ResultCode,
            'mpesa.resultDescription': callback.ResultDesc || '',
            'mpesa.receiptNumber': receipt.receiptNumber,
            'mpesa.paidAt': receipt.paidAt || new Date(),
            'mpesa.phone': receipt.phone || order.mpesa.phone,
          },
        },
        { new: true },
      )

      if (!paidOrder) {
        return res.status(409).json({ ResultCode: 1, ResultDesc: 'Order payment is expired or already being processed' })
      }

      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    } else {
      await releaseOrderInventory(order)
      order.paymentStatus = 'failed'
    }

    await order.save()

    res.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!requireConfiguredAdminKey(req, res)) return

    const { status } = req.body
    const validStatuses = ['awaiting_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status supplied',
      })
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid order ID.' })
    }
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      })
    }

    const allowedTransitions = {
      awaiting_payment: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered'],
      delivered: [],
      cancelled: [],
    }

    if (status !== order.status && !allowedTransitions[order.status].includes(status)) {
      return res.status(409).json({
        status: 'error',
        message: `Cannot move an order from ${order.status} to ${status}`,
      })
    }

    if (status === 'confirmed' && order.paymentStatus !== 'paid') {
      return res.status(409).json({
        status: 'error',
        message: 'An order can only be confirmed after payment is received',
      })
    }

    if (status === 'cancelled' && order.paymentStatus === 'paid') {
      return res.status(409).json({
        status: 'error',
        message: 'Paid orders require an explicit refund process before cancellation.',
      })
    }

    if (status === 'cancelled' && order.paymentStatus !== 'paid') {
      await releaseOrderInventory(order)
    }

    order.status = status
    await order.save()

    res.json({
      status: 'success',
      data: order,
    })
  } catch (error) {
    next(error)
  }
})

export default router
