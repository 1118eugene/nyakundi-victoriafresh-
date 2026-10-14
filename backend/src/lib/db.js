import pg from 'pg'
import { config } from '../config/index.js'
import { catalogProducts } from '../data/catalog.js'

const { Pool } = pg
let pool
let databaseReady = false
let databaseInitializationInProgress = false
let connectionPromise
let databaseMonitor
let databaseMonitorInFlight = false

function setDatabaseReady(ready) {
  if (databaseReady === ready) return
  databaseReady = ready
  console.info(ready
    ? 'PostgreSQL connection is ready.'
    : 'PostgreSQL connection is unavailable; automatic recovery is active.')
}

function getPool() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured')
  if (!pool) {
    const databaseHost = new URL(config.databaseUrl).hostname
    const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost)
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: isLocalDatabase ? undefined : true,
    })
    pool.on('error', (error) => {
      setDatabaseReady(false)
      console.error('PostgreSQL pool error:', error.message)
    })
  }
  return pool
}

export function isDatabaseReady() {
  return databaseReady && !databaseInitializationInProgress
}

export function isDatabaseConnectionError(error) {
  const code = String(error?.code || '')
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P02', '57P03'].includes(code)
    || code.startsWith('08')
    || code.startsWith('28')
    || code.startsWith('3D')
    || code.startsWith('53')
    || code.startsWith('57')
    || /connection terminated|connection closed|server closed the connection|socket hang up/i.test(error?.message || '')
}

export async function query(text, values = []) {
  try {
    const result = await getPool().query(text, values)
    setDatabaseReady(true)
    return result
  } catch (error) {
    if (isDatabaseConnectionError(error)) setDatabaseReady(false)
    throw error
  }
}

export async function withTransaction(callback) {
  let client
  try {
    client = await getPool().connect()
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    setDatabaseReady(true)
    return result
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    if (isDatabaseConnectionError(error)) setDatabaseReady(false)
    throw error
  } finally {
    client?.release()
  }
}

export async function connectToDatabase() {
  if (databaseReady) return getPool()
  if (connectionPromise) return connectionPromise
  connectionPromise = getPool().query('SELECT 1').then(() => {
    setDatabaseReady(true)
    return getPool()
  }).finally(() => {
    connectionPromise = null
  })
  return connectionPromise
}

export async function initializeDatabase({ retry = true } = {}) {
  databaseInitializationInProgress = true
  try {
    while (!databaseReady) {
      try {
        await connectToDatabase()
        await migrateSchema()
        await seedCatalogProducts()
        console.log('PostgreSQL connection and schema are ready')
        return
      } catch (error) {
        setDatabaseReady(false)
        if (!retry) throw error
        console.error(`PostgreSQL connection attempt failed: ${error.message}. Retrying in 10 seconds.`)
        await new Promise((resolve) => setTimeout(resolve, 10000))
      }
    }
  } finally {
    databaseInitializationInProgress = false
  }
}

