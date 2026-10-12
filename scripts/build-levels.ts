import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { buildPuzzle, parseDictionary } from '../src/game/puzzle.ts'
import { buildWordInfo } from './lib/ordbank.ts'
import { BANDS, parseBlocklist, selectCandidates, WORDS_PER_PUZZLE } from './lib/candidates.ts'
import { buildManifest, LEVEL_MANIFEST_VERSION, selectFrozen } from './lib/levels.ts'

const data = new URL('../data/', import.meta.url)
const read = (path: string, encoding: BufferEncoding = 'latin1') => readFileSync(new URL(path, data), encoding)

const TASKS_PER_BAND = 10
// Samme pool som gjennomgangsarket (20 per trinn), slik at de frosne oppgavene er en delmengde Susanne og Nuffa har sett.
const REVIEW_POOL_PER_BAND = 20

const wordList = parseDictionary(read('word-list.txt', 'utf8'))
const info = buildWordInfo(wordList, read('inspection/fullformsliste.txt'), read('inspection/lemma.txt'), read('inspection/leddanalyse.txt'))
const blockedPath = new URL('curation/blokkliste.txt', data)
const blocked = existsSync(blockedPath) ? parseBlocklist(readFileSync(blockedPath, 'utf8')) : new Set<string>()

const common = new Set([...info].filter(([, details]) => details.productivity >= 50).map(([word]) => word))
const candidates = selectCandidates(info, { perBand: REVIEW_POOL_PER_BAND, blocked, build: (seed, pool) => buildPuzzle(seed, pool, 0, common) })

// Frøord Nuffa flagget som for ukjente for barn i gjennomgangen 2026-10-11. Havner sist ved frysing.
const deprioritize = new Set(['skolt', 'flask', 'anbud', 'aksje', 'leing', 'artium', 'aksjon', 'auking', 'skuing', 'fusing', 'buling', 'tauing', 'kogger', 'vigsle', 'mispel'])
const frozen = selectFrozen(candidates, info, TASKS_PER_BAND, deprioritize)
const manifest = buildManifest(frozen, BANDS, WORDS_PER_PUZZLE)

const short = frozen.find(group => group.length < TASKS_PER_BAND)
if (short) throw new Error(`Et trinn har færre enn ${TASKS_PER_BAND} oppgaver etter frysing. Juster blokkliste eller trinn-terskler.`)

mkdirSync(data, { recursive: true })
writeFileSync(new URL(`levels.v${LEVEL_MANIFEST_VERSION}.json`, data), `${JSON.stringify(manifest, null, 2)}\n`)

const totalWords = manifest.levels.reduce((sum, level) => sum + level.tasks.length * manifest.wordsPerTask, 0)
manifest.levels.forEach(level => console.log(`${level.name}: ${level.tasks.length} oppgaver`))
console.log(`Skrev data/levels.v${LEVEL_MANIFEST_VERSION}.json (${totalWords} ord totalt)`)
