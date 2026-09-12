import { query } from '../lib/db.js'
import { productFromRow } from '../lib/db.js'

export async function findProductById(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id])
  return productFromRow(result.rows[0])
}
