# Victoria Fresh Fish Kenya 🐟

A professional e-commerce website for Victoria Fresh Fish Kenya - showcasing premium fresh fish products from Lake Victoria.

## 🚀 Features

- **Professional Homepage** with hero section and featured products
- **Complete Product Catalog** with filtering by category
- **About Page** with company story and values
- **Responsive Design** that works on all devices
- **Modern UI/UX** with smooth animations and transitions
- **Fast Performance** optimized with Vite

## 📁 Project Structure

```
src/
├── components/           # Reusable React components
│   ├── Header.tsx       # Navigation header
│   ├── Header.css
│   ├── Footer.tsx       # Footer component
│   ├── Footer.css
│   ├── ProductCard.tsx  # Product card component
│   └── ProductCard.css
├── pages/               # Page components
│   ├── Home.tsx         # Homepage
│   ├── Home.css
│   ├── Products.tsx     # Products page with filtering
│   ├── Products.css
│   ├── About.tsx        # About page
│   └── About.css
├── styles/              # Global styles
│   └── globals.css      # CSS variables and base styles
├── types/               # TypeScript type definitions
│   └── index.ts
├── hooks/               # Custom React hooks
├── assets/              # Images and media
│   └── images/
├── App.tsx              # Main app component
├── App.css
├── main.tsx             # Entry point
├── index.css
└── vite-env.d.ts        # Vite environment types
```

## 🎨 Design System

### Colors
- **Primary**: #1e5a96 (Professional Blue)
- **Accent**: #00a86b (Fresh Green)
- **Light Background**: #f8f9fa
- **Text**: #1a1a1a

### Typography
- Font Family: System fonts (-apple-system, Segoe UI, etc.)
- Responsive sizing from small to extra-large

### Components
- Reusable buttons with variants (primary, secondary, outline)
- Professional product cards with hover effects
- Sticky navigation header
- Responsive footer with links

## 🛠️ Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
The site will open at `http://localhost:3000` with hot reload enabled.

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 📦 Technologies Used

- **React 19.2** - UI library
- **TypeScript** - Type safety
- **Vite 8.1** - Build tool & dev server
- **React Router DOM** - Client-side routing
- **CSS3** - Professional styling with variables and animations

## ✅ Current application architecture

- React storefront with product catalogue, cart, checkout, delivery pages, FAQ,
  wholesale information, and contact pages.
- Express and PostgreSQL backend in `backend/`.
- Server-side product prices, stock checks, inventory reservation, and order snapshots.
- M-Pesa Daraja STK Push with asynchronous callback handling and payment polling.
- Protected admin order access and controlled fulfilment status transitions.
- Render deployment instructions in [DEPLOYMENT.md](DEPLOYMENT.md).

The application currently supports M-Pesa payments only. SMS OTP and customer
notifications require an SMS provider account and are intentionally disabled until
their credentials are configured.

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## ✨ Features Implemented

✅ Professional header with sticky navigation
✅ Hero section with call-to-action buttons
✅ Product showcase with lazy loading
✅ Category filtering system
✅ Product cards with stock status
✅ About page with company values
✅ Responsive footer with social links
✅ Global CSS variables for easy theming
✅ Smooth animations and transitions
✅ Type-safe components with TypeScript
✅ Mobile-first responsive design

## 🎯 Performance

- Vite provides fast HMR (Hot Module Replacement)
- Optimized CSS with critical path inlining
- Images optimized with lazy loading
- Tree-shaking for smaller bundle sizes
- Production build: ~250KB (uncompressed), ~78KB (gzipped)

## 📞 Contact & Support

- **Email**: info@victoriafreshfish.ke
- **Phone**: +254 7XX XXX XXX
- **Location**: Kisumu, Kenya

---

**Built with ❤️ for Victoria Fresh Fish Kenya**
