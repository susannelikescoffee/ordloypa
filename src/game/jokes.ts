export interface Joke {
  title: string
  text: string
}

export function parseJokes(source: string): Joke[] {
  const entries: string[][] = []

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith('*')) entries.push([line.slice(1).trim()])
    else if (entries.length && line.trim()) entries[entries.length - 1].push(line.trim())
  }

  return entries.flatMap(lines => {
    const entry = lines.join('\n')
    const separator = entry.indexOf(':')
    if (separator <= 0) return entry ? [{ title: 'En svensk vits', text: entry }] : []
    return [{ title: entry.slice(0, separator).trim(), text: entry.slice(separator + 1).trim() }]
  })
}

export async function loadJokes(loadSource: () => Promise<string>): Promise<Joke[]> {
  try {
    return parseJokes(await loadSource())
  } catch {
    return []
  }
}