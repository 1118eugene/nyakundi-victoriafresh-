import crypto from 'node:crypto'
import express from 'express'
import { config, getMpesaConfigurationStatus } from '../config/index.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { extractMpesaReceipt, initiateStkPush, isMpesaConfigured } from '../services/mpesa.js'

const router = express.Router()

function createOrderNumber() {
  const date = new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const random = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `VFF-${y}${m}${d}-${random}`
}

function calculateShippingFee(county) {
  const normalized = county.trim().toLowerCase()
  if (['kisumu', 'siaya', 'homa bay', 'migori', 'kisii'].includes(normalized)) {
    return 250
  }

  if (['nairobi', 'nakuru', 'uasin gishu', 'mombasa'].includes(normalized)) {
    return 450
  }

  return 650
}

function requireAdminKey(req) {
  return Boolean(config.adminDashboardKey && req.get('x-admin-key') === config.adminDashboardKey)
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
        { _id: item.productId, inStock: true, quantity: { $gte: item.quantity } },
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
  if (!order.inventoryReserved) return
  await releaseInventory(order.items)
  order.inventoryReserved = false
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
      callbackReady: readiness.callbackReady,
      missing: readiness.missing,
      mpesaBaseUrl: configured ? config.mpesaBaseUrl : null,
      mpesaShortcode: configured ? config.mpesaShortcode : null,
      mpesaCallbackUrl: configured ? config.mpesaCallbackUrl : null,
    },
    message: configured ? 'M-Pesa is ready to receive payment callbacks.' : 'M-Pesa is not ready for live payment callbacks.',
  })
})

router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select('+trackingToken')

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      })
    }

    const isAdmin = config.adminDashboardKey && requireAdminKey(req)
    if (!isAdmin && (!req.query.token || req.query.token !== order.trackingToken)) {
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

router.post('/checkout', async (req, res, next) => {
  try {
    if (!isMpesaConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'M-Pesa checkout is unavailable until the server has valid credentials and a public HTTPS callback URL.',
      })
    }

    const {
      customerName,
      email,
      phone,
      paymentPhone,
      county,
      town,
      addressLine,
      landmark,
      notes,
      items,
    } = req.body

    if (!customerName || !email || !phone || !county || !town || !addressLine) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer name, email, phone, county, town, and address are required',
      })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cart items are required',
      })
    }

    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\+?(?:254|0)7\d{8}$/.test(paymentPhone || phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Enter a valid email address and Kenyan M-Pesa phone number.',
      })
    }

    const ids = [...new Set(items.map((item) => item.productId))]
    const products = await Product.find({ _id: { $in: ids } })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const orderItems = []
    let subtotal = 0

    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'One or more products are no longer available',
        })
      }

      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Each cart item must have a quantity of at least 1',
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
        trackingToken,
        inventoryReserved: true,
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
          phone: paymentPhone || phone,
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
      await order.save()

      return res.status(201).json({
        status: 'success',
        message: 'Order created and M-Pesa prompt sent successfully.',
        data: order,
        payment: {
          configured: true,
          status: 'initiated',
          trackingToken,
          customerMessage: stkResponse.CustomerMessage || stkResponse.ResponseDescription || '',
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
      order.paymentStatus = 'paid'
      order.status = 'confirmed'
      order.mpesa.receiptNumber = receipt.receiptNumber
      order.mpesa.paidAt = receipt.paidAt || new Date()
      order.mpesa.phone = receipt.phone || order.mpesa.phone
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

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true })

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found',
      })
    }

    res.json({
      status: 'success',
      data: order,
    })
  } catch (error) {
    next(error)
  }
})

export default router