export function startDatabaseMonitor({ intervalMs = 15000 } = {}) {
  if (databaseMonitor) return databaseMonitor

  const checkDatabase = async () => {
    if (databaseMonitorInFlight) return
    databaseMonitorInFlight = true
    try {
      if (databaseReady) {
        await query('SELECT 1')
      } else {
        await initializeDatabase({ retry: false })
        console.log('PostgreSQL connection and schema are ready')
      }
    } catch (error) {
      setDatabaseReady(false)
      console.error(`PostgreSQL health check failed: ${error.message}`)
    } finally {
      databaseMonitorInFlight = false
    }
  }

  void checkDatabase()
  databaseMonitor = setInterval(() => { void checkDatabase() }, intervalMs)
  databaseMonitor.unref()
  return databaseMonitor
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
      session_version integer NOT NULL DEFAULT 0,
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
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
      checkout_key text,
      checkout_fingerprint text,
      mpesa jsonb NOT NULL DEFAULT '{}'::jsonb,
      assigned_delivery_person text,
      assigned_delivery_name text,
      delivery_location jsonb,
      delivery_location_expires_at timestamptz,
      confirmed_at timestamptz,
      preparing_at timestamptz,
      dispatched_at timestamptz,
      delivered_at timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_key text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_fingerprint text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_delivery_person text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_delivery_name text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_location jsonb;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_location_expires_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparing_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
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
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_checkout_idx ON orders((mpesa->>'checkoutRequestID'));
    CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_unique ON orders(checkout_key) WHERE checkout_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS products_catalog_idx ON products(active, in_stock, quantity);
    INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT (version) DO NOTHING;
    CREATE TABLE IF NOT EXISTS blocked_phones (
      phone text PRIMARY KEY,
      reason text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO schema_migrations (version) VALUES (2) ON CONFLICT (version) DO NOTHING;
    CREATE TABLE IF NOT EXISTS order_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      actor_role text NOT NULL,
      actor_id text NOT NULL DEFAULT '',
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at);
    INSERT INTO order_events (order_id,event_type,actor_role,details,created_at)
      SELECT o.id,'legacy_status_snapshot','system',jsonb_build_object('status',o.status),o.created_at
      FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id=o.id);
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      method text NOT NULL CHECK (method IN ('cash', 'mpesa')),
      amount numeric(12,2) NOT NULL CHECK (amount > 0),
      status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'paid', 'failed')),
      provider_request_id text UNIQUE,
      receipt_number text UNIQUE,
      phone text NOT NULL DEFAULT '',
      paid_at timestamptz,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id, created_at);
    CREATE TABLE IF NOT EXISTS reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      product_id uuid NOT NULL REFERENCES products(id),
      rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at timestamptz NOT NULL DEFAULT now(),
      moderated_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS reviews_product_status_idx ON reviews(product_id, status, created_at DESC);
    INSERT INTO schema_migrations (version) VALUES (3) ON CONFLICT (version) DO NOTHING;
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=4) THEN
        UPDATE products SET active=false,in_stock=false,updated_at=now()
        WHERE sku ~ '^(TILAPIA|NILE_PERCH_MBUTA|CATFISH_NDUMA|OMENA)-[A-Z0-9-]+-[0-9]{2}$'
          AND name ~ ' (Fresh|Fillet|Steak|Head|Frame|Smoked|Dried|Packet|Fried) [0-9]{2}$'
          AND description LIKE '%prepared % and packed carefully for your order.';
        INSERT INTO schema_migrations (version) VALUES (4);
      END IF;
    END
    $migration$;
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=5) THEN
        UPDATE products SET active=false,in_stock=false,updated_at=now()
        WHERE sku ~ '^(TILAPIA|NILE_PERCH_MBUTA|CATFISH_NDUMA|OMENA)-[A-Z_-]+-[A-Z_-]+-[0-9]{2}$'
          AND name ~ '^(Tilapia|Nile Perch \\(Mbuta\\)|Catfish \\(Nduma\\)|Omena) (Fresh|Fillet|Steak|Head|Frame|Smoked|Dried|Packet|Fried) [0-9]{2}$'
          AND description LIKE '% prepared % and packed carefully for your order.';
        INSERT INTO schema_migrations (version) VALUES (5);
      END IF;
    END
    $migration$;
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=6) THEN
        UPDATE products SET active=false,in_stock=false,updated_at=now()
        WHERE sku ~ '^(TILAPIA|NILE_PERCH_MBUTA|CATFISH_NDUMA|OMENA)_?-[A-Z_-]+-[A-Z_-]+-[0-9]{2}$'
          AND name ~ '^(Tilapia|Nile Perch \\(Mbuta\\)|Catfish \\(Nduma\\)|Omena) (Fresh|Fillet|Steak|Head|Frame|Smoked|Dried|Packet|Fried) [0-9]{2}$'
          AND description LIKE '% prepared % and packed carefully for your order.';
        INSERT INTO schema_migrations (version) VALUES (6);
      END IF;
    END
    $migration$;
    DO $migration$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=7) THEN
        ALTER TABLE products ADD COLUMN IF NOT EXISTS size_label text NOT NULL DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS price_confirmed boolean NOT NULL DEFAULT false;
        CREATE TABLE IF NOT EXISTS product_price_history (
          id bigserial PRIMARY KEY,
          product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
          previous_price numeric(12,2),
          new_price numeric(12,2) NOT NULL CHECK (new_price > 0),
          changed_at timestamptz NOT NULL DEFAULT now(),
          changed_by text NOT NULL DEFAULT 'admin'
        );
        CREATE INDEX IF NOT EXISTS product_price_history_product_idx
          ON product_price_history(product_id, changed_at DESC);
        INSERT INTO schema_migrations (version) VALUES (7);
      END IF;
    END
    $migration$;
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
    sizeLabel: row.size_label || '',
    image: row.image,
    photos: Array.isArray(row.photos) ? row.photos : [],
    category: row.category,
    species: row.species,
    preparation: row.preparation,
    quantity: row.quantity,
    active: row.active,
    inStock: row.in_stock,
    featured: row.featured,
    priceUpdatedAt: row.price_updated_at,
    priceConfirmed: row.price_confirmed === true,
    rating: row.rating_count === undefined ? undefined : {
      average: Number(row.rating_average || 0),
      count: Number(row.rating_count || 0),
    },
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
    assignedDeliveryPerson: orderRow.assigned_delivery_person || null,
    assignedDeliveryName: orderRow.assigned_delivery_name || null,
    deliveryLocation: orderRow.delivery_location && orderRow.delivery_location_expires_at > new Date()
      ? { ...orderRow.delivery_location, expiresAt: orderRow.delivery_location_expires_at }
      : null,
    timestamps: {
      confirmedAt: orderRow.confirmed_at,
      preparingAt: orderRow.preparing_at,
      dispatchedAt: orderRow.dispatched_at,
      deliveredAt: orderRow.delivered_at,
      cancelledAt: orderRow.cancelled_at,
    },
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
  const events = await runner.query(`SELECT event_type AS type,actor_role AS "actorRole",
    details,created_at AS "createdAt" FROM order_events WHERE order_id=$1 ORDER BY created_at,id`, [id])
  order.history = events.rows
  const payments = await runner.query(`SELECT method,amount,status,receipt_number AS "receiptNumber",
    phone,paid_at AS "paidAt",created_at AS "createdAt" FROM payments
    WHERE order_id=$1 ORDER BY created_at,id`, [id])
  order.payments = payments.rows.map((payment) => ({ ...payment, amount: Number(payment.amount) }))
  if (includeTrackingToken) order.trackingToken = row.tracking_token
  return order
}

