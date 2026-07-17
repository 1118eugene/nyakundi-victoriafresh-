import express from 'express'
import { Order } from '../models/index.js'

const router = express.Router()

// In-memory order database
const orders = []

// GET all orders (for admin)
router.get('/', (req, res) => {
  try {
    const { status, skip = 0, limit = 10, userId } = req.query

    let filtered = [...orders]

    // Filter by status
    if (status) {
      filtered = filtered.filter(o => o.status === status)
    }

    // Filter by user
    if (userId) {
      filtered = filtered.filter(o => o.userId === userId)
    }

    // Pagination
    const start = parseInt(skip)
    const end = start + parseInt(limit)
    const paginatedOrders = filtered.slice(start, end)

    res.json({
      status: 'success',
      data: paginatedOrders,
      pagination: {
        total: filtered.length,
        skip: start,
        limit: parseInt(limit),
        returned: paginatedOrders.length
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// GET single order
router.get('/:id', (req, res) => {
  try {
    const order = orders.find(o => o.id === req.params.id)

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      })
    }

    res.json({
      status: 'success',
      data: order
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// POST create new order
router.post('/', (req, res) => {
  try {
    const newOrder = new Order(req.body)
    const errors = newOrder.validate()

    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      })
    }

    orders.push(newOrder)

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: newOrder
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// PUT update order status
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status',
        validStatuses
      })
    }

    const index = orders.findIndex(o => o.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      })
    }

    orders[index].status = status
    orders[index].updatedAt = new Date()

    res.json({
      status: 'success',
      message: 'Order status updated successfully',
      data: orders[index]
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// PUT update payment status
router.put('/:id/payment', (req, res) => {
  try {
    const { paymentStatus } = req.body
    const validStatuses = ['pending', 'paid', 'failed']

    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment status',
        validStatuses
      })
    }

    const index = orders.findIndex(o => o.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      })
    }

    orders[index].paymentStatus = paymentStatus
    orders[index].updatedAt = new Date()

    res.json({
      status: 'success',
      message: 'Payment status updated successfully',
      data: orders[index]
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// DELETE order (cancel)
router.delete('/:id', (req, res) => {
  try {
    const index = orders.findIndex(o => o.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      })
    }

    const cancelled = orders[index]
    cancelled.status = 'cancelled'
    cancelled.updatedAt = new Date()

    res.json({
      status: 'success',
      message: 'Order cancelled successfully',
      data: cancelled
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

export default router
