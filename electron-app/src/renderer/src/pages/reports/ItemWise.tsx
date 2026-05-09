import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { useThemeStore } from '../../store/themeStore'
import { formatCurrency, todayLocalDate } from '../../lib/utils'
import { cn } from '../../lib/utils'
import Header from '../../components/layout/Header'

interface ItemRow {
  item_id: string
  item_name: string
  total_quantity: number
  total_revenue: number
  taxable_amount: number
  tax_amount: number
  order_count: number
}

export default function ItemWise() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const today = todayLocalDate()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo]     = useState(today)
  const [applied, setApplied]   = useState({ from: today, to: today })
  const [search, setSearch]     = useState('')

  const { data: rows = [], isLoading } = useQuery<ItemRow[]>({
    queryKey: ['item-wise', applied.from, applied.to],
    queryFn: async () => {
      const res = await reportsApi.itemWise({ date_from: applied.from, date_to: applied.to })
      return res.data?.data ?? []
    },
  })

  const filtered = rows.filter((r) =>
    !search || r.item_name.toLowerCase().includes(search.toLowerCase()),
  )

  const grandTotal   = rows.reduce((s, r) => s + r.total_revenue, 0)
  const grandQty     = rows.reduce((s, r) => s + r.total_quantity, 0)

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header title="Item-Wise Sales" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className={cn('border-b p-3 space-y-2 shrink-0', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
            />
            <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-400')}>–</span>
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

          {/* Search */}
          <div className="relative">
            <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item..."
              className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'border-gray-200 bg-white')}
            />
          </div>
        </div>

        {/* Summary strip */}
        {rows.length > 0 && (
          <div className={cn('flex items-center gap-6 px-4 py-2 border-b text-xs shrink-0', isDark ? 'bg-orange-900 border-orange-800 text-orange-200' : 'bg-orange-50 border-orange-100 text-orange-700')}>
            <span><strong>{rows.length}</strong> items</span>
            <span><strong>{grandQty.toFixed(0)}</strong> qty sold</span>
            <span><strong>{formatCurrency(grandTotal)}</strong> revenue</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>No data for this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead className={cn('border-b sticky top-0', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <tr>
                  <th className={cn('text-left px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>#</th>
                  <th className={cn('text-left px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Item</th>
                  <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Qty</th>
                  <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Orders</th>
                  <th className={cn('text-right px-4 py-2.5 font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>Revenue</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-gray-800' : 'divide-gray-50')}>
                {filtered.map((row, i) => (
                  <tr key={row.item_id} className={isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}>
                    <td className={cn('px-4 py-2.5', isDark ? 'text-gray-500' : 'text-gray-400')}>{i + 1}</td>
                    <td className={cn('px-4 py-2.5 font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{row.item_name}</td>
                    <td className={cn('px-4 py-2.5 text-right', isDark ? 'text-gray-400' : 'text-gray-600')}>{Number(row.total_quantity).toFixed(0)}</td>
                    <td className={cn('px-4 py-2.5 text-right', isDark ? 'text-gray-500' : 'text-gray-500')}>{row.order_count}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                      {formatCurrency(row.total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className={cn('border-t-2 sticky bottom-0', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <tr>
                  <td colSpan={2} className={cn('px-4 py-2.5 font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>Total</td>
                  <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{grandQty.toFixed(0)}</td>
                  <td />
                  <td className={cn('px-4 py-2.5 text-right font-bold', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
