import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { formatCurrency, todayLocalDate } from '../../lib/utils'

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
    <div className="h-screen flex flex-col bg-gray-50">
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
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:border-orange-400 hover:text-orange-600 font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button onClick={() => setApplied({ from: dateFrom, to: dateTo })}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Apply
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
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
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Tax Rate Breakup</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">GST %</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Taxable</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">CGST</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">SGST</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.by_rate.map((row) => (
                      <tr key={row.gst_rate} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{Number(row.gst_rate).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.taxable_amount)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.cgst_total)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(row.sgst_total)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(row.total_tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-2.5 font-bold text-gray-800">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatCurrency(data.total_taxable)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatCurrency(data.total_cgst)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatCurrency(data.total_sgst)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                        {formatCurrency(data.total_cgst + data.total_sgst + data.total_igst)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {data.total_igst > 0 && (
              <div className="bg-white rounded-xl p-4">
                <p className="text-sm text-gray-600 flex justify-between">
                  <span>IGST (Inter-state)</span>
                  <span className="font-semibold">{formatCurrency(data.total_igst)}</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
