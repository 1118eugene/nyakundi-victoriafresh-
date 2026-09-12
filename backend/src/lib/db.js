import pg from 'pg'
import { config } from '../config/index.js'
import { verifiedCatalog } from '../data/catalog.js'

const { Pool } = pg
let pool
let databaseReady = false
let connectionPromise

function getPool() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured')
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
    })
    pool.on('error', (error) => {
      databaseReady = false
      console.error('PostgreSQL pool error:', error.message)
    })
  }
  return pool
}

export function isDatabaseReady() {
  return databaseReady
}

function isConnectionError(error) {
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P03'].includes(error?.code)
}

export async function query(text, values = []) {
  try {
    const result = await getPool().query(text, values)
    databaseReady = true
    return result
  } catch (error) {
    if (isConnectionError(error)) databaseReady = false
    throw error
  }
}

export async function withTransaction(callback) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    databaseReady = true
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (isConnectionError(error)) databaseReady = false
    throw error
  } finally {
    client.release()
  }
}

export async function connectToDatabase() {
  if (databaseReady) return getPool()
  if (connectionPromise) return connectionPromise
  connectionPromise = getPool().query('SELECT 1').then(() => {
    databaseReady = true
    return getPool()
  }).finally(() => {
    connectionPromise = null
  })
  return connectionPromise
}

