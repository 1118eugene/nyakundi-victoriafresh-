import { readFileSync } from 'node:fs'

const catalogData = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))

if (!catalogData || typeof catalogData !== 'object'
  || !catalogData.categoryLabels || typeof catalogData.categoryLabels !== 'object'
  || !Array.isArray(catalogData.products)) {
  throw new Error('The editable catalogue must define categoryLabels and a products array.')
}

export const catalogProducts = catalogData.products
export const categoryLabels = catalogData.categoryLabels
