import { useState, useEffect } from 'react'
import { Printer, RefreshCw, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ipc } from '../../bridge/ipc'
import { useThemeStore } from '../../store/themeStore'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'

export default function PrinterSettings() {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [printers, setPrinters]         = useState<string[]>([])
  const [loadingPrinters, setLoading]   = useState(false)
  const [printerName, setPrinterName]   = useState('')
  const [kotPrinter, setKotPrinter]     = useState('')
  const [paperWidth, setPaperWidth]     = useState('80')
  const [kotPaperWidth, setKotPaperWidth] = useState('80')
  const [saved, setSaved]               = useState(false)

  useEffect(() => {
    Promise.all([
      ipc.settings.get('printerName'),
      ipc.settings.get('kotPrinterName'),
      ipc.settings.get('paperWidth'),
      ipc.settings.get('kotPaperWidth'),
    ]).then(([p, k, w, kw]) => {
      if (p) setPrinterName(p)
      if (k) setKotPrinter(k)
      if (w) setPaperWidth(w)
      if (kw) setKotPaperWidth(kw)
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
      ipc.settings.set('kotPaperWidth', kotPaperWidth),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toast.success('Printer settings saved')
  }

  const testPrint = async () => {
    if (!printerName) { toast.error('Select a printer first'); return }
    await ipc.settings.set('printerName', printerName)
    await ipc.settings.set('paperWidth', paperWidth)
    const w = paperWidth === '58' ? '58mm' : '80mm'
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:${paperWidth==='58'?'9px':'11px'};width:${w};padding:6px}
.center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:4px 0}
@media print{@page{margin:0;size:${w} auto}body{width:auto}}</style></head><body>
<div class="center bold" style="font-size:14px">Test Restaurant</div>
<div class="center">123 Test Street</div>
<div class="line"></div>
<div>Invoice: TEST-00001</div>
<div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
<div>Type: Takeaway</div>
<div class="line"></div>
<div style="display:flex;justify-content:space-between"><span class="bold">Test Item x1</span><span>₹100.00</span></div>
<div class="line"></div>
<div style="display:flex;justify-content:space-between"><span>CGST 2.5%</span><span>₹2.38</span></div>
<div style="display:flex;justify-content:space-between"><span>SGST 2.5%</span><span>₹2.38</span></div>
<div style="display:flex;justify-content:space-between" class="bold"><span>TOTAL</span><span>₹100.00</span></div>
<div class="line"></div>
<div class="center" style="margin-top:6px">Thank you! Visit again.</div>
</body></html>`
    try {
      const result = await ipc.print.htmlInvoice(html, false)
      if (result.success) toast.success('Test receipt sent to printer!')
      else toast.error(result.error ?? 'Print failed')
    } catch (err) {
      toast.error(`Print error: ${String(err)}`)
    }
  }

  const testKotPrint = async () => {
    const targetPrinter = kotPrinter || printerName
    if (!targetPrinter) { toast.error('Select a printer first'); return }
    await ipc.settings.set('kotPrinterName', targetPrinter)
    await ipc.settings.set('kotPaperWidth', kotPaperWidth)
    const w = kotPaperWidth === '58' ? '58mm' : '80mm'
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:${kotPaperWidth==='58'?'9px':'13px'};width:${w};padding:8px}
.center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:4px 0}.note{font-size:11px;margin-left:8px}
@media print{@page{margin:0;size:${w} auto}body{width:auto}}</style></head><body>
<div class="center bold" style="font-size:18px">KOT</div>
<div class="center">#TEST-001</div>
<div class="line"></div>
<div>Dine In — Table 1</div>
<div>${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
<div class="line"></div>
<div class="bold">2x  Butter Chicken</div>
<div class="note">↳ Less spicy</div>
<div class="bold">4x  Naan</div>
<div class="line"></div>
</body></html>`
    try {
      const result = await ipc.print.htmlKot(html, false)
      if (result.success) toast.success('Test KOT sent to printer!')
      else toast.error(result.error ?? 'KOT print failed')
    } catch (err) {
      toast.error(`KOT print error: ${String(err)}`)
    }
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title="Printer Settings" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Load printers */}
        <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}> Available Printers</h3>
            <button
              onClick={loadPrinters}
              disabled={loadingPrinters}
              className={cn('flex items-center gap-1.5 text-xs font-medium', isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
              Detect Printers
            </button>
          </div>
          {printers.length === 0 ? (
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Click "Detect Printers" to load installed printers.</p>
          ) : (
            <div className="space-y-1">
              {printers.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPrinterName(p); if (!kotPrinter) setKotPrinter(p) }}
                  className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors',
                    printerName === p
                      ? isDark ? 'border-orange-500 bg-orange-900 text-orange-200' : 'border-orange-500 bg-orange-50 text-orange-700'
                      : isDark ? 'border-gray-700 text-gray-300 hover:border-gray-600' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  )}
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
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Receipt Printer</h3>
          <div>
            <label className={cn('text-xs block mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Printer Name</label>
            <input
              type="text"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="e.g. EPSON TM-T82"
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
            />
          </div>
          <div>
            <label className={cn('text-xs block mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Paper Width</label>
            <div className="flex gap-2">
              {['58', '80'].map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                    paperWidth === w
                      ? isDark ? 'border-orange-500 bg-orange-900 text-orange-200' : 'border-orange-500 bg-orange-50 text-orange-700'
                      : isDark ? 'border-gray-700 text-gray-300 hover:border-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KOT printer */}
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>KOT Printer</h3>
          <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Separate printer for kitchen tickets. Leave blank to use the receipt printer.</p>
          <div>
            <label className={cn('text-xs block mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>KOT Printer Name</label>
            <input
              type="text"
              value={kotPrinter}
              onChange={(e) => setKotPrinter(e.target.value)}
              placeholder="Same as receipt printer"
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
            />
          </div>
          <div>
            <label className={cn('text-xs block mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>KOT Paper Width</label>
            <div className="flex gap-2">
              {['58', '80'].map((w) => (
                <button
                  key={w}
                  onClick={() => setKotPaperWidth(w)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                    kotPaperWidth === w
                      ? isDark ? 'border-orange-500 bg-orange-900 text-orange-200' : 'border-orange-500 bg-orange-50 text-orange-700'
                      : isDark ? 'border-gray-700 text-gray-300 hover:border-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={testPrint}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border', isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:border-gray-300')}
          >
            <Printer className="w-4 h-4" />
            Test Receipt
          </button>
          <button
            onClick={testKotPrint}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border', isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:border-gray-300')}
          >
            <Printer className="w-4 h-4" />
            Test KOT
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
