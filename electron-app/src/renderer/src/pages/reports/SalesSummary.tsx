import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, ShoppingBag, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { formatCurrency, todayLocalDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface SalesSummaryData {
  date_from: string
  date_to: string
  total_orders: number
  total_revenue: number
  total_tax: number
  total_discount: number
  avg_order_value: number
  by_order_type: { order_type: string; count: number; revenue: number }[]
  by_payment_mode: { payment_mode: string; count: number; amount: number }[]
  daily: { date: string; count: number; revenue: number }[]
}

const PRESETS = [
  { label: 'Today',     days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: '7 days',    days: 7 },
  { label: '30 days',   days: 30 },
]

export default function SalesSummary() {
  const navigate = useNavigate()
  const today = todayLocalDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [applied, setApplied] = useState({ from: today, to: today })

  const applyPreset = (days: number) => {
    const d = new Date()
    if (days === 1) d.setDate(d.getDate() - 1)
    const end = days <= 1 ? formatDate(d) : today
    if (days > 1) {
      const start = new Date()
      start.setDate(start.getDate() - days + 1)
      setDateFrom(formatDate(start))
    } else {
      setDateFrom(end)
    }
    setDateTo(end)
    setApplied({ from: days > 1 ? formatDateOffset(days - 1) : end, to: end })
  }

  const { data, isLoading } = useQuery<SalesSummaryData>({
    queryKey: ['sales-summary', applied.from, applied.to],
    queryFn: async () => {
      const res = await reportsApi.salesSummary({ date_from: applied.from, date_to: applied.to })
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
          <span className="font-bold text-orange-400 text-sm">Sales Summary</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date filter */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:border-orange-400 hover:text-orange-600 font-medium transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={() => setApplied({ from: dateFrom, to: dateTo })}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
            >
              Apply
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
        ) : !data ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Receipt} label="Orders" value={String(data.total_orders)} color="blue" />
              <StatCard icon={TrendingUp} label="Revenue" value={formatCurrency(data.total_revenue)} color="green" />
              <StatCard icon={ShoppingBag} label="Avg Order" value={formatCurrency(data.avg_order_value)} color="orange" />
              <StatCard icon={TrendingUp} label="Tax Collected" value={formatCurrency(data.total_tax)} color="purple" />
            </div>

            {/* By order type */}
            {data.by_order_type?.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">By Order Type</h3>
                <div className="space-y-2">
                  {data.by_order_type.map((row) => (
                    <div key={row.order_type} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-600">
                        {row.order_type.replace('_', ' ')}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold text-gray-800">{formatCurrency(row.revenue)}</span>
                        <span className="text-gray-400 text-xs ml-2">({row.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By payment mode */}
            {data.by_payment_mode?.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">By Payment Mode</h3>
                <div className="space-y-2">
                  {data.by_payment_mode.map((row) => (
                    <div key={row.payment_mode} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-600">{row.payment_mode}</span>
                      <div className="text-right">
                        <span className="font-semibold text-gray-800">{formatCurrency(row.amount)}</span>
                        <span className="text-gray-400 text-xs ml-2">({row.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily breakdown */}
            {data.daily?.length > 1 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Daily Breakdown</h3>
                <div className="space-y-1">
                  {data.daily.map((row) => (
                    <div key={row.date} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500">{row.date}</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-800">{formatCurrency(row.revenue)}</span>
                        <span className="text-gray-400 text-xs ml-2">{row.count} orders</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: string; color: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-gray-800 text-base mt-0.5">{value}</p>
    </div>
  )
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDate(d)
}
