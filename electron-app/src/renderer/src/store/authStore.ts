import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  serverUrl: string
  setAuth: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: User) => void
  setServerUrl: (url: string) => void
}

export const useAuthStore = create<AuthState>((set) => {
  const storedUser = localStorage.getItem('user')
  const storedToken = localStorage.getItem('token')
  const storedServerUrl = localStorage.getItem('serverUrl') || ''

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,
    serverUrl: storedServerUrl,

    setAuth: (user, token) => {
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('token', token)
      set({ user, token, isAuthenticated: true })
    },

    logout: () => {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      set({ user: null, token: null, isAuthenticated: false })
      window.location.hash = '/login'
    },

    updateUser: (user) => {
      localStorage.setItem('user', JSON.stringify(user))
      set({ user })
    },

    setServerUrl: (url) => {
      localStorage.setItem('serverUrl', url)
      set({ serverUrl: url })
    },
  }
})
