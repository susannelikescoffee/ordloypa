import { describe, expect, it } from 'vitest'
import { levels, TASK_IDS, TOTAL_TASKS } from '../src/game/levels.ts'
import {
  advanceGameProgress,
  createGameProgress,
  currentLevelIndex,
  isGameComplete,
  isLevelComplete,
  markTaskSolved,
  normalizeGameProgress,
  readGameProgress,
  saveGameProgress,
  solvedCountInLevel,
} from '../src/game/progression.ts'

const first = TASK_IDS[0]
const second = TASK_IDS[1]

describe('Campaign progression', () => {
  it('starts at the first task across six levels of sixty tasks', () => {
    const progress = createGameProgress()
    expect(TASK_IDS).toHaveLength(60)
    expect(TOTAL_TASKS).toBe(60)
    expect(levels).toHaveLength(6)
    expect(progress.currentTaskId).toBe(first)
    expect(isGameComplete(progress)).toBe(false)
    expect(currentLevelIndex(progress)).toBe(0)
  })

  it('counts a solved task once and advances to a new task', () => {
    const solved = markTaskSolved(createGameProgress(), first)
    const repeated = markTaskSolved(solved, first)
    const next = advanceGameProgress(repeated)

    expect(repeated.solvedTaskIds).toEqual([first])
    expect(next.currentTaskId).toBe(second)
    expect(next.solvedTaskIds).toHaveLength(1)
  })

  it('does not award give-ups and retries skipped tasks after unseen tasks', () => {
    let progress = advanceGameProgress(createGameProgress(), true)
    expect(progress.currentTaskId).toBe(second)
    expect(progress.solvedTaskIds).toEqual([])
    expect(progress.skippedTaskIds).toEqual([first])

    for (const taskId of TASK_IDS.slice(1)) {
      progress = markTaskSolved({ ...progress, currentTaskId: taskId }, taskId)
      progress = advanceGameProgress(progress)
    }

    expect(progress.solvedTaskIds).toHaveLength(TOTAL_TASKS - 1)
    expect(progress.currentTaskId).toBe(first)
    expect(progress.skippedTaskIds).toEqual([])
    progress = markTaskSolved(progress, first)
    expect(isGameComplete(progress)).toBe(true)
    expect(advanceGameProgress(progress)).toBe(progress)
  })

  it('tracks progress and completion per level', () => {
    const levelOneIds = levels[0].tasks.map(task => task.id)
    let progress = createGameProgress()
    for (const taskId of levelOneIds) progress = markTaskSolved(progress, taskId)

    expect(solvedCountInLevel(progress, 0)).toBe(10)
    expect(isLevelComplete(progress, 0)).toBe(true)
    expect(isLevelComplete(progress, 1)).toBe(false)
    expect(solvedCountInLevel(progress, 1)).toBe(0)
  })
})

describe('Soft migration and sanitizing', () => {
  it('keeps known task IDs and discards unknown ones regardless of stored version', () => {
    const migrated = normalizeGameProgress({
      version: 1,
      puzzleSetVersion: 1,
      manifestVersion: 99,
      currentTaskId: 'easy-01',
      solvedTaskIds: ['easy-01', 'easy-02', first],
      skippedTaskIds: ['easy-03', TASK_IDS[3]],
      currentStreak: 3,
      bestStreak: 5,
    })
    expect(migrated.solvedTaskIds).toEqual([first])
    expect(migrated.skippedTaskIds).toEqual([TASK_IDS[3]])
    expect(migrated.currentStreak).toBe(3)
    expect(migrated.bestStreak).toBe(5)
    // Ukjent currentTaskId faller tilbake til første uløste oppgave.
    expect(migrated.currentTaskId).toBe(second)
  })

  it('recovers from non-object data and sanitizes duplicate or overlapping IDs', () => {
    expect(normalizeGameProgress(null)).toEqual(createGameProgress())
    expect(normalizeGameProgress('oops')).toEqual(createGameProgress())

    const sanitized = normalizeGameProgress({
      currentTaskId: TASK_IDS[2],
      solvedTaskIds: [first, first, 'unknown'],
      skippedTaskIds: [first, second, 'unknown'],
    })
    expect(sanitized.solvedTaskIds).toEqual([first])
    expect(sanitized.skippedTaskIds).toEqual([second])
    expect(sanitized.currentTaskId).toBe(TASK_IDS[2])
  })

  it('persists progress and falls back safely when storage is unavailable or corrupt', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const solved = markTaskSolved(createGameProgress(), first)

    expect(saveGameProgress(solved, storage)).toBe(true)
    expect(readGameProgress(storage)).toEqual(solved)

    const corruptStorage = { getItem: () => '{bad json', setItem: () => { throw new Error('Unavailable') } }
    expect(readGameProgress(corruptStorage)).toEqual(createGameProgress())
    expect(saveGameProgress(solved, corruptStorage)).toBe(false)
  })
})

