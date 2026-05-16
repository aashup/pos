import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'
import { useThemeStore } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency, todayLocalDate } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { ipc } from '../../bridge/ipc'
import Header from '../../components/layout/Header'

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
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { user } = useAuthStore()
  const [date, setDate] = useState(todayLocalDate())
  const [applied, setApplied] = useState(todayLocalDate())
  const [isPrinting, setIsPrinting] = useState(false) // guards double-tap

  const { data, isLoading } = useQuery<DayCloseData>({
    queryKey: ['day-close', applied],
    queryFn: async () => {
      const res = await reportsApi.dayClose({ date: applied })
      return res.data?.data
    },
  })

  async function handlePrint() {
    if (!data) return
    setIsPrinting(true)
    try {
      const company = user?.company
      const fmt = (n: number | string) => `Rs.${Number(n).toFixed(2)}`
      const divider = '<hr style="border:none;border-top:1px dashed #000;margin:6px 0"/>'

      const topItemsRows = (data.top_items ?? []).slice(0, 10).map((item, i) =>
        `<tr>
          <td style="padding:1px 4px 1px 0">${i + 1}.</td>
          <td style="padding:1px 4px">${item.name} ×${item.quantity}</td>
          <td style="padding:1px 0;text-align:right">${fmt(item.revenue)}</td>
        </tr>`
      ).join('')

      const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
  body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 6px; }
  h2 { font-size: 13px; margin: 0 0 2px; text-align: center; }
  p  { margin: 0; }
  .center { text-align: center; }
  .section { margin: 6px 0; }
  .section h4 { margin: 0 0 3px; font-size: 11px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  td { font-size: 11px; vertical-align: top; }
  .right { text-align: right; }
  .bold  { font-weight: bold; }
</style>
</head><body>
<div class="center">
  <h2>${company?.name ?? 'Day Close Report'}</h2>
  ${company?.phone ? `<p>Ph: ${company.phone}</p>` : ''}
  ${company?.gstin ? `<p>GSTIN: ${company.gstin}</p>` : ''}
</div>
${divider}
<div class="center">
  <p class="bold">DAY CLOSE SUMMARY</p>
  <p>${data.date}</p>
  <p class="bold">Total Revenue: ${fmt(data.total_revenue)}</p>
  <p>${data.total_orders} order(s)</p>
</div>
${divider}
<div class="section">
  <h4>Payment Collection</h4>
  <table>
    <tr><td>Cash</td><td class="right">${fmt(data.total_cash)}</td></tr>
    <tr><td>UPI</td><td class="right">${fmt(data.total_upi)}</td></tr>
    <tr><td>Card</td><td class="right">${fmt(data.total_card)}</td></tr>
    <tr><td>Credit</td><td class="right">${fmt(data.total_credit)}</td></tr>
  </table>
</div>
${divider}
<div class="section">
  <h4>Summary</h4>
  <table>
    <tr><td>Total Tax</td><td class="right">${fmt(data.total_tax)}</td></tr>
    <tr><td>Total Discount</td><td class="right">${fmt(data.total_discount)}</td></tr>
    <tr><td>Cancelled Orders</td><td class="right">${data.cancelled_orders}</td></tr>
  </table>
</div>
${data.top_items?.length > 0 ? `
${divider}
<div class="section">
  <h4>Top Items</h4>
  <table>${topItemsRows}</table>
</div>
` : ''}
${divider}
<div class="center"><p>--- End of Day Close ---</p></div>
</body></html>`

      await ipc.print.htmlInvoice(html)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className={cn('h-screen flex flex-col', isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      <Header
        title="Day Close Report"
        actions={[{ icon: Printer, label: isPrinting ? 'Printing…' : 'Print', onClick: handlePrint }]}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date picker */}
        <div className={cn('rounded-xl p-4 flex items-center gap-3', isDark ? 'bg-gray-900' : 'bg-white')}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn('border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'border-gray-200 bg-white')}
          />
          <button
            onClick={() => setApplied(date)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            View
          </button>
        </div>

        {isLoading ? (
          <div className={cn('flex items-center justify-center h-40 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>Loading…</div>
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
            <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
              <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Payment Collection</h3>
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
            <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
              <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Summary</h3>
              <div className="space-y-2">
                <Row label="Total Tax (CGST+SGST)" value={data.total_tax} />
                <Row label="Total Discount" value={data.total_discount} />
                <Row label="Cancelled Orders" value={data.cancelled_orders} isCurrency={false} />
              </div>
            </div>

            {/* Top items */}
            {data.top_items?.length > 0 && (
              <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className={cn('font-semibold mb-3 text-sm', isDark ? 'text-gray-200' : 'text-gray-800')}>Top Items</h3>
                <div className="space-y-2">
                  {data.top_items.slice(0, 10).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500')}>
                          {i + 1}
                        </span>
                        <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{item.name}</span>
                        <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>×{item.quantity}</span>
                      </div>
                      <span className={cn('font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>{formatCurrency(item.revenue)}</span>
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
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div className={cn('flex items-center justify-between text-sm', bold ? (isDark ? 'font-bold text-gray-100' : 'font-bold text-gray-900') : (isDark ? 'text-gray-400' : 'text-gray-600'))}>
      <span>{label}</span>
      <span className={highlight ? (isDark ? 'text-green-400 font-semibold' : 'text-green-700 font-semibold') : ''}>
        {isCurrency ? formatCurrency(value) : value}
      </span>
    </div>
  )
}
