import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Server, UtensilsCrossed, Sun, Moon } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { ipc } from '../../bridge/ipc'
import { cn } from '../../lib/utils'

type Step = 'server' | 'done'

export default function SetupWizard() {
  const navigate = useNavigate()
  const { setServerUrl } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [step, setStep] = useState<Step>('server')
  const [serverUrl, setServerUrlLocal] = useState('http://localhost:8001')
  const [testing, setTesting] = useState(false)

  const testAndSave = async () => {
    const url = serverUrl.replace(/\/$/, '')
    setTesting(true)
    try {
      await axios.get(`${url}/api/v1/health`, { timeout: 5000 })
      setServerUrl(url)
      await ipc.settings.set('serverUrl', url)
      toast.success('Connected successfully!')
      setStep('done')
    } catch {
      toast.error('Cannot reach server. Check the URL and try again.')
    } finally {
      setTesting(false)
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
          <p className={cn('mt-1 text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>First-time setup</p>
        </div>

        {step === 'server' && (
          <div className={cn('space-y-4 rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
            <div className={cn('flex items-center gap-2 mb-2 font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
              <Server className="w-4 h-4" />
              <span>Server URL</span>
            </div>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrlLocal(e.target.value)}
              className={cn('w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900')}
              placeholder="http://your-server.com"
              autoFocus
            />
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-600')}>
              Enter the URL of your Zazzy POS backend server.
            </p>
            <button
              onClick={testAndSave}
              disabled={testing || !serverUrl}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Test & Continue
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className={cn('text-center space-y-4 rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
            <p className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>Server connected!</p>
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>Your POS is ready to use.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg py-2.5 transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
