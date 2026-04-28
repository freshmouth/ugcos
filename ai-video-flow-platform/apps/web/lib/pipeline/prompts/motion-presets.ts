export type MotionPreset = {
  ffmpegFilter: string
  description: string
}

export const MOTION_PRESETS = {
  hook: {
    ffmpegFilter: "zoompan=z='min(zoom+0.0015,1.5)':d=150:s=1080x1920",
    description: 'Slow zoom in for hook scenes',
  },
  broll: {
    ffmpegFilter: 'setpts=0.95*PTS',
    description: 'Slight speed-up for b-roll',
  },
  product: {
    ffmpegFilter: 'scale=1080:1920,setpts=1.0*PTS',
    description: 'Steady hold for product scenes',
  },
  talking_mid: {
    ffmpegFilter: '',
    description: 'No filter, natural for talking head',
  },
  cta: {
    ffmpegFilter: "zoompan=z='max(zoom-0.0010,1.0)':d=150:s=1080x1920",
    description: 'Slow zoom out for CTA',
  },
} satisfies Record<string, MotionPreset>

export function getMotionFilter(sceneId: number, sceneType: string): string {
  if (sceneId <= 2) return MOTION_PRESETS.hook.ffmpegFilter
  if (sceneType === 'broll_lifestyle' || sceneType === 'broll_stock') return MOTION_PRESETS.broll.ffmpegFilter
  if (sceneType === 'product_reveal' || sceneType === 'product_closeup') return MOTION_PRESETS.product.ffmpegFilter
  return MOTION_PRESETS.talking_mid.ffmpegFilter
}
