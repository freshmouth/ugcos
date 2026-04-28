export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 2,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  intervalMs = 10_000,
  timeoutMs = 300_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await fn()
    if (result !== null) return result
    await sleep(intervalMs)
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`)
}
