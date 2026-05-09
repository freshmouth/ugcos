// Run: cd apps/web && npx tsx --env-file .env.local scripts/debug-cloudinary.ts
import 'dotenv/config'

const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
const apiKey = process.env.CLOUDINARY_API_KEY!
const apiSecret = process.env.CLOUDINARY_API_SECRET!
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

const UGC_FOLDER = 'catalog/sal-celtica/ugc-refs'
const PRODUCT_FOLDER = 'catalog/sal-celtica/products'

async function testFormat(label: string, url: string, method = 'GET', body?: object): Promise<number> {
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }
  const res = await fetch(url, opts)
  if (!res.ok) {
    const text = await res.text()
    console.log(`  ${label} → HTTP ${res.status}: ${text.slice(0, 120)}`)
    return 0
  }
  const data = await res.json() as { resources?: unknown[]; total_count?: number }
  const count = data.resources?.length ?? 0
  console.log(`  ${label} → ${count} results`)
  if (count > 0) {
    const first = (data.resources as Array<{ secure_url: string }>)[0]!
    console.log(`    sample: ${first.secure_url}`)
  }
  return count
}

async function debugFolder(folder: string) {
  console.log(`\n=== Testing folder: "${folder}" ===`)
  const base = `https://api.cloudinary.com/v1_1/${cloudName}`

  await testFormat(
    '[TEST 1] prefix (no slash)',
    `${base}/resources/image?prefix=${encodeURIComponent(folder)}&max_results=5&type=upload`,
  )

  await testFormat(
    '[TEST 2] prefix (trailing slash)',
    `${base}/resources/image?prefix=${encodeURIComponent(folder + '/')}&max_results=5&type=upload`,
  )

  await testFormat(
    '[TEST 3] folder param',
    `${base}/resources/image?folder=${encodeURIComponent(folder)}&max_results=5`,
  )

  await testFormat(
    '[TEST 4] search API',
    `${base}/resources/search`,
    'POST',
    { expression: `folder="${folder}"`, max_results: 5 },
  )
}

async function main() {
  console.log('=== Cloudinary Debug ===')
  console.log(`Cloud: ${cloudName}`)

  await debugFolder(UGC_FOLDER)
  await debugFolder(PRODUCT_FOLDER)
}

main().catch(err => { console.error(err); process.exit(1) })