export async function seedCatalogProducts() {
  for (const product of catalogProducts) {
    await withTransaction(async (client) => {
      const existing = await client.query('SELECT id,price,price_confirmed FROM products WHERE sku=$1 FOR UPDATE', [product.sku])
      const result = await client.query(`
        INSERT INTO products (sku,name,description,price,unit,size_label,image,photos,category,species,
          preparation,quantity,active,in_stock,featured,price_confirmed,price_updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
          price=EXCLUDED.price,unit=EXCLUDED.unit,size_label=EXCLUDED.size_label,image=EXCLUDED.image,
          photos=EXCLUDED.photos,category=EXCLUDED.category,species=EXCLUDED.species,
          preparation=EXCLUDED.preparation,featured=EXCLUDED.featured,
          price_confirmed=EXCLUDED.price_confirmed,
          price_updated_at=CASE WHEN products.price IS DISTINCT FROM EXCLUDED.price
            THEN EXCLUDED.price_updated_at ELSE products.price_updated_at END,
          updated_at=now()
        RETURNING id
      `, [product.sku, product.name, product.description || '', product.price, product.unit,
        product.sizeLabel, product.image || '', JSON.stringify(product.photos), product.category,
        product.species, product.preparation, product.quantity, product.active, product.inStock,
        product.featured, product.priceConfirmed, product.priceUpdatedAt])
      const old = existing.rows[0]
      const priceChanged = product.priceConfirmed
        && (!old?.price_confirmed || Math.round(Number(old.price) * 100) !== Math.round(product.price * 100))
      if (priceChanged) {
        await client.query(`INSERT INTO product_price_history(product_id,previous_price,new_price)
          VALUES ($1,$2,$3)`, [result.rows[0].id, old?.price_confirmed ? old.price : null, product.price])
      }
    })
  }
}

export async function releaseExpiredInventory() {
  return withTransaction(async (client) => {
    const expired = await client.query(`
      SELECT * FROM orders
      WHERE inventory_reserved = true AND payment_status IN ('pending', 'initiated')
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
