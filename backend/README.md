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
- PostgreSQL (the backend uses `DATABASE_URL` and the `pg` driver)

## Local development setup

1. **Install dependencies** (from the repository root):
```bash
npm install
npm --prefix backend install
```

2. **Configure environment variables**:
```bash
copy backend\.env.example backend\.env
# Edit backend\.env and replace DB_PASSWORD, DATABASE_URL, TEST_DATABASE_URL,
# AUTH_SECRET, and ADMIN_DASHBOARD_KEY with local values.
```

3. **Start PostgreSQL** from the repository root (Docker Desktop must be running):
```powershell
docker compose --env-file backend/.env up -d db
```

4. **Apply the schema and seed the catalogue**:
```powershell
cd backend
npm run db:setup
```

The API also validates the schema and syncs the verified catalogue on startup.
Catalogue sync inserts missing products and updates the verified product
details, but it does not delete products omitted from the current catalogue or
change existing products' activation and stock state. Integration tests read
`TEST_DATABASE_URL` from `backend/.env` and run against the separate
`victoria_fish_test` database.

### OTP delivery providers

Set `OTP_PROVIDER` to one of the following. Startup validates only the selected
provider's required credentials and prints their exact missing variable names.
OTP codes remain single-use, hashed in PostgreSQL, expire after
`OTP_EXPIRY_MINUTES`, and are rate-limited.

| `OTP_PROVIDER` | Required variables | Optional variables / setup |
| --- | --- | --- |
| `africastalking` | `SMS_API_KEY`, `SMS_USERNAME` | `SMS_SENDER_ID` is optional. If blank, the API request omits its `from` field. Use the Africa's Talking account username and API key from its dashboard. |
| `email` | `RESEND_API_KEY`, `OTP_EMAIL_FROM` | Create a Resend API key at https://resend.com/api-keys and verify the sender/domain used by `OTP_EMAIL_FROM`. Delivery uses Resend's HTTPS API, not SMTP. |
| `console` | No provider credentials | Development/test only. The server prints a loud warning and the OTP to its console; production startup rejects this provider. This is not real SMS/email delivery. |

For today's Africa's Talking route without sender-ID approval, set
`OTP_PROVIDER=africastalking`, `SMS_API_KEY`, and `SMS_USERNAME`, and leave
`SMS_SENDER_ID` empty. For email, set `OTP_PROVIDER=email`, `RESEND_API_KEY`,
and a Resend-verified `OTP_EMAIL_FROM`. API delivery failures include the
provider's HTTP status and response detail in the signup/login error response.

M-Pesa defaults to mock mode in development and Daraja mode in production.
Sandbox or live checkout requires the matching Daraja credentials and a public
HTTPS callback URL.

5. **Start both app services** from the repository root:
```bash
npm run dev
```

The frontend is available at `http://localhost:3000` and the API at
`http://localhost:5000`.

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
2. Set `DATABASE_URL` to a managed PostgreSQL instance
3. Configure the production SMS provider and M-Pesa callback URL
4. Run `npm run build` and `npm test`
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

1. **Database Operations**
   - Extend the versioned startup migrations as the schema evolves
   - Indexing and query performance monitoring

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
