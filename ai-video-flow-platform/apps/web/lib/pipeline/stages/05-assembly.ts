import path from 'path'
import { promises as fs } from 'fs'
import { v2 as cloudinary } from 'cloudinary'
import type { ScenePlan } from '../types'
import { downloadFile, ensureTmpDir } from '../utils/cleanup'
import { getMotionFilter } from '../prompts/motion-presets'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type AssemblyResult = {
  cloudinary_url: string
  duration_actual: number
}

export async function stage05Assembly(
  plan: ScenePlan,
  videoId: string,
  projectId: string,
  userId: string
): Promise<AssemblyResult> {
  const tmpDir = await ensureTmpDir(videoId)

  // Step A: Download all clips
  const clipPaths: string[] = []
  await Promise.all(
    plan.scenes.map(async (scene, i) => {
      if (!scene.clip_url) throw new Error(`Scene ${scene.id} has no clip_url`)
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(3, '0')}.mp4`)
      await downloadFile(scene.clip_url, clipPath)
      clipPaths[i] = clipPath
    })
  )

  // Steps B-F: FFmpeg processing
  const outputPath = path.join(tmpDir, 'output_assembled.mp4')
  await runFfmpegPipeline(plan, clipPaths, tmpDir, outputPath)

  // Step G: Upload to Cloudinary
  const folder = `catalog/${projectId}/videos`
  const uploadResult = await cloudinary.uploader.upload(outputPath, {
    resource_type: 'video',
    folder,
    tags: [projectId, userId, 'assembled'],
    transformation: [{ quality: 'auto:best', fetch_format: 'mp4' }],
  })

  return {
    cloudinary_url: uploadResult.secure_url,
    duration_actual: uploadResult.duration ?? plan.target_duration_seconds,
  }
}

async function runFfmpegPipeline(
  plan: ScenePlan,
  clipPaths: string[],
  tmpDir: string,
  outputPath: string
): Promise<void> {
  const ffmpeg = await importFfmpeg()

  // Step B+C: Trim and apply motion effects per clip
  const trimmedPaths: string[] = []
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i]!
    const inputPath = clipPaths[i]!
    const trimmedPath = path.join(tmpDir, `trimmed_${String(i).padStart(3, '0')}.mp4`)
    const motionFilter = getMotionFilter(scene.id, scene.type)

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(inputPath)
        .inputOptions([`-t ${scene.duration_seconds}`])
        .outputOptions(['-c:v libx264', '-crf 18', '-preset fast', '-an'])

      if (motionFilter) {
        cmd = cmd.videoFilters(motionFilter)
      }

      cmd.output(trimmedPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    trimmedPaths.push(trimmedPath)
  }

  // Step D: Generate concat list
  const listPath = path.join(tmpDir, 'concat_list.txt')
  const listContent = trimmedPaths.map(p => `file '${p}'`).join('\n')
  await fs.writeFile(listPath, listContent, 'utf8')

  // Step E: Concatenate
  const rawPath = path.join(tmpDir, 'output_raw.mp4')
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c:v libx264', '-crf 18', '-preset fast'])
      .output(rawPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  // Step F: Mix audio (background music if available)
  const musicPath = process.env.MUSIC_LIBRARY_PATH
  if (musicPath) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(rawPath)
        .input(musicPath)
        .complexFilter([
          '[0:a]volume=1[a0]',
          '[1:a]volume=0.06[a1]',
          '[a0][a1]amix=inputs=2[aout]',
        ])
        .outputOptions(['-map 0:v', '-map [aout]', '-c:v copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', () => {
          // Fall back to raw if audio mix fails
          fs.copyFile(rawPath, outputPath).then(resolve).catch(reject)
        })
        .run()
    })
  } else {
    await fs.copyFile(rawPath, outputPath)
  }
}

async function importFfmpeg() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegStatic = require('ffmpeg-static') as string
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpeg = require('fluent-ffmpeg') as (input?: string) => FluentFfmpegCommand
  if (ffmpegStatic) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fluent-ffmpeg').setFfmpegPath(ffmpegStatic)
  }
  return ffmpeg
}

// Minimal type for fluent-ffmpeg usage in this file
type FluentFfmpegCommand = {
  input: (i: string) => FluentFfmpegCommand
  inputOptions: (opts: string[]) => FluentFfmpegCommand
  outputOptions: (opts: string[]) => FluentFfmpegCommand
  videoFilters: (f: string) => FluentFfmpegCommand
  complexFilter: (f: string[]) => FluentFfmpegCommand
  output: (o: string) => FluentFfmpegCommand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, cb: (...args: any[]) => void) => FluentFfmpegCommand
  run: () => void
}
