export type ContentType =
  | 'shocking'
  | 'informative'
  | 'transformation'
  | 'viral'
  | 'emotional'
  | 'humor'
  | 'sales'

export const HOOK_TEMPLATES: Record<ContentType, string[]> = {
  shocking: [
    'Did you know that...',
    'Nobody told me this but...',
    'I wish I knew this sooner...',
    'Stop doing this if you...',
    'This is why you\'re not seeing results...',
    'The truth they don\'t want you to know...',
  ],
  informative: [
    'Here\'s what actually works...',
    'The truth about...',
    '3 things I learned about...',
    'Everything you know about X is wrong...',
    'The real reason why...',
    'What no one tells you about...',
  ],
  transformation: [
    'I went from X to Y in 30 days',
    'Before and after...',
    'How I changed my life with...',
    'My results after using this for 30 days',
    'Watch what happened when I tried...',
  ],
  viral: [
    'Wait until you see this...',
    'I can\'t believe this works',
    'You need to see this right now...',
    'This went viral for a reason...',
    'Everyone is talking about this...',
  ],
  emotional: [
    'This changed everything for me...',
    'I finally...',
    'After years of struggling...',
    'The moment I realized...',
    'This is for everyone who...',
  ],
  humor: [
    'POV: you just discovered...',
    'Me when I found out about...',
    'Why did nobody tell me earlier?',
    'Okay I wasn\'t prepared for this...',
  ],
  sales: [
    'This is the last X you\'ll ever need...',
    'I\'ve tried everything — this works',
    'The only X that actually delivers...',
    'Stop wasting money on X and try this instead',
  ],
}

export function getHookTemplate(contentType: string): string {
  const type = contentType as ContentType
  const templates = HOOK_TEMPLATES[type] ?? HOOK_TEMPLATES['informative']!
  return templates[Math.floor(Math.random() * templates.length)]!
}
