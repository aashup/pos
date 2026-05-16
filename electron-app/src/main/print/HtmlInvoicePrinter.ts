import { BrowserWindow } from 'electron'
import { TokenStore } from '../auth/TokenStore'

export async function printHtmlInvoice(
  html: string,
): Promise<{ success: boolean; error?: string }> {
  const printerName = TokenStore.getSetting('printerName') ?? ''

  let win: BrowserWindow | null = null
  try {
    win = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      webPreferences: {
        // No node integration needed — just rendering static HTML
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    // data: URI loads instantly without a round-trip; no network required
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    await new Promise<void>((resolve, reject) => {
      if (!win) return reject(new Error('Window destroyed'))

      const printOptions: Electron.WebContentsPrintOptions = {
        silent: true,
        printBackground: true,
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
    // Always clean up — even if print threw
    if (win && !win.isDestroyed()) win.destroy()
  }
}
