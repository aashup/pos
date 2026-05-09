import { ipcMain, webContents } from 'electron'
import { TokenStore } from '../auth/TokenStore'
import { ItemRepository } from '../db/repositories/ItemRepository'
import { TableRepository } from '../db/repositories/TableRepository'
import { runSync, getSyncStatus } from '../sync/SyncEngine'
import { printReceipt, printKOT, type ReceiptData, type KOTData } from '../print/ThermalPrinter'

export function registerIpcHandlers(): void {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:token:get', () => TokenStore.getToken())
  ipcMain.handle('auth:token:set', (_, token: string) => TokenStore.setToken(token))
  ipcMain.handle('auth:token:clear', () => TokenStore.clearToken())
  ipcMain.handle('auth:device-id', () => TokenStore.getDeviceId())

  // ── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key: string) => TokenStore.getSetting(key))
  ipcMain.handle('settings:set', (_, key: string, value: string) => TokenStore.setSetting(key, value))
  ipcMain.handle('settings:delete', (_, key: string) => TokenStore.deleteSetting(key))

  // ── Items ─────────────────────────────────────────────────────────────────
  ipcMain.handle('items:search', (_, query: string, groupId?: string) =>
    ItemRepository.search(query, groupId),
  )
  ipcMain.handle('items:groups', () => ItemRepository.getGroups())

  // ── Tables ────────────────────────────────────────────────────────────────
  ipcMain.handle('tables:get-all', () => TableRepository.getAll())
  ipcMain.handle('tables:floor-plans', () => TableRepository.getFloorPlans())

  // ── Sync ──────────────────────────────────────────────────────────────────
  ipcMain.handle('sync:trigger', () => runSync())
  ipcMain.handle('sync:status', () => getSyncStatus())

  // ── Print ─────────────────────────────────────────────────────────────────
  ipcMain.handle('print:receipt', (_, data: ReceiptData) => printReceipt(data))
  ipcMain.handle('print:kot', (_, data: KOTData) => printKOT(data))

  // List printers via renderer's webContents (which has access to OS printers)
  ipcMain.handle('print:list-printers', async (event) => {
    try {
      const wc = event.sender
      const printers = await wc.getPrintersAsync()
      return printers.map((p) => p.name)
    } catch {
      return []
    }
  })
}