describe('Streak', () => {
  it('starts at zero', () => {
    const progress = createGameProgress()
    expect(progress.currentStreak).toBe(0)
    expect(progress.bestStreak).toBe(0)
  })

  it('grows by one per solved task and tracks the best streak', () => {
    let progress = markTaskSolved(createGameProgress(), first)
    expect(progress.currentStreak).toBe(1)
    expect(progress.bestStreak).toBe(1)

    progress = advanceGameProgress(progress)
    progress = markTaskSolved(progress, second)
    expect(progress.currentStreak).toBe(2)
    expect(progress.bestStreak).toBe(2)
  })

  it('does not increase the streak when re-solving the same task', () => {
    const solved = markTaskSolved(createGameProgress(), first)
    const repeated = markTaskSolved(solved, first)
    expect(repeated.currentStreak).toBe(1)
    expect(repeated.bestStreak).toBe(1)
  })

  it('resets the current streak on give-up but keeps the best', () => {
    let progress = markTaskSolved(createGameProgress(), first)
    progress = advanceGameProgress(progress)
    progress = markTaskSolved(progress, second)
    expect(progress.currentStreak).toBe(2)

    const gaveUp = advanceGameProgress(progress, true)
    expect(gaveUp.currentStreak).toBe(0)
    expect(gaveUp.bestStreak).toBe(2)

    const resumed = markTaskSolved(gaveUp, gaveUp.currentTaskId)
    expect(resumed.currentStreak).toBe(1)
    expect(resumed.bestStreak).toBe(2)
  })

  it('keeps the streak when advancing after a normal solve', () => {
    let progress = markTaskSolved(createGameProgress(), first)
    progress = advanceGameProgress(progress, false)
    expect(progress.currentStreak).toBe(1)
  })

  it('normalizes missing, negative, non-numeric or oversized streak values', () => {
    const fromOldSave = normalizeGameProgress({ currentTaskId: first, solvedTaskIds: [], skippedTaskIds: [] })
    expect(fromOldSave.currentStreak).toBe(0)
    expect(fromOldSave.bestStreak).toBe(0)

    const sanitized = normalizeGameProgress({ currentTaskId: first, currentStreak: -5, bestStreak: 999 })
    expect(sanitized.currentStreak).toBe(0)
    expect(sanitized.bestStreak).toBe(TOTAL_TASKS)

    const nonNumeric = normalizeGameProgress({ currentTaskId: first, currentStreak: 'mange', bestStreak: Number.NaN })
    expect(nonNumeric.currentStreak).toBe(0)
    expect(nonNumeric.bestStreak).toBe(0)
  })

  it('keeps the best streak at least as high as the current streak', () => {
    const sanitized = normalizeGameProgress({ currentTaskId: first, currentStreak: 4, bestStreak: 2 })
    expect(sanitized.currentStreak).toBe(4)
    expect(sanitized.bestStreak).toBe(4)
  })
})
