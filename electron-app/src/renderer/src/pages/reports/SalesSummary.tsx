import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, todayLocalDate } from '../../lib/utils'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'

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
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
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
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title="Sales Summary" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date filter */}
        <div className={cn('rounded-xl p-4 space-y-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className={cn('px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors', isDark ? 'border-gray-700 text-gray-300 hover:border-orange-400 hover:text-orange-400' : 'border-gray-200 text-gray-600 hover:border-orange-400 hover:text-orange-600')}
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
              className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
            />
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-400')}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
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
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
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
              <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>By Order Type</h3>
                <div className="space-y-2">
                  {data.by_order_type.map((row) => (
                    <div key={row.order_type} className="flex items-center justify-between text-sm">
                      <span className={cn('capitalize', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {row.order_type.replace('_', ' ')}
                      </span>
                      <div className="text-right">
                        <span className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(row.revenue)}</span>
                        <span className={cn('text-xs ml-2', isDark ? 'text-gray-500' : 'text-gray-400')}>({row.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By payment mode */}
            {data.by_payment_mode?.length > 0 && (
              <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>By Payment Mode</h3>
                <div className="space-y-2">
                  {data.by_payment_mode.map((row) => (
                    <div key={row.payment_mode} className="flex items-center justify-between text-sm">
                      <span className={cn('capitalize', isDark ? 'text-gray-400' : 'text-gray-600')}>{row.payment_mode}</span>
                      <div className="text-right">
                        <span className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(row.amount)}</span>
                        <span className={cn('text-xs ml-2', isDark ? 'text-gray-500' : 'text-gray-400')}>({row.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily breakdown */}
            {data.daily?.length > 1 && (
              <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Daily Breakdown</h3>
                <div className="space-y-1">
                  {data.daily.map((row) => (
                    <div key={row.date} className={cn('flex items-center justify-between text-sm py-1 border-b last:border-0', isDark ? 'border-gray-800 text-gray-200' : 'border-gray-50 text-gray-500')}>
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{row.date}</span>
                      <div className="text-right">
                        <span className={cn('font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(row.revenue)}</span>
                        <span className={cn('text-xs ml-2', isDark ? 'text-gray-500' : 'text-gray-400')}>{row.count} orders</span>
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
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const lightColors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  const darkColors: Record<string, string> = {
    blue:   'bg-blue-900 text-blue-400',
    green:  'bg-green-900 text-green-400',
    orange: 'bg-orange-900 text-orange-400',
    purple: 'bg-purple-900 text-purple-400',
  }

  const colors = isDark ? darkColors : lightColors

  return (
    <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
      <p className={cn('font-bold text-base mt-0.5', isDark ? 'text-gray-200' : 'text-gray-800')}>{value}</p>
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
