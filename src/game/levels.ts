import type { Puzzle } from './puzzle.ts'
import manifestJson from '../../data/levels.v1.json'

export interface LevelTask {
  id: string
  puzzle: Puzzle
}

export interface Level {
  band: number
  name: string
  seedLength: number
  tasks: LevelTask[]
}

export interface LevelManifest {
  version: number
  wordsPerTask: number
  levels: Level[]
}

export const manifest = manifestJson as unknown as LevelManifest
export const MANIFEST_VERSION = manifest.version
export const WORDS_PER_TASK = manifest.wordsPerTask
export const levels = manifest.levels

export interface TaskLocation {
  task: LevelTask
  level: Level
  levelIndex: number
  indexInLevel: number
  overallIndex: number
}

export const orderedTasks: TaskLocation[] = manifest.levels
  .flatMap((level, levelIndex) => level.tasks.map((task, indexInLevel) => ({ task, level, levelIndex, indexInLevel })))
  .map((location, overallIndex) => ({ ...location, overallIndex }))

export const TASK_IDS: readonly string[] = orderedTasks.map(location => location.task.id)
export const TOTAL_TASKS = orderedTasks.length
export const TOTAL_WORDS = TOTAL_TASKS * WORDS_PER_TASK

const locationById = new Map(orderedTasks.map(location => [location.task.id, location]))

export function findTask(taskId: string): TaskLocation | undefined {
  return locationById.get(taskId)
}
