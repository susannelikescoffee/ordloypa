import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        game: resolve(projectRoot, 'game.html'),
        startVersion1: resolve(projectRoot, 'start_versjon1.html'),
      },
    },
  },
})