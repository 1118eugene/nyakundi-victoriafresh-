import express from 'express'
import { User } from '../models/index.js'

const router = express.Router()

// In-memory user database
const users = []

// POST register new user
router.post('/register', (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body

    // Check if user already exists
    if (users.some(u => u.email === email)) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      })
    }

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      password, // In production: hash with bcrypt
      role: 'customer'
    })

    const errors = newUser.validate()
    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      })
    }

    users.push(newUser)

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phone: newUser.phone
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// POST login user
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      })
    }

    const user = users.find(u => u.email === email)

    if (!user || user.password !== password) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'User account is inactive'
      })
    }

    // In production: Generate JWT token
    const token = `token-${user.id}-${Date.now()}`

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// GET user profile
router.get('/:id', (req, res) => {
  try {
    const user = users.find(u => u.id === req.params.id)

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      })
    }

    res.json({
      status: 'success',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        preferences: user.preferences,
        role: user.role,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// PUT update user profile
router.put('/:id', (req, res) => {
  try {
    const index = users.findIndex(u => u.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      })
    }

    const updatedUser = new User({
      ...users[index],
      ...req.body,
      id: users[index].id,
      createdAt: users[index].createdAt,
      role: users[index].role // Prevent role change via profile update
    })

    const errors = updatedUser.validate()
    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors
      })
    }

    users[index] = updatedUser

    res.json({
      status: 'success',
      message: 'User profile updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        address: updatedUser.address
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// PUT change password
router.put('/:id/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current and new password are required'
      })
    }

    const index = users.findIndex(u => u.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      })
    }

    if (users[index].password !== currentPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      })
    }

    users[index].password = newPassword
    users[index].updatedAt = new Date()

    res.json({
      status: 'success',
      message: 'Password changed successfully'
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

export default router
