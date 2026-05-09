export async function getRandomReferenceImage(folder: string): Promise<string> {
  const { cloudName, auth } = cloudinaryAuth()

  // Try prefix first
  const prefixResults = await listImages(cloudName, auth, folder, 500)
  if (prefixResults.length > 0) {
    const chosen = prefixResults[Math.floor(Math.random() * prefixResults.length)]!
    console.log(`[IMAGE-GEN] Reference pool: ${prefixResults.length} images in ${folder} — selected: ${chosen.public_id}`)
    return chosen.secure_url
  }

  // Try search API expression
  const searchResults = await searchImages(cloudName, auth, `folder="${folder}"`, 500)
  if (searchResults.length > 0) {
    const chosen = searchResults[Math.floor(Math.random() * searchResults.length)]!
    console.log(`[IMAGE-GEN] Reference pool (search): ${searchResults.length} images in ${folder} — selected: ${chosen.public_id}`)
    return chosen.secure_url
  }

  // Fall back to root-level portrait images (height/width >= 1.5)
  console.warn(`[IMAGE-GEN] Folder "${folder}" is empty — falling back to root-level portrait images`)
  const all = await listImages(cloudName, auth, '', 500)
  const portrait = all.filter(r => r.width > 0 && r.height / r.width >= 1.5)

  if (!portrait.length) {
    throw new Error(`No images found in folder "${folder}" or at root — upload UGC reference images to Cloudinary first`)
  }

  const chosen = portrait[Math.floor(Math.random() * portrait.length)]!
  console.log(`[IMAGE-GEN] Root fallback pool: ${portrait.length} portrait images — selected: ${chosen.public_id}`)
  return chosen.secure_url
}

export async function getProductImage(folder: string): Promise<string> {
  const { cloudName, auth } = cloudinaryAuth()

  // Try prefix format (works for catalog/sal-celtica/products)
  const prefixResults = await listImages(cloudName, auth, folder, 10)
  if (prefixResults.length > 0) {
    console.log(`[IMAGE-GEN] Product image from prefix (${prefixResults.length} found): ${prefixResults[0]!.secure_url}`)
    return prefixResults[0]!.secure_url
  }

  // Try search API
  const searchResults = await searchImages(cloudName, auth, `folder="${folder}"`, 10)
  if (searchResults.length > 0) {
    console.log(`[IMAGE-GEN] Product image from search (${searchResults.length} found): ${searchResults[0]!.secure_url}`)
    return searchResults[0]!.secure_url
  }

  throw new Error(`No product images found in Cloudinary folder "${folder}" — upload a product image to Cloudinary first`)
}

function cloudinaryAuth() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not set')
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  return { cloudName, auth }
}

async function listImages(
  cloudName: string,
  auth: string,
  prefix: string,
  maxResults: number
): Promise<Array<{ secure_url: string; public_id: string; width: number; height: number }>> {
  const params = new URLSearchParams({ max_results: String(maxResults), type: 'upload' })
  if (prefix) params.set('prefix', prefix)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${params}`,
    { headers: { Authorization: `Basic ${auth}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudinary list error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as {
    resources: Array<{ secure_url: string; public_id: string; width: number; height: number }>
  }
  return data.resources ?? []
}

async function searchImages(
  cloudName: string,
  auth: string,
  expression: string,
  maxResults: number
): Promise<Array<{ secure_url: string; public_id: string; width: number; height: number }>> {
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, max_results: maxResults }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    console.warn(`[IMAGE-GEN] Search API error ${res.status}: ${text.slice(0, 200)}`)
    return []
  }

  const data = await res.json() as {
    resources: Array<{ secure_url: string; public_id: string; width: number; height: number }>
  }
  return data.resources ?? []
}
