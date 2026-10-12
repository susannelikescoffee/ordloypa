import { findTask, levels, MANIFEST_VERSION, TASK_IDS, TOTAL_TASKS } from './levels.ts'

const progressStorageKey = 'susannes-ordspill.progress'
const progressVersion = 2

export interface GameProgress {
  version: number
  manifestVersion: number
  currentTaskId: string
  solvedTaskIds: string[]
  skippedTaskIds: string[]
  currentStreak: number
  bestStreak: number
}

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>

const validTaskId = new Set(TASK_IDS)

export function createGameProgress(): GameProgress {
  return {
    version: progressVersion,
    manifestVersion: MANIFEST_VERSION,
    currentTaskId: TASK_IDS[0],
    solvedTaskIds: [],
    skippedTaskIds: [],
    currentStreak: 0,
    bestStreak: 0,
  }
}

function isKnownTaskId(value: unknown): value is string {
  return typeof value === 'string' && validTaskId.has(value)
}

function knownTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isKnownTaskId))]
}

function clampStreak(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.floor(value), 0), TOTAL_TASKS)
}

function firstUnsolved(solvedTaskIds: readonly string[]): string {
  return TASK_IDS.find(taskId => !solvedTaskIds.includes(taskId)) ?? TASK_IDS[0]
}

// Myk migrering: behold task-ID-er som fortsatt finnes i manifestet, uansett lagret versjon.
// Ukjente ID-er (gamle oppgaver eller fjernet innhold) forkastes stille, resten av framgangen beholdes.
export function normalizeGameProgress(value: unknown): GameProgress {
  if (!value || typeof value !== 'object') return createGameProgress()
  const record = value as Record<string, unknown>

  const solvedTaskIds = knownTaskIds(record.solvedTaskIds)
  const currentTaskId = isKnownTaskId(record.currentTaskId) ? record.currentTaskId : firstUnsolved(solvedTaskIds)
  const skippedTaskIds = knownTaskIds(record.skippedTaskIds).filter(taskId =>
    !solvedTaskIds.includes(taskId) && taskId !== currentTaskId,
  )
  const currentStreak = clampStreak(record.currentStreak)
  const bestStreak = Math.max(currentStreak, clampStreak(record.bestStreak))
  return {
    version: progressVersion,
    manifestVersion: MANIFEST_VERSION,
    currentTaskId,
    solvedTaskIds,
    skippedTaskIds,
    currentStreak,
    bestStreak,
  }
}

export function readGameProgress(storage?: ProgressStorage): GameProgress {
  try {
    const saved = (storage ?? window.localStorage).getItem(progressStorageKey)
    return saved ? normalizeGameProgress(JSON.parse(saved)) : createGameProgress()
  } catch {
    return createGameProgress()
  }
}

export function saveGameProgress(progress: GameProgress, storage?: ProgressStorage): boolean {
  try {
    ;(storage ?? window.localStorage).setItem(progressStorageKey, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

export function markTaskSolved(progress: GameProgress, taskId: string): GameProgress {
  if (!isKnownTaskId(taskId) || progress.solvedTaskIds.includes(taskId)) return progress
  const currentStreak = Math.min(progress.currentStreak + 1, TOTAL_TASKS)
  return {
    ...progress,
    solvedTaskIds: [...progress.solvedTaskIds, taskId],
    skippedTaskIds: progress.skippedTaskIds.filter(skippedId => skippedId !== taskId),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
  }
}

export function advanceGameProgress(progress: GameProgress, giveUpCurrent = false): GameProgress {
  if (isGameComplete(progress)) return progress

  const currentStreak = giveUpCurrent ? 0 : progress.currentStreak
  const skippedTaskIds = [...progress.skippedTaskIds]
  if (giveUpCurrent && !progress.solvedTaskIds.includes(progress.currentTaskId) && !skippedTaskIds.includes(progress.currentTaskId)) {
    skippedTaskIds.push(progress.currentTaskId)
  }

  const nextUnseen = TASK_IDS.find(taskId =>
    taskId !== progress.currentTaskId &&
    !progress.solvedTaskIds.includes(taskId) &&
    !skippedTaskIds.includes(taskId),
  )
  if (nextUnseen) return { ...progress, currentTaskId: nextUnseen, skippedTaskIds, currentStreak }

  const [retryTask, ...remainingSkipped] = skippedTaskIds
  if (retryTask) return { ...progress, currentTaskId: retryTask, skippedTaskIds: remainingSkipped, currentStreak }
  return { ...progress, skippedTaskIds, currentStreak }
}

export function isGameComplete(progress: GameProgress): boolean {
  return progress.solvedTaskIds.length === TOTAL_TASKS
}

export function currentLevelIndex(progress: GameProgress): number {
  return findTask(progress.currentTaskId)?.levelIndex ?? 0
}

export function solvedCountInLevel(progress: GameProgress, levelIndex: number): number {
  const ids = new Set(levels[levelIndex]?.tasks.map(task => task.id))
  return progress.solvedTaskIds.filter(taskId => ids.has(taskId)).length
}

export function isLevelComplete(progress: GameProgress, levelIndex: number): boolean {
  const level = levels[levelIndex]
  return !!level && level.tasks.every(task => progress.solvedTaskIds.includes(task.id))
}
