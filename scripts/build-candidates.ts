import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { buildPuzzle, parseDictionary } from '../src/game/puzzle.ts'
import { buildWordInfo } from './lib/ordbank.ts'
import { BANDS, formatReviewSheet, parseBlocklist, selectCandidates } from './lib/candidates.ts'

const data = new URL('../data/', import.meta.url)
const read = (path: string, encoding: BufferEncoding = 'latin1') => readFileSync(new URL(path, data), encoding)

const perBandArgument = process.argv.indexOf('--per-band')
const perBand = perBandArgument > 0 ? Number(process.argv[perBandArgument + 1]) : 20
if (!Number.isInteger(perBand) || perBand < 1) throw new Error('--per-band må være et positivt heltall')

const wordList = parseDictionary(read('word-list.txt', 'utf8'))
const info = buildWordInfo(wordList, read('inspection/fullformsliste.txt'), read('inspection/lemma.txt'), read('inspection/leddanalyse.txt'))
const blockedPath = new URL('curation/blokkliste.txt', data)
const blocked = existsSync(blockedPath) ? parseBlocklist(readFileSync(blockedPath, 'utf8')) : new Set<string>()

// Vanlige ord foretrekkes som kryssord når brettet bygges.
const common = new Set([...info].filter(([, details]) => details.productivity >= 50).map(([word]) => word))
const candidates = selectCandidates(info, { perBand, blocked, build: (seed, pool) => buildPuzzle(seed, pool, 0, common) })

mkdirSync(new URL('curation/', data), { recursive: true })
writeFileSync(new URL('curation/kandidater.txt', data), formatReviewSheet(candidates, info))

console.log(`Ordliste ${wordList.size}, trygge ord i ordbanken ${info.size}, blokkerte ${blocked.size}`)
candidates.forEach((group, index) => console.log(`${BANDS[index].name}: ${group.length}/${perBand} kandidater`))
console.log('Skrev data/curation/kandidater.txt')
