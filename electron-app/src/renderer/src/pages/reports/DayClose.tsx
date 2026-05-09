import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { formatCurrency, todayLocalDate } from '../../lib/utils'

interface DayCloseData {
  date: string
  opening_cash: number
  total_cash: number
  total_upi: number
  total_card: number
  total_credit: number
  total_revenue: number
  total_orders: number
  total_tax: number
  total_discount: number
  cancelled_orders: number
  top_items: { name: string; quantity: number; revenue: number }[]
}

export default function DayClose() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayLocalDate())
  const [applied, setApplied] = useState(todayLocalDate())

  const { data, isLoading } = useQuery<DayCloseData>({
    queryKey: ['day-close', applied],
    queryFn: async () => {
      const res = await reportsApi.dayClose({ date: applied })
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
          <span className="font-bold text-orange-400 text-sm">Day Close Report</span>
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
        {/* Date picker */}
        <div className="bg-white rounded-xl p-4 flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={() => setApplied(date)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            View
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
        ) : !data ? null : (
          <>
            {/* Date heading */}
            <div className="bg-orange-500 text-white rounded-xl p-4 text-center">
              <p className="text-xs opacity-80">Day Close Summary</p>
              <p className="text-2xl font-bold mt-1">{data.date}</p>
              <p className="text-lg font-semibold mt-1">{formatCurrency(data.total_revenue)}</p>
              <p className="text-xs opacity-80 mt-0.5">{data.total_orders} orders</p>
            </div>

            {/* Payment breakdown */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Payment Collection</h3>
              <div className="space-y-2">
                <Row label="Cash" value={data.total_cash} highlight />
                <Row label="UPI" value={data.total_upi} />
                <Row label="Card" value={data.total_card} />
                <Row label="Credit" value={data.total_credit} />
                <div className="border-t border-gray-100 pt-2">
                  <Row label="Total" value={data.total_revenue} bold />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Summary</h3>
              <div className="space-y-2">
                <Row label="Total Tax (CGST+SGST)" value={data.total_tax} />
                <Row label="Total Discount" value={data.total_discount} />
                <Row label="Cancelled Orders" value={data.cancelled_orders} isCurrency={false} />
              </div>
            </div>

            {/* Top items */}
            {data.top_items?.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Top Items</h3>
                <div className="space-y-2">
                  {data.top_items.slice(0, 10).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-100 rounded-full text-xs flex items-center justify-center text-gray-500 font-medium">
                          {i + 1}
                        </span>
                        <span className="text-gray-700">{item.name}</span>
                        <span className="text-gray-400 text-xs">×{item.quantity}</span>
                      </div>
                      <span className="font-medium text-gray-800">{formatCurrency(item.revenue)}</span>
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

function Row({
  label, value, isCurrency = true, highlight = false, bold = false,
}: {
  label: string; value: number; isCurrency?: boolean; highlight?: boolean; bold?: boolean
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span className={highlight ? 'text-green-700 font-semibold' : ''}>
        {isCurrency ? formatCurrency(value) : value}
      </span>
    </div>
  )
}