export async function initializeDatabase({ retry = true } = {}) {
  while (!databaseReady) {
    try {
      await connectToDatabase()
      await migrateSchema()
      await seedVerifiedProducts()
      console.log('PostgreSQL connection and schema are ready')
      return
    } catch (error) {
      databaseReady = false
      if (!retry) throw error
      console.error(`PostgreSQL connection attempt failed: ${error.message}. Retrying in 10 seconds.`)
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }
}

export async function migrateSchema() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      phone text NOT NULL UNIQUE,
      customer_name text NOT NULL,
      google_id text NOT NULL DEFAULT '',
      county text NOT NULL DEFAULT '',
      town text NOT NULL DEFAULT '',
      address_line text NOT NULL DEFAULT '',
      landmark text NOT NULL DEFAULT '',
      preferred_payment text NOT NULL DEFAULT 'mpesa' CHECK (preferred_payment IN ('mpesa', 'fuliza', 'both')),
      otp_hash text NOT NULL DEFAULT '',
      otp_expires_at timestamptz,
      otp_attempts integer NOT NULL DEFAULT 0,
      otp_sent_at timestamptz,
      otp_verified_at timestamptz,
      verified_phone boolean NOT NULL DEFAULT false,
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sku text NOT NULL UNIQUE,
      name text NOT NULL,
      description text NOT NULL,
      price numeric(12,2) NOT NULL CHECK (price >= 0),
      unit text NOT NULL,
      image text NOT NULL DEFAULT '',
      category text NOT NULL,
      species text NOT NULL,
      preparation text NOT NULL,
      quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      active boolean NOT NULL DEFAULT true,
      in_stock boolean NOT NULL DEFAULT true,
      featured boolean NOT NULL DEFAULT false,
      price_updated_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number text NOT NULL UNIQUE,
      user_id uuid REFERENCES users(id),
      customer_id uuid REFERENCES users(id),
      tracking_token text NOT NULL UNIQUE,
      inventory_reserved boolean NOT NULL DEFAULT false,
      inventory_expires_at timestamptz,
      customer jsonb NOT NULL,
      delivery jsonb NOT NULL,
      subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
      shipping_fee numeric(12,2) NOT NULL CHECK (shipping_fee >= 0),
      total_price numeric(12,2) NOT NULL CHECK (total_price >= 0),
      currency text NOT NULL DEFAULT 'KES',
      status text NOT NULL DEFAULT 'awaiting_payment',
      payment_method text NOT NULL DEFAULT 'mpesa',
      payment_status text NOT NULL DEFAULT 'pending',
      mpesa jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES products(id),
      sku text NOT NULL,
      name text NOT NULL,
      unit text NOT NULL,
      price numeric(12,2) NOT NULL,
      quantity integer NOT NULL CHECK (quantity > 0),
      line_total numeric(12,2) NOT NULL,
      image text NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_checkout_idx ON orders((mpesa->>'checkoutRequestID'));
    CREATE INDEX IF NOT EXISTS products_catalog_idx ON products(active, in_stock, quantity);
    INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT (version) DO NOTHING;
  `)
}

export function productFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    unit: row.unit,
    image: row.image,
    category: row.category,
    species: row.species,
    preparation: row.preparation,
    quantity: row.quantity,
    active: row.active,
    inStock: row.in_stock,
    featured: row.featured,
    priceUpdatedAt: row.price_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function orderFromRows(orderRow, itemRows = []) {
  if (!orderRow) return null
  return {
    id: orderRow.id,
    orderNumber: orderRow.order_number,
    userId: orderRow.user_id,
    customerId: orderRow.customer_id,
    inventoryReserved: orderRow.inventory_reserved,
    inventoryExpiresAt: orderRow.inventory_expires_at,
    customer: orderRow.customer,
    delivery: orderRow.delivery,
    items: itemRows.filter((item) => item.order_id === orderRow.id).map((item) => ({
      productId: item.product_id,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
      image: item.image,
    })),
    subtotal: Number(orderRow.subtotal),
    shippingFee: Number(orderRow.shipping_fee),
    totalPrice: Number(orderRow.total_price),
    currency: orderRow.currency,
    status: orderRow.status,
    paymentMethod: orderRow.payment_method,
    paymentStatus: orderRow.payment_status,
    mpesa: orderRow.mpesa,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
  }
}

export async function fetchOrder(id, { includeTrackingToken = false, client = null } = {}) {
  const runner = client || { query }
  const orderResult = await runner.query(
    `SELECT * FROM orders WHERE id = $1`,
    [id],
  )
  const row = orderResult.rows[0]
  if (!row) return null
  const items = await runner.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id])
  const order = orderFromRows(row, items.rows)
  if (includeTrackingToken) order.trackingToken = row.tracking_token
  return order
}

export async function seedVerifiedProducts() {
  for (const product of verifiedCatalog) {
    await query(`
      INSERT INTO products (sku, name, description, price, unit, image, category, species, preparation, quantity, active, in_stock, featured, price_updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
        price=EXCLUDED.price, unit=EXCLUDED.unit, image=EXCLUDED.image, category=EXCLUDED.category,
        species=EXCLUDED.species, preparation=EXCLUDED.preparation, active=EXCLUDED.active,
        featured=EXCLUDED.featured, price_updated_at=EXCLUDED.price_updated_at, updated_at=now()
    `, [product.sku, product.name, product.description, product.price, product.unit, product.image, product.category, product.species, product.preparation, product.quantity, product.active, product.inStock, product.featured, product.priceUpdatedAt])
  }
  const skus = verifiedCatalog.map((product) => product.sku)
  await query(`DELETE FROM products p WHERE NOT (p.sku = ANY($1::text[]))
    AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = p.id)`, [skus])
  await query(`UPDATE products SET active = false, in_stock = false, updated_at = now()
    WHERE NOT (sku = ANY($1::text[]))
      AND EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = products.id)`, [skus])
}

export async function releaseExpiredInventory() {
  return withTransaction(async (client) => {
    const expired = await client.query(`
      SELECT * FROM orders
      WHERE inventory_reserved = true AND payment_status = 'initiated'
        AND inventory_expires_at <= now()
      FOR UPDATE SKIP LOCKED
    `)
    for (const order of expired.rows) {
      const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])
      for (const item of items.rows) {
        await client.query('UPDATE products SET quantity = quantity + $1, updated_at = now() WHERE id = $2', [item.quantity, item.product_id])
      }
      await client.query(`UPDATE orders SET inventory_reserved=false, inventory_expires_at=NULL,
        payment_status='failed', mpesa=mpesa || $1::jsonb, updated_at=now() WHERE id=$2`,
      [JSON.stringify({ resultDescription: 'Payment window expired before confirmation.' }), order.id])
    }
    return expired.rowCount
  })
}

export async function closeDatabase() {
  if (pool) await pool.end()
}
