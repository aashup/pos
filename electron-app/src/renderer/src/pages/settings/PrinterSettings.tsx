import { useState, useEffect } from 'react'
import { ArrowLeft, Printer, RefreshCw, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ipc } from '../../bridge/ipc'

export default function PrinterSettings() {
  const navigate = useNavigate()
  const [printers, setPrinters]         = useState<string[]>([])
  const [loadingPrinters, setLoading]   = useState(false)
  const [printerName, setPrinterName]   = useState('')
  const [kotPrinter, setKotPrinter]     = useState('')
  const [paperWidth, setPaperWidth]     = useState('80')
  const [saved, setSaved]               = useState(false)

  useEffect(() => {
    Promise.all([
      ipc.settings.get('printerName'),
      ipc.settings.get('kotPrinterName'),
      ipc.settings.get('paperWidth'),
    ]).then(([p, k, w]) => {
      if (p) setPrinterName(p)
      if (k) setKotPrinter(k)
      if (w) setPaperWidth(w)
    })
  }, [])

  const loadPrinters = async () => {
    setLoading(true)
    try {
      const list = await ipc.print.listPrinters()
      setPrinters(list)
      if (list.length === 0) toast('No printers found. Make sure a printer is connected.')
    } catch {
      toast.error('Failed to list printers')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    await Promise.all([
      ipc.settings.set('printerName', printerName),
      ipc.settings.set('kotPrinterName', kotPrinter || printerName),
      ipc.settings.set('paperWidth', paperWidth),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toast.success('Printer settings saved')
  }

  const testPrint = async () => {
    if (!printerName) { toast.error('Select a printer first'); return }
    const result = await ipc.print.receipt({
      outletName: 'Test Restaurant',
      outletAddress: '123 Test Street',
      invoiceNumber: 'TEST-00001',
      invoiceDate: new Date().toLocaleDateString('en-IN'),
      orderType: 'takeaway',
      items: [{ name: 'Test Item', quantity: 1, rate: 100, gstRate: 5, lineTotal: 100 }],
      subtotal: 95.24,
      cgst: 2.38,
      sgst: 2.38,
      discount: 0,
      grandTotal: 100,
      paymentMode: 'cash',
    })
    if (result.success) toast.success('Test print sent!')
    else toast.error(result.error ?? 'Print failed')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-orange-400 text-sm">Printer Settings</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Load printers */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Available Printers</h3>
            <button
              onClick={loadPrinters}
              disabled={loadingPrinters}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
              Detect Printers
            </button>
          </div>
          {printers.length === 0 ? (
            <p className="text-xs text-gray-400">Click "Detect Printers" to load installed printers.</p>
          ) : (
            <div className="space-y-1">
              {printers.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPrinterName(p); if (!kotPrinter) setKotPrinter(p) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    printerName === p
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5" />
                    {p}
                  </div>
                  {printerName === p && <CheckCircle className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Receipt printer */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Receipt Printer</h3>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Printer Name</label>
            <input
              type="text"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="e.g. EPSON TM-T82"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Paper Width</label>
            <div className="flex gap-2">
              {['58', '80'].map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    paperWidth === w
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KOT printer */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">KOT Printer</h3>
          <p className="text-xs text-gray-400">Separate printer for kitchen tickets. Leave blank to use the receipt printer.</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">KOT Printer Name</label>
            <input
              type="text"
              value={kotPrinter}
              onChange={(e) => setKotPrinter(e.target.value)}
              placeholder="Same as receipt printer"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={testPrint}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Test Print
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : null}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
