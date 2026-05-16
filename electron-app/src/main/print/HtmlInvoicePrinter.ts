import { BrowserWindow } from 'electron'
import { TokenStore } from '../auth/TokenStore'

// paper width in mm → microns (Electron pageSize unit)
function paperWidthMicrons(settingKey: string): number {
  const val = TokenStore.getSetting(settingKey)
  return val === '58' ? 58000 : 80000
}

async function printWithPrinter(
  html: string,
  printerName: string,
  silent = true,
  widthMicrons = 80000,
): Promise<{ success: boolean; error?: string }> {

  let win: BrowserWindow | null = null
  try {
    win = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    await new Promise<void>((resolve, reject) => {
      if (!win) return reject(new Error('Window destroyed'))

      const printOptions: Electron.WebContentsPrintOptions = {
        silent,
        printBackground: true,
        // 1 000 000 µm tall = 1 m — enough for any receipt; content height controls actual cut
        pageSize: { width: widthMicrons, height: 1000000 },
        ...(printerName ? { deviceName: printerName } : {}),
      }

      win.webContents.print(printOptions, (success, failureReason) => {
        if (success) resolve()
        else reject(new Error(failureReason ?? 'Print failed'))
      })
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  } finally {
    if (win && !win.isDestroyed()) win.destroy()
  }
}

export async function printHtmlInvoice(
  html: string,
  silent = true,
): Promise<{ success: boolean; error?: string }> {
  return printWithPrinter(
    html,
    TokenStore.getSetting('printerName') ?? '',
    silent,
    paperWidthMicrons('paperWidth'),
  )
}

export async function printHtmlKot(
  html: string,
  silent = true,
): Promise<{ success: boolean; error?: string }> {
  const kotPrinter = TokenStore.getSetting('kotPrinterName') ?? TokenStore.getSetting('printerName') ?? ''
  const widthKey   = TokenStore.getSetting('kotPaperWidth') ? 'kotPaperWidth' : 'paperWidth'
  return printWithPrinter(html, kotPrinter, silent, paperWidthMicrons(widthKey))
}
