import express from 'express'
import { Product } from '../models/index.js'

const router = express.Router()

// In-memory product database (for demo - replace with MongoDB)
const products = [
  // Fresh whole fish
  new Product({
    id: 'fw-1',
    name: 'Fresh Whole Tilapia',
    description: 'Premium fresh tilapia fish on ice, straight from Lake Victoria. Ready to cook.',
    price: 850,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&h=500&fit=crop',
    category: 'tilapia',
    quantity: 50,
    inStock: true,
  }),
  new Product({
    id: 'fw-2',
    name: 'Fresh Whole Nile Perch (Mbuta)',
    description: 'Large, fresh Nile perch with tender white flesh. Perfect for family meals.',
    price: 1500,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&h=500&fit=crop',
    category: 'samaki',
    quantity: 30,
    inStock: true,
  }),
  new Product({
    id: 'fw-3',
    name: 'Fresh Whole Catfish (Nduma)',
    description: 'Fresh catfish on ice, rich flavor perfect for soups and traditional dishes.',
    price: 950,
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&h=500&fit=crop',
    category: 'nduma',
    quantity: 40,
    inStock: true,
  }),
  // Fish fillets
  new Product({
    id: 'ff-1',
    name: 'Tilapia Fillets (1kg)',
    description: 'Boneless, skinless tilapia fillets. Ready to cook. Fresh and tender.',
    price: 1200,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop',
    category: 'tilapia',
    quantity: 25,
    inStock: true,
  }),
  // Smoked fish
  new Product({
    id: 'sf-1',
    name: 'Smoked Whole Tilapia',
    description: 'Traditionally smoked fresh tilapia. Ready to eat or reheat. Rich, smoky flavor.',
    price: 1100,
    image: 'https://images.unsplash.com/photo-1517457373614-b7152f800fd1?w=500&h=500&fit=crop',
    category: 'tilapia',
    quantity: 15,
    inStock: true,
  }),
  // Fried fish
  new Product({
    id: 'frd-1',
    name: 'Fried Tilapia (Ready to Eat)',
    description: 'Crispy fried tilapia, golden brown and delicious. Perfect for lunch or dinner.',
    price: 950,
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&h=500&fit=crop',
    category: 'tilapia',
    quantity: 20,
    inStock: true,
  }),
]

// GET all products with filtering and pagination
router.get('/', (req, res) => {
  try {
    const { category, skip = 0, limit = 10, search } = req.query

    let filtered = [...products]

    // Filter by category
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category)
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      )
    }

    // Pagination
    const start = parseInt(skip)
    const end = start + parseInt(limit)
    const paginatedProducts = filtered.slice(start, end)

    res.json({
      status: 'success',
      data: paginatedProducts,
      pagination: {
        total: filtered.length,
        skip: start,
        limit: parseInt(limit),
        returned: paginatedProducts.length
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// GET single product
router.get('/:id', (req, res) => {
  try {
    const product = products.find(p => p.id === req.params.id)

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      })
    }

    res.json({
      status: 'success',
      data: product
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// POST create new product (admin only)
router.post('/', (req, res) => {
  try {
    const newProduct = new Product(req.body)
    const errors = newProduct.validate()

    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      })
    }

    products.push(newProduct)

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: newProduct
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// PUT update product
router.put('/:id', (req, res) => {
  try {
    const index = products.findIndex(p => p.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      })
    }

    const updatedProduct = new Product({
      ...products[index],
      ...req.body,
      id: products[index].id,
      createdAt: products[index].createdAt
    })

    const errors = updatedProduct.validate()
    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      })
    }

    products[index] = updatedProduct

    res.json({
      status: 'success',
      message: 'Product updated successfully',
      data: updatedProduct
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// DELETE product
router.delete('/:id', (req, res) => {
  try {
    const index = products.findIndex(p => p.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      })
    }

    const deleted = products.splice(index, 1)

    res.json({
      status: 'success',
      message: 'Product deleted successfully',
      data: deleted[0]
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

export default router
