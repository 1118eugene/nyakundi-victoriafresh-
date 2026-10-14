import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogProducts, categoryLabels } from '../src/data/catalog.js'

test('editable catalogue defines requested categories without fabricated products', () => {
  assert.deepEqual(catalogProducts, [])
  assert.deepEqual(categoryLabels, {
    'fresh-whole': 'Whole Fresh Fish',
    fillet: 'Fish Fillets',
    dried: 'Dried Fish',
    smoked: 'Smoked Fish',
    'small-fish': 'Small Fish',
    'coastal-seafood': 'Coastal Seafood',
  })
})
