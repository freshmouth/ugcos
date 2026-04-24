export function isInPostingWindow(postingTime: string): boolean {
  const now = new Date()
  const mexicoCityHour = (now.getUTCHours() - 6 + 24) % 24

  const timeWindows: Record<string, { start: number; end: number }> = {
    morning:   { start: 8,  end: 10 },
    afternoon: { start: 12, end: 14 },
    evening:   { start: 18, end: 20 },
  }

  const tw = timeWindows[postingTime] ?? timeWindows['morning']!
  return mexicoCityHour >= tw.start && mexicoCityHour < tw.end
}
