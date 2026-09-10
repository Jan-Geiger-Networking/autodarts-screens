import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  // externalizeDepsPlugin haelt die Abhaengigkeiten aus dem Buendel heraus,
  // statt sie hineinzuziehen: electron-updater laedt seine Anbieter (GitHub,
  // generic, ...) zur Laufzeit per require nach, was ein Buendel nicht
  // aufloesen kann. Dafuer liegt node_modules im Installer (siehe "files" in
  // package.json).
  main: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          control: resolve('src/renderer/control/index.html'),
          player: resolve('src/renderer/player/index.html'),
          spectator: resolve('src/renderer/spectator/index.html'),
        },
      },
    },
  },
})
