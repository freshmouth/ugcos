import { SORA_PROMPT_LOCK } from './sora-video-prompt'

export type ContentTypeConfig = {
  id: string
  label: string
  emoji: string
  desc: string
  promptLock: string
}

export const CONTENT_TYPES: Record<string, ContentTypeConfig> = {
  informative: {
    id: 'informative',
    label: 'Informative',
    emoji: '🎓',
    desc: 'Educate your audience with facts and tips',
    promptLock: '',
  },
  viral: {
    id: 'viral',
    label: 'Viral',
    emoji: '🔥',
    desc: 'Bold takes that spark debate and shares',
    promptLock: '',
  },
  shocking: {
    id: 'shocking',
    label: 'Shocking',
    emoji: '😱',
    desc: 'Surprising facts that stop the scroll',
    promptLock: '',
  },
  emotional: {
    id: 'emotional',
    label: 'Emotional',
    emoji: '💛',
    desc: 'Stories that connect and inspire',
    promptLock: '',
  },
  transformation: {
    id: 'transformation',
    label: 'Transformation',
    emoji: '💪',
    desc: 'Before/after, results-driven content',
    promptLock: '',
  },
  humor: {
    id: 'humor',
    label: 'Humor',
    emoji: '🤣',
    desc: 'Lighthearted content that makes people laugh',
    promptLock: '',
  },
  sales: {
    id: 'sales',
    label: 'Sales & Promo',
    emoji: '🛒',
    desc: 'Direct offer, discount, urgency-driven',
    promptLock: '',
  },
  scroll_stopper: {
    id: 'scroll_stopper',
    label: 'Scroll Stopper',
    emoji: '🛑',
    desc: 'Controversy + strong hook engineered to stop the scroll',
    promptLock: SORA_PROMPT_LOCK,
  },
}
