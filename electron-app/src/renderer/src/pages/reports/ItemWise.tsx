import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { formatCurrency, todayLocalDate } from '../../lib/utils'

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
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-12 bg-gray-900 text-white flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-orange-400 text-sm">Item-Wise Sales</span>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="bg-white border-b border-gray-100 p-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <span className="text-gray-400 text-sm">–</span>
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* Summary strip */}
        {rows.length > 0 && (
          <div className="flex items-center gap-6 px-4 py-2 bg-orange-50 border-b border-orange-100 text-xs text-orange-700 shrink-0">
            <span><strong>{rows.length}</strong> items</span>
            <span><strong>{grandQty.toFixed(0)}</strong> qty sold</span>
            <span><strong>{formatCurrency(grandTotal)}</strong> revenue</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data for this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Item</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Orders</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={row.item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{row.item_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{Number(row.total_quantity).toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{row.order_count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                      {formatCurrency(row.total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-800">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-800">{grandQty.toFixed(0)}</td>
                  <td />
                  <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
