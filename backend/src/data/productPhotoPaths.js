import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const productImageDirectory = fileURLToPath(new URL('../../../public/images/products/', import.meta.url))

export const productPhotoPaths = new Set([
  '/images/products/catfish-wikimedia.jpg',
  '/images/products/fish%20fresh.jpg',
  '/images/products/fresh-nile-perch.jpg',
  '/images/products/fresh-pexels-a.jpg',
  '/images/products/fresh-pexels-b.jpg',
  '/images/products/fresh-pexels-c.jpg',
  '/images/products/nile-perch-wikimedia.jpg',
  '/images/products/omena-dried-wikimedia.jpg',
  '/images/products/pexels-10039794.jpg',
  '/images/products/pexels-12572537.jpg',
  '/images/products/pexels-14879227.jpg',
  '/images/products/pexels-15553656.jpg',
  '/images/products/pexels-8352050.jpg',
  '/images/products/pexels-fillet.jpg',
  '/images/products/pexels-fried.jpg',
  '/images/products/pexels-grilled.jpg',
  '/images/products/pexels-smoked.jpg',
  '/images/products/pexels-tilapia.jpg',
])

for (const filename of readdirSync(productImageDirectory)) {
  if (!/\.(avif|gif|jpe?g|png|webp)$/i.test(filename)) continue
  const filePath = path.join(productImageDirectory, filename)
  if (statSync(filePath).isFile()) {
    productPhotoPaths.add(`/images/products/${encodeURIComponent(filename)}`)
  }
}
