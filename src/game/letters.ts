export function normalize(input: string): string {
  return input.normalize('NFC').toLowerCase()
}

export function canMakeWord(word: string, tray: string): boolean {
  const available = new Map<string, number>()

  for (const letter of normalize(tray)) {
    available.set(letter, (available.get(letter) ?? 0) + 1)
  }

  for (const letter of normalize(word)) {
    const count = available.get(letter) ?? 0
    if (count === 0) return false
    available.set(letter, count - 1)
  }

  return true
}