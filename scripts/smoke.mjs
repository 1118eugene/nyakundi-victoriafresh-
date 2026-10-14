const localOnly = process.argv.includes('--local-only')
const targets = [
  ['Local API', process.env.SMOKE_LOCAL_API_URL || 'http://localhost:5000/api'],
]

if (!localOnly) {
  targets.push([
    'Deployed API',
    process.env.SMOKE_DEPLOYED_API_URL || 'https://nyakundi-victoriafresh-2.onrender.com/api',
  ])
}

function validateBaseUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('The smoke API URL must be an HTTP(S) base URL without credentials, query, or fragment.')
  }
  return url.toString().replace(/\/+$/, '')
}

async function requestJson(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`Expected JSON response; received HTTP ${response.status}.`)
  }
  return { response, body }
}

async function checkTarget(label, configuredBaseUrl) {
  const results = []
  let baseUrl
  try {
    baseUrl = validateBaseUrl(configuredBaseUrl)
  } catch {
    console.error(`${label}: FAIL (invalid API base URL configuration)`)
    return false
  }

  const checks = [
    ['health', async () => {
      const { response, body } = await requestJson(baseUrl, '/health')
      return response.ok && body.status === 'OK' && body.database === 'connected'
        ? 'healthy with database connected'
        : `unexpected health response (HTTP ${response.status})`
    }],
    ['catalogue', async () => {
      const { response, body } = await requestJson(baseUrl, '/products?limit=1')
      return response.ok && body.status === 'success' && Array.isArray(body.data)
        ? 'valid product-list response'
        : `unexpected catalogue response (HTTP ${response.status})`
    }],
    ['quote validation', async () => {
      const { response, body } = await requestJson(baseUrl, '/orders/quote', {
        method: 'POST',
        body: JSON.stringify({ county: 'Nairobi', items: [] }),
      })
      return response.status === 400 && body.status === 'error'
        ? 'invalid empty quote rejected without creating an order'
        : `unexpected quote-validation response (HTTP ${response.status})`
    }],
    ['checkout validation', async () => {
      const { response, body } = await requestJson(baseUrl, '/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return response.status === 400 && body.status === 'error'
        ? 'incomplete checkout rejected without creating an order'
        : `unexpected checkout-validation response (HTTP ${response.status})`
    }],
  ]

  for (const [name, check] of checks) {
    try {
      const detail = await check()
      const passed = detail.startsWith('healthy') || detail.startsWith('valid')
        || detail.startsWith('invalid') || detail.startsWith('incomplete')
      results.push(passed)
      console.log(`${label} ${name}: ${passed ? 'PASS' : 'FAIL'} (${detail})`)
    } catch (error) {
      results.push(false)
      console.log(`${label} ${name}: FAIL (${error.name === 'TimeoutError' ? 'request timed out' : 'request failed'})`)
    }
  }

  return results.every(Boolean)
}

let passed = true
for (const [label, baseUrl] of targets) {
  if (!await checkTarget(label, baseUrl)) passed = false
}

if (!passed) process.exitCode = 1
