import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Server, UtensilsCrossed } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { ipc } from '../../bridge/ipc'

type Step = 'server' | 'done'

export default function SetupWizard() {
  const navigate = useNavigate()
  const { setServerUrl } = useAuthStore()
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Zazzy POS</h1>
          <p className="text-gray-400 mt-1 text-sm">First-time setup</p>
        </div>

        {step === 'server' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-300 mb-2">
              <Server className="w-4 h-4" />
              <span className="font-medium">Server URL</span>
            </div>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrlLocal(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="http://your-server.com"
              autoFocus
            />
            <p className="text-xs text-gray-500">
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
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
            <p className="text-white font-semibold text-lg">Server connected!</p>
            <p className="text-gray-400 text-sm">Your POS is ready to use.</p>
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
