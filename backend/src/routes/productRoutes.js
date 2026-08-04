import express from 'express'
import Product from '../models/Product.js'
import { categoryLabels } from '../data/catalog.js'
import { config } from '../config/index.js'

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    const { category, featured, search, skip = 0, limit = config.defaultLimit } = req.query
    const filters = {}

    if (category && category !== 'all') {
      filters.category = category
    }

    if (featured === 'true') {
      filters.featured = true
    }

    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { species: { $regex: search, $options: 'i' } },
        { preparation: { $regex: search, $options: 'i' } },
      ]
    }

    const safeLimit = Math.min(Number(limit) || config.defaultLimit, config.maxLimit)
    const safeSkip = Number(skip) || 0
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
    const product = await Product.findById(req.params.id)

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
