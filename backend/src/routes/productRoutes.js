import express from 'express'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import { categoryLabels } from '../data/catalog.js'
import { config } from '../config/index.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { category, featured, search, skip = 0, limit = config.defaultLimit } = req.query
    // Retired products can remain in MongoDB for historic order records, but
    // must never appear in the customer-facing catalogue.
    const filters = { active: true, inStock: true, quantity: { $gt: 0 } }

    if (category && category !== 'all') {
      filters.category = category
    }

    if (featured === 'true') {
      filters.featured = true
    }

    if (search) {
      const safeSearch = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filters.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { species: { $regex: safeSearch, $options: 'i' } },
        { preparation: { $regex: safeSearch, $options: 'i' } },
      ]
    }

    const safeLimit = Math.min(Math.max(Number(limit) || config.defaultLimit, 1), config.maxLimit)
    const safeSkip = Math.max(Number(skip) || 0, 0)
    const [data, total] = await Promise.all([
      Product.find(filters).sort({ featured: -1, name: 1 }).skip(safeSkip).limit(safeLimit),
      Product.countDocuments(filters),
    ])

    res.json({
      status: 'success',
      data,
      filters: {
        categories: categoryLabels,
      },
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

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product ID.' })
    }
    const product = await Product.findOne({ _id: req.params.id, active: true, inStock: true, quantity: { $gt: 0 } })

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found',
      })
    }

    res.json({
      status: 'success',
      data: product,
    })
  } catch (error) {
    next(error)
  }
})

export default router
