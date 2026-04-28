import { promises as fs } from 'fs'
import path from 'path'

export async function cleanupTmp(videoId: string): Promise<void> {
  const dir = path.join('/tmp', 'ugcos', videoId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // Non-critical — tmp cleanup failure should not fail the pipeline
  }
}

export async function ensureTmpDir(videoId: string): Promise<string> {
  const dir = path.join('/tmp', 'ugcos', videoId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  const buffer = await res.arrayBuffer()
  await fs.writeFile(dest, Buffer.from(buffer))
}
