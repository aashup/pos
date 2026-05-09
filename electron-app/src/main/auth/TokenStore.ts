import Store from 'electron-store'
import { safeStorage } from 'electron'
import { v4 as uuidv4 } from 'uuid'

const store = new Store<Record<string, string>>()

export const TokenStore = {
  getToken(): string | null {
    const encrypted = store.get('encryptedToken')
    if (!encrypted) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
      }
      return encrypted
    } catch {
      return null
    }
  },

  setToken(token: string): void {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token).toString('base64')
        store.set('encryptedToken', encrypted)
      } else {
        store.set('encryptedToken', token)
      }
    } catch {
      store.set('encryptedToken', token)
    }
  },

  clearToken(): void {
    store.delete('encryptedToken')
  },

  getDeviceId(): string {
    let deviceId = store.get('deviceId')
    if (!deviceId) {
      deviceId = uuidv4()
      store.set('deviceId', deviceId)
    }
    return deviceId
  },

  getSetting(key: string): string | null {
    return store.get(key) ?? null
  },

  setSetting(key: string, value: string): void {
    store.set(key, value)
  },

  deleteSetting(key: string): void {
    store.delete(key)
  },
}
