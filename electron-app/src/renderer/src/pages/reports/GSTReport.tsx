import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, todayLocalDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface RateRow {
  gst_rate: number
  taxable_amount: number
  cgst_total: number
  sgst_total: number
  igst_total: number
  total_tax: number
}

interface GSTData {
  date_from: string
  date_to: string
  by_rate: RateRow[]
  total_taxable: number
  total_cgst: number
  total_sgst: number
  total_igst: number
}

const PRESETS = [
  { label: 'Today',   days: 0  },
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
]

export default function GSTReport() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const today = todayLocalDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo]     = useState(today)
  const [applied, setApplied]   = useState({ from: today, to: today })

  const applyPreset = (days: number) => {
    if (days === 0) { setDateFrom(today); setDateTo(today); setApplied({ from: today, to: today }); return }
    const start = new Date(); start.setDate(start.getDate() - days + 1)
    const from  = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`
    setDateFrom(from); setDateTo(today); setApplied({ from, to: today })
  }

  const { data, isLoading } = useQuery<GSTData>({
    queryKey: ['gst-summary', applied.from, applied.to],
    queryFn: async () => {
      const res = await reportsApi.gstSummary({ date_from: applied.from, date_to: applied.to })
      return res.data?.data
    },
  })

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <header className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-orange-400 text-sm">GST Summary</span>
        </div>
        <button
          onClick={() => window.print()}
          className="text-gray-400 hover:text-white flex items-center gap-1 text-xs"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Filters */}
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className={cn('px-3 py-1.5 text-xs rounded-lg border font-medium', isDark ? 'border-gray-700 text-gray-300 hover:border-orange-400 hover:text-orange-400' : 'border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')} />
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-400')}>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')} />
            <button onClick={() => setApplied({ from: dateFrom, to: dateTo })}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Apply
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
        ) : !data ? null : (
          <>
            {/* Summary totals */}
            <div className="bg-orange-500 text-white rounded-xl p-4 grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xs opacity-80">Total Taxable</p>
                <p className="font-bold text-lg">{formatCurrency(data.total_taxable)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs opacity-80">Total Tax</p>
                <p className="font-bold text-lg">{formatCurrency(data.total_cgst + data.total_sgst + data.total_igst)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs opacity-80">CGST</p>
                <p className="font-semibold">{formatCurrency(data.total_cgst)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs opacity-80">SGST</p>
                <p className="font-semibold">{formatCurrency(data.total_sgst)}</p>
              </div>
            </div>

            {/* By GST rate */}
            {data.by_rate?.length > 0 && (
              <div className={cn('rounded-xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}>
                <div className={cn('px-4 py-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <h3 className={cn('font-semibold text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Tax Rate Breakup</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                    <tr>
                      <th className={cn('text-left px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>GST %</th>
                      <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Taxable</th>
                      <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>CGST</th>
                      <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>SGST</th>
                      <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Total</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', isDark ? 'divide-gray-800' : 'divide-gray-50')}>
                    {data.by_rate.map((row) => (
                      <tr key={row.gst_rate} className={isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}>
                        <td className={cn('px-4 py-2.5 font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{Number(row.gst_rate).toFixed(0)}%</td>
                        <td className={cn('px-4 py-2.5 text-right', isDark ? 'text-gray-400' : 'text-gray-600')}>{formatCurrency(row.taxable_amount)}</td>
                        <td className={cn('px-4 py-2.5 text-right', isDark ? 'text-gray-400' : 'text-gray-600')}>{formatCurrency(row.cgst_total)}</td>
                        <td className={cn('px-4 py-2.5 text-right', isDark ? 'text-gray-400' : 'text-gray-600')}>{formatCurrency(row.sgst_total)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(row.total_tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={cn('border-t-2', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                    <tr>
                      <td className={cn('px-4 py-2.5 font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>Total</td>
                      <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(data.total_taxable)}</td>
                      <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(data.total_cgst)}</td>
                      <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(data.total_sgst)}</td>
                      <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                        {formatCurrency(data.total_cgst + data.total_sgst + data.total_igst)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {data.total_igst > 0 && (
              <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                <p className={cn('text-sm flex justify-between', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  <span>IGST (Inter-state)</span>
                  <span className={cn('font-semibold', isDark ? 'text-gray-200' : '')}>{formatCurrency(data.total_igst)}</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
