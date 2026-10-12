// Rene hjelpefunksjoner for Norsk ordbank (bokmål). Filene er tab-separerte og latin1-kodet.

export interface WordInfo {
  lemmas: string[]
  classes: string[]
  // Antall sammensatte ord grunnformen inngår i. Brukes som mål på hvor vanlig ordet er.
  productivity: number
}

// Ordklasser som er trygge å bruke. Egennavn (prop), forkortelser (fork), symboler, henvisninger og utrop er utelatt.
export const SAFE_CLASSES: ReadonlySet<string> = new Set(['subst', 'verb', 'adj', 'adv', 'prep', 'pron', 'det', 'konj', 'sbu'])

function forEachRow(text: string, visit: (columns: string[]) => void): void {
  let start = text.indexOf('\n') + 1
  while (start > 0 && start < text.length) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = text.length
    const line = text.slice(start, text[end - 1] === '\r' ? end - 1 : end)
    if (line) visit(line.split('\t'))
    start = end + 1
  }
}

export function classOfTag(tag: string): string {
  const tokens = tag.split(' ')
  return tokens.includes('prop') ? 'prop' : tokens[0]
}

export function parseLemmas(text: string): Map<string, string> {
  const lemmas = new Map<string, string>()
  forEachRow(text, columns => {
    if (columns[1] && columns[2]) lemmas.set(columns[1], columns[2])
  })
  return lemmas
}

export function parseCompoundProductivity(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (part: string | undefined) => {
    const key = part?.toLowerCase()
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  forEachRow(text, columns => {
    add(columns[4])
    add(columns[7])
  })
  return counts
}

export function parseFullforms(text: string, wanted: ReadonlySet<string>): Map<string, { lemmaIds: Set<string>; classes: Set<string> }> {
  const forms = new Map<string, { lemmaIds: Set<string>; classes: Set<string> }>()
  forEachRow(text, columns => {
    const word = columns[2]
    if (!word || !wanted.has(word)) return
    const entry = forms.get(word) ?? { lemmaIds: new Set<string>(), classes: new Set<string>() }
    entry.lemmaIds.add(columns[1])
    entry.classes.add(classOfTag(columns[3] ?? ''))
    forms.set(word, entry)
  })
  return forms
}

// Returnerer kun ord som finnes i ordbanken med minst én trygg ordklasse.
export function buildWordInfo(wordList: ReadonlySet<string>, fullformsText: string, lemmasText: string, compoundsText: string): Map<string, WordInfo> {
  const lemmaNames = parseLemmas(lemmasText)
  const productivity = parseCompoundProductivity(compoundsText)
  const info = new Map<string, WordInfo>()
  for (const [word, entry] of parseFullforms(fullformsText, wordList)) {
    const classes = [...entry.classes]
    if (!classes.some(wordClass => SAFE_CLASSES.has(wordClass))) continue
    const lemmas = [...new Set([...entry.lemmaIds].flatMap(id => lemmaNames.get(id)?.toLowerCase() ?? []))]
    const score = Math.max(0, productivity.get(word) ?? 0, ...lemmas.map(lemma => productivity.get(lemma) ?? 0))
    info.set(word, { lemmas, classes, productivity: score })
  }
  return info
}
