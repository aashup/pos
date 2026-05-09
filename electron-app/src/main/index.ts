import { app, BrowserWindow, shell, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { TokenStore } from './auth/TokenStore'
import { initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/ipcHandlers'
import { SyncScheduler } from './sync/SyncScheduler'

let mainWindow: BrowserWindow | null = null
let kitchenWindow: BrowserWindow | null = null

// ── Window factory ────────────────────────────────────────────────────────────

function loadRoute(win: BrowserWindow, route: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  const token     = TokenStore.getToken()
  const serverUrl = TokenStore.getSetting('serverUrl')
  const startRoute = !serverUrl ? '/setup' : !token ? '/login' : '/pos/billing'
  loadRoute(mainWindow, startRoute)
}

function createKitchenWindow(): void {
  if (kitchenWindow && !kitchenWindow.isDestroyed()) {
    kitchenWindow.focus()
    return
  }

  // Place on second display if available
  const displays  = screen.getAllDisplays()
  const secondary = displays.find((d) => d.id !== screen.getPrimaryDisplay().id)
  const bounds    = secondary?.bounds ?? { x: 100, y: 100, width: 1280, height: 720 }

  kitchenWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: !!secondary,
    show: false,
    autoHideMenuBar: true,
    title: 'Zazzy POS — Kitchen',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  kitchenWindow.on('ready-to-show', () => kitchenWindow!.show())
  kitchenWindow.on('closed', () => { kitchenWindow = null })

  loadRoute(kitchenWindow, '/kitchen')
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  // Check on start, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000)
}

// ── IPC: kitchen window control + updater ────────────────────────────────────

function registerWindowIpc(): void {
  ipcMain.handle('window:open-kitchen', () => {
    createKitchenWindow()
    return true
  })

  ipcMain.handle('window:close-kitchen', () => {
    kitchenWindow?.close()
    return true
  })

  ipcMain.handle('updater:install-now', () => {
    autoUpdater.quitAndInstall()
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.zazzy.pos')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  registerIpcHandlers()
  registerWindowIpc()
  createMainWindow()
  SyncScheduler.start()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  SyncScheduler.stop()
  if (process.platform !== 'darwin') app.quit()
})
