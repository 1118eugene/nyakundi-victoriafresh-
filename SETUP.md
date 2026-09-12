# Victoria Fresh Fish Kenya - Full Stack Setup Guide

Complete guide to run both frontend and backend of the Victoria Fresh Fish Kenya e-commerce platform.

## 📁 Project Structure

```
nyakundi/
├── src/                    # Frontend React app
├── package.json           # Frontend dependencies
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
├── index.html             # HTML entry point
│
└── backend/               # Backend Node.js API
    ├── src/               # Backend source code
    │   ├── index.js       # Main server file
    │   ├── models/        # Data models
    │   ├── routes/        # API routes
    │   ├── controllers/   # Business logic
    │   ├── middleware/    # Custom middleware
    │   └── config/        # Configuration
    ├── package.json       # Backend dependencies
    ├── .env.example       # Environment template
    └── README.md          # Backend documentation
```

## 🚀 Quick Start (Full Stack)

### 1. **Frontend Setup** (React + Vite + TypeScript)

In the root directory:

```bash
# Navigate to project root
cd c:\Users\Eugene\Desktop\nyakundi

# Install frontend dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Frontend will run on: **http://localhost:3000**

### 2. **Backend Setup** (Node.js + Express)

In a new terminal:

```bash
# Navigate to backend folder
cd c:\Users\Eugene\Desktop\nyakundi\backend

# Install backend dependencies (if not already done)
npm install

# Copy environment file
copy .env.example .env

# Start backend server
node src/index.js
```

Backend will run on: **http://localhost:5000**

---

## 🌐 Testing the APIs

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Get All Products
```bash
curl http://localhost:5000/api/products
```

### Create Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fresh Tilapia",
    "description": "Premium fresh tilapia from Lake Victoria",
    "price": 850,
    "category": "tilapia",
    "quantity": 50
  }'
```

---

## 📝 Environment Setup

### Backend Environment (.env)

Create `.env` file in `backend/` folder:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/victoria_fresh_fish
AUTH_SECRET=dev-secret-key-change-in-production
```

---

## ✨ Features

### Frontend
✅ Professional responsive design
✅ Product catalog with filtering
✅ Founder section with photos
✅ Enhanced typography for readability
✅ Multiple product categories (Fresh, Fillets, Smoked, Fried, Cooked)
✅ Professional logo component
✅ Smooth animations
✅ Mobile-friendly

### Backend
✅ RESTful API with PostgreSQL and UUID IDs
✅ Product management (CRUD)
✅ Order management
✅ User authentication
✅ Validation & error handling
✅ CORS enabled
✅ Pagination support
✅ Search & filter capabilities
✅ Transactional checkout and inventory reservations

---

## 🛠️ Development Commands

### Frontend Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Commands
```bash
node src/index.js    # Start server
npm run dev          # Start with nodemon (auto-reload)
npm run build        # Build command (placeholder)
```

---

## 🔌 API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id/payment` - Update payment status
- `DELETE /api/orders/:id` - Cancel order

### Users
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `PUT /api/users/:id/password` - Change password

---

## 📊 Current Status

### Frontend ✅ COMPLETE
- Modern React app with TypeScript
- Professional design system
- Responsive on all devices
- Optimized with Vite
- All pages implemented:
  - Home (hero, features, products, stats)
  - Products (with filtering)
  - About (with founders section)
- Build size: ~260KB uncompressed, ~80KB gzipped

### Backend ✅ COMPLETE
- Express.js API server
- All core endpoints implemented
- Data models defined
- Ready for PostgreSQL integration
- API documentation provided

---

## 🔄 Integration

Frontend automatically sends requests to backend:
```
Frontend http://localhost:3000
    ↓
Backend http://localhost:5000
```

---

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

---

## 🎨 Design System

### Colors
- **Primary**: #1e5a96 (Professional Blue)
- **Accent**: #00a86b (Fresh Green)
- **Background**: #f8f9fa

### Typography
- Enhanced font sizes for readability
- Improved line heights (1.6 - 1.8)
- Letter spacing for clarity

---

## 🚀 Next Steps

### Phase 1: Database Integration (complete)
1. Install PostgreSQL locally or use a managed PostgreSQL provider
2. Set `DATABASE_URL`; the backend applies its schema and catalog seed on startup
3. Use the transactional checkout and inventory reservation flows

### Phase 2: Authentication
1. Implement JWT tokens
2. Add password hashing (bcrypt)
3. Role-based access control

### Phase 3: Payment Integration
1. M-Pesa integration
2. PayPal integration
3. Order confirmation emails

### Phase 4: Production Deployment
1. Deploy frontend to Vercel/Netlify
2. Deploy backend to Render/Railway
3. Setup CI/CD pipeline
4. Configure monitoring & logging

---

## 🔒 Security Checklist

Before production deployment:
- [ ] Change all default secrets
- [ ] Enable HTTPS
- [ ] Implement rate limiting
- [ ] Add input validation
- [ ] Hash passwords
- [ ] Setup CORS whitelist
- [ ] Add logging
- [ ] Enable monitoring

---

## 📚 Documentation

- **Frontend**: See README.md in root directory
- **Backend**: See `backend/README.md` for API documentation

---

## 🤝 Team

- **Moses Odiwuor Nyakundi** - Founder & CEO
- **David Odhiambo** - Co-Founder & Operations Lead

---

## 📞 Support

For technical questions or issues, refer to the comprehensive documentation in each folder.

---

**Built with ❤️ for Victoria Fresh Fish Kenya**
