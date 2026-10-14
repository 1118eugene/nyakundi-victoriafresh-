import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')
const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')

test('robots and sitemap expose only the configured public pages', () => {
  assert.match(robots, /^User-agent: \*/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.match(robots, /^Sitemap: https:\/\/nyakundi-victoriafresh\.vercel\.app\/sitemap\.xml$/m)
  for (const path of ['/admin/', '/delivery/', '/account', '/cart', '/checkout', '/login', '/signup', '/track/']) {
    assert.match(robots, new RegExp(`^Disallow: ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'))
  }

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.ok(locations.length > 0)
  assert.equal((sitemap.match(/<url>/g) || []).length, locations.length)
  assert.equal(new Set(locations).size, locations.length)
  for (const location of locations) {
    const url = new URL(location)
    assert.equal(url.origin, 'https://nyakundi-victoriafresh.vercel.app')
    assert.ok(!['/cart', '/checkout', '/login', '/signup'].includes(url.pathname))
  }
})
