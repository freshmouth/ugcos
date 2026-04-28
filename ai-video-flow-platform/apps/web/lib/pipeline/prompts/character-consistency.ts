export type CharacterParams = {
  demographic: string
  age_range: string
  build: string
  skin_tone: string
  hair_description: string
  outfit_description: string
  location_background: string
}

export function buildCharacterPrompt(params: CharacterParams): string {
  return [
    `Young ${params.demographic} woman/man, ${params.age_range}, ${params.build}, ${params.skin_tone},`,
    `${params.hair_description}, natural makeup, authentic look,`,
    `shot on iPhone, 9:16 vertical, photorealistic,`,
    `${params.outfit_description}, ${params.location_background}`,
    `sharp focus on face, natural lighting, candid feel, social media UGC style`,
  ].join(' ')
}

export const DEFAULT_CHARACTER: CharacterParams = {
  demographic: 'millennial',
  age_range: '25-32',
  build: 'average athletic build',
  skin_tone: 'medium skin tone',
  hair_description: 'natural brown hair, mid-length',
  outfit_description: 'casual lifestyle wear',
  location_background: 'modern home interior background',
}

export function buildConsistencyNote(characterUrl: string): string {
  return `Maintain exact character appearance from reference: ${characterUrl}. Same face, same hair, same features. Only outfit and background change per scene.`
}
