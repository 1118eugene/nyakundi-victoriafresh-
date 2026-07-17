# Victoria Fresh Fish Kenya - Backend API

Professional Node.js/Express backend API for the Victoria Fresh Fish Kenya e-commerce platform.

## 🚀 Features

- **Product Management** - Complete CRUD operations for products
- **Order Management** - Create, update, and track orders
- **User Authentication** - User registration and login
- **User Profiles** - User profile management
- **Input Validation** - Comprehensive data validation
- **Error Handling** - Centralized error handling
- **CORS Support** - Cross-origin request support
- **RESTful API** - Clean REST API endpoints

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn
- MongoDB (optional - currently uses in-memory storage for demo)

## 🛠️ Installation

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Setup Environment Variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Development Server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Health Check
```
GET /health
```

---

## Products Endpoints

### Get All Products
```
GET /products
Query Parameters:
- category: Filter by product category
- search: Search products by name or description
- skip: Pagination offset (default: 0)
- limit: Number of results (default: 10)

Example: GET /products?category=tilapia&limit=20
```

### Get Single Product
```
GET /products/:id
```

### Create Product (Admin)
```
POST /products
Body:
{
  "name": "Fresh Tilapia",
  "description": "Premium fresh tilapia fish on ice",
  "price": 850,
  "category": "tilapia",
  "image": "https://...",
  "quantity": 50
}
```

### Update Product
```
PUT /products/:id
Body: Same as Create
```

### Delete Product
```
DELETE /products/:id
```

---

## Orders Endpoints

### Get All Orders
```
GET /orders
Query Parameters:
- status: Filter by order status (pending, confirmed, shipped, delivered, cancelled)
- userId: Filter by user ID
- skip: Pagination offset (default: 0)
- limit: Number of results (default: 10)
```

### Get Single Order
```
GET /orders/:id
```

### Create Order
```
POST /orders
Body:
{
  "userId": "usr-123",
  "items": [
    {
      "productId": "fw-1",
      "quantity": 2,
      "price": 850
    }
  ],
  "totalPrice": 1700,
  "shippingAddress": {
    "address": "123 Main St",
    "city": "Nairobi",
    "zipCode": "00100",
    "country": "Kenya"
  },
  "paymentMethod": "mpesa"
}
```

### Update Order Status
```
PUT /orders/:id/status
Body:
{
  "status": "shipped"
}

Valid statuses: pending, confirmed, shipped, delivered, cancelled
```

### Update Payment Status
```
PUT /orders/:id/payment
Body:
{
  "paymentStatus": "paid"
}

Valid statuses: pending, paid, failed
```

### Cancel Order
```
DELETE /orders/:id
```

---

## Users Endpoints

### Register User
```
POST /users/register
Body:
{
  "firstName": "Moses",
  "lastName": "Nyakundi",
  "email": "moses@example.com",
  "phone": "0712345678",
  "password": "SecurePassword123"
}
```

### Login User
```
POST /users/login
Body:
{
  "email": "moses@example.com",
  "password": "SecurePassword123"
}

Returns: token, user object
```

### Get User Profile
```
GET /users/:id
```

### Update User Profile
```
PUT /users/:id
Body:
{
  "firstName": "Moses",
  "lastName": "Nyakundi",
  "phone": "0712345678",
  "address": {
    "street": "123 Main St",
    "city": "Nairobi",
    "zipCode": "00100"
  }
}
```

### Change Password
```
PUT /users/:id/password
Body:
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

---

## Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "errors": [ /* validation errors if any */ ]
}
```

### Paginated Response
```json
{
  "status": "success",
  "data": [ /* array of items */ ],
  "pagination": {
    "total": 50,
    "skip": 0,
    "limit": 10,
    "returned": 10
  }
}
```

---

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── index.js              # Main server file
│   ├── models/
│   │   └── index.js          # Data models (Product, Order, User, etc.)
│   ├── routes/
│   │   ├── productRoutes.js  # Product endpoints
│   │   ├── orderRoutes.js    # Order endpoints
│   │   └── userRoutes.js     # User endpoints
│   ├── controllers/          # Business logic (to be implemented)
│   ├── middleware/           # Custom middleware (to be implemented)
│   └── config/
│       └── index.js          # Configuration
├── package.json
├── .env.example              # Environment template
└── README.md                 # This file
```

---

## 🔄 Data Models

### Product
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  category: string,
  image: string,
  quantity: number,
  inStock: boolean,
  sku: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Order
```javascript
{
  id: string,
  userId: string,
  items: CartItem[],
  totalPrice: number,
  shippingAddress: object,
  billingAddress: object,
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled',
  paymentMethod: string,
  paymentStatus: 'pending' | 'paid' | 'failed',
  notes: string,
  createdAt: Date,
  updatedAt: Date
}
```

### User
```javascript
{
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  password: string (hashed in production),
  role: 'customer' | 'admin',
  address: object,
  preferences: object,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Deployment

### Before Production
1. Change all default secrets and keys in `.env`
2. Implement MongoDB connection
3. Add JWT authentication middleware
4. Hash passwords with bcrypt
5. Add input sanitization
6. Enable HTTPS
7. Add rate limiting
8. Implement logging
9. Add error tracking (Sentry)
10. Setup monitoring

### Deploy to:
- **Render** - Easy Node.js deployment
- **Railway** - Modern platform
- **Heroku** - PaaS platform
- **AWS** - Scalable cloud infrastructure
- **DigitalOcean** - VPS option

---

## 🔒 Security Checklist

- [ ] Hash passwords with bcrypt
- [ ] Implement JWT authentication
- [ ] Add CORS whitelist
- [ ] Rate limiting on API endpoints
- [ ] Input validation and sanitization
- [ ] SQL injection prevention (if using SQL)
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Helmet.js for HTTP headers
- [ ] Environment variables (no hardcoded secrets)
- [ ] HTTPS only in production

---

## 📝 Future Enhancements

1. **Database Integration**
   - MongoDB with Mongoose
   - Database migrations
   - Indexing optimization

2. **Authentication & Authorization**
   - JWT tokens
   - Role-based access control (RBAC)
   - Email verification
   - Password reset flow

3. **Payment Integration**
   - M-Pesa integration
   - PayPal integration
   - Stripe integration

4. **Advanced Features**
   - Reviews and ratings
   - Wishlist functionality
   - Inventory management
   - Analytics and reporting
   - Admin dashboard
   - Email notifications
   - SMS notifications

5. **Performance**
   - Caching (Redis)
   - Database query optimization
   - API response compression
   - CDN for static assets

---

## 🤝 Support

For issues or questions, please contact the development team.

---

**Built with ❤️ for Victoria Fresh Fish Kenya**
