// Product Model
export class Product {
  constructor(data) {
    this.id = data.id || `prod-${Date.now()}`
    this.name = data.name
    this.description = data.description
    this.price = data.price
    this.category = data.category
    this.image = data.image
    this.inStock = data.inStock !== false
    this.quantity = data.quantity || 0
    this.sku = data.sku || `${data.category}-${this.id}`
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = new Date()
  }

  validate() {
    const errors = []
    
    if (!this.name || this.name.trim().length < 3) {
      errors.push('Product name must be at least 3 characters')
    }
    
    if (!this.description || this.description.trim().length < 10) {
      errors.push('Product description must be at least 10 characters')
    }
    
    if (!this.price || this.price < 0) {
      errors.push('Product price must be greater than 0')
    }
    
    if (!this.category) {
      errors.push('Product category is required')
    }
    
    return errors.length === 0 ? null : errors
  }
}

// Order Model
export class Order {
  constructor(data) {
    this.id = data.id || `ord-${Date.now()}`
    this.userId = data.userId
    this.items = data.items || []
    this.totalPrice = data.totalPrice || 0
    this.shippingAddress = data.shippingAddress || {}
    this.billingAddress = data.billingAddress || {}
    this.status = data.status || 'pending' // pending, confirmed, shipped, delivered, cancelled
    this.paymentMethod = data.paymentMethod || 'mpesa'
    this.paymentStatus = data.paymentStatus || 'pending' // pending, paid, failed
    this.notes = data.notes || ''
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = new Date()
  }

  validate() {
    const errors = []
    
    if (!this.userId) {
      errors.push('User ID is required')
    }
    
    if (!this.items || this.items.length === 0) {
      errors.push('Order must have at least one item')
    }
    
    if (!this.totalPrice || this.totalPrice < 0) {
      errors.push('Total price must be greater than 0')
    }
    
    if (!this.shippingAddress || !this.shippingAddress.address) {
      errors.push('Shipping address is required')
    }
    
    return errors.length === 0 ? null : errors
  }
}

// User Model
export class User {
  constructor(data) {
    this.id = data.id || `usr-${Date.now()}`
    this.firstName = data.firstName
    this.lastName = data.lastName
    this.email = data.email
    this.phone = data.phone
    this.password = data.password // Should be hashed in production
    this.role = data.role || 'customer' // customer, admin
    this.address = data.address || {}
    this.preferences = data.preferences || {}
    this.isActive = data.isActive !== false
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = new Date()
  }

  validate() {
    const errors = []
    
    if (!this.firstName || this.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters')
    }
    
    if (!this.lastName || this.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters')
    }
    
    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Valid email is required')
    }
    
    if (!this.phone || this.phone.trim().length < 10) {
      errors.push('Valid phone number is required')
    }
    
    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters')
    }
    
    return errors.length === 0 ? null : errors
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// Review Model
export class Review {
  constructor(data) {
    this.id = data.id || `rev-${Date.now()}`
    this.productId = data.productId
    this.userId = data.userId
    this.rating = data.rating || 5
    this.title = data.title
    this.comment = data.comment
    this.helpful = data.helpful || 0
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = new Date()
  }

  validate() {
    const errors = []
    
    if (!this.productId) {
      errors.push('Product ID is required')
    }
    
    if (!this.userId) {
      errors.push('User ID is required')
    }
    
    if (this.rating < 1 || this.rating > 5) {
      errors.push('Rating must be between 1 and 5')
    }
    
    if (!this.title || this.title.trim().length < 5) {
      errors.push('Review title must be at least 5 characters')
    }
    
    return errors.length === 0 ? null : errors
  }
}

// Cart Item Model
export class CartItem {
  constructor(data) {
    this.productId = data.productId
    this.quantity = data.quantity || 1
    this.price = data.price
    this.total = this.quantity * this.price
  }

  validate() {
    const errors = []
    
    if (!this.productId) {
      errors.push('Product ID is required')
    }
    
    if (this.quantity < 1) {
      errors.push('Quantity must be at least 1')
    }
    
    if (!this.price || this.price < 0) {
      errors.push('Price must be greater than 0')
    }
    
    return errors.length === 0 ? null : errors
  }
}

export default {
  Product,
  Order,
  User,
  Review,
  CartItem
}
