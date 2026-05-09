import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, UtensilsCrossed, Sun, Moon } from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { ipc } from '../../bridge/ipc'
import { cn } from '../../lib/utils'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    try {
      const deviceId = await ipc.auth.getDeviceId()
      const res = await authApi.login(email, password, `Zazzy POS ${deviceId.slice(0, 8)}`)
      const { token, user } = res.data.data

      setAuth(user, token)
      await ipc.auth.setToken(token)

      // Trigger initial sync after login
      ipc.sync.trigger().catch(() => {})

      navigate('/pos/billing')
    } catch {
      // Error handled by axios interceptor toast
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('min-h-screen flex items-center justify-center p-4', isDark ? 'bg-gray-950' : 'bg-gray-100')}>
      <div className="w-full max-w-sm">
        {/* Theme toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleTheme}
            className={cn('p-2 rounded-lg transition-colors', isDark ? 'bg-gray-900 text-yellow-400 hover:bg-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Zazzy POS</h1>
          <p className={cn('mt-1 text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className={cn('space-y-4 rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div>
            <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn('w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900')}
              placeholder="admin@example.com"
              autoFocus
              required
            />
          </div>

          <div>
            <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn('w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900')}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <button
          onClick={() => navigate('/setup')}
          className={cn('mt-6 w-full text-center text-sm transition-colors', isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-600 hover:text-gray-900')}
        >
          Change server settings
        </button>
      </div>
    </div>
  )
}
