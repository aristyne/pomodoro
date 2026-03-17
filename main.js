const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const configPath = path.join(app.getPath('userData'), 'config.json')

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    // default config
    return {
      theme: 'softLavender',
      sessionMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      sessionsPerCycle: 4,
      sound: true,
      notifications: true,
      autoStartNext: true
    }
  }
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg))
  } catch (e) {
    console.error('Error writing config', e)
  }
}

let win

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 520,
    minWidth: 420,
    minHeight: 520,
    frame: false, // frameless for custom chrome
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('index.html')
  win.setMenu(null)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

ipcMain.handle('get-config', () => readConfig())
ipcMain.handle('set-config', (event, cfg) => {
  const current = readConfig()
  const next = { ...current, ...cfg }
  writeConfig(next)
  return next
})
ipcMain.handle('close-window', () => {
  if (win) win.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
