import { query } from '../lib/db.js'

export async function findUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function findUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email])
  return result.rows[0] || null
}

export async function findUserByPhone(phone) {
  const result = await query('SELECT * FROM users WHERE phone = $1', [phone])
  return result.rows[0] || null
}
