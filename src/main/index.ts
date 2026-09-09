import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function control() {
  const fenster = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#020617',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    fenster.loadURL(`${process.env.ELECTRON_RENDERER_URL}/control/index.html`)
  } else {
    fenster.loadFile(join(import.meta.dirname, '../renderer/control/index.html'))
  }
}

app.whenReady().then(control)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
