import { getDb } from '../database'

export interface SalesSummaryResult {
  total_orders: number
  total_revenue: number
  total_tax: number
  total_discount: number
  avg_order_value: number
  by_order_type: { order_type: string; count: number; revenue: number }[]
  by_payment_mode: { payment_mode: string; count: number; amount: number }[]
  daily: { date: string; count: number; revenue: number }[]
}

export interface ItemWiseRow {
  item_id: string
  item_name: string
  total_quantity: number
  total_revenue: number
  taxable_amount: number
  tax_amount: number
  order_count: number
}

export interface DayCloseResult {
  date: string
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

export interface GSTResult {
  date_from: string
  date_to: string
  by_rate: {
    gst_rate: number
    taxable_amount: number
    cgst_total: number
    sgst_total: number
    igst_total: number
    total_tax: number
  }[]
  total_taxable: number
  total_cgst: number
  total_sgst: number
  total_igst: number
}

export const ReportRepository = {
  salesSummary(dateFrom: string, dateTo: string): SalesSummaryResult {
    const db = getDb()

    const kpi = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(grand_total), 0) AS total_revenue,
        COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) AS total_tax,
        COALESCE(SUM(discount_amount), 0) AS total_discount
      FROM sales_invoices
      WHERE status = 'confirmed'
        AND DATE(invoice_date, 'localtime') >= ?
        AND DATE(invoice_date, 'localtime') <= ?
    `).get(dateFrom, dateTo) as {
      total_orders: number
      total_revenue: number
      total_tax: number
      total_discount: number
    }

    const byOrderType = db.prepare(`
      SELECT
        order_type,
        COUNT(*) AS count,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM sales_invoices
      WHERE status = 'confirmed'
        AND DATE(invoice_date, 'localtime') >= ?
        AND DATE(invoice_date, 'localtime') <= ?
      GROUP BY order_type
      ORDER BY revenue DESC
    `).all(dateFrom, dateTo) as { order_type: string; count: number; revenue: number }[]

    const byPaymentMode = db.prepare(`
      SELECT
        COALESCE(pos_payment_mode, 'unknown') AS payment_mode,
        COUNT(*) AS count,
        COALESCE(SUM(grand_total), 0) AS amount
      FROM sales_invoices
      WHERE status = 'confirmed'
        AND DATE(invoice_date, 'localtime') >= ?
        AND DATE(invoice_date, 'localtime') <= ?
      GROUP BY pos_payment_mode
      ORDER BY amount DESC
    `).all(dateFrom, dateTo) as { payment_mode: string; count: number; amount: number }[]

    const daily = db.prepare(`
      SELECT
        DATE(invoice_date, 'localtime') AS date,
        COUNT(*) AS count,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM sales_invoices
      WHERE status = 'confirmed'
        AND DATE(invoice_date, 'localtime') >= ?
        AND DATE(invoice_date, 'localtime') <= ?
      GROUP BY DATE(invoice_date, 'localtime')
      ORDER BY date ASC
    `).all(dateFrom, dateTo) as { date: string; count: number; revenue: number }[]

    const totalOrders = kpi.total_orders ?? 0
    const totalRevenue = kpi.total_revenue ?? 0

    return {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      total_tax: kpi.total_tax ?? 0,
      total_discount: kpi.total_discount ?? 0,
      avg_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      by_order_type: byOrderType,
      by_payment_mode: byPaymentMode,
      daily,
    }
  },

  itemWise(dateFrom: string, dateTo: string): ItemWiseRow[] {
    const db = getDb()
    return db.prepare(`
      SELECT
        sil.item_id,
        sil.item_name,
        COALESCE(SUM(sil.quantity), 0) AS total_quantity,
        COALESCE(SUM(sil.line_total), 0) AS total_revenue,
        COALESCE(SUM(sil.taxable_amount), 0) AS taxable_amount,
        COALESCE(SUM(sil.cgst + sil.sgst + sil.igst), 0) AS tax_amount,
        COUNT(DISTINCT sil.sales_invoice_id) AS order_count
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON sil.sales_invoice_id = si.id
      WHERE si.status = 'confirmed'
        AND DATE(si.invoice_date, 'localtime') >= ?
        AND DATE(si.invoice_date, 'localtime') <= ?
      GROUP BY sil.item_id, sil.item_name
      ORDER BY total_revenue DESC
    `).all(dateFrom, dateTo) as ItemWiseRow[]
  },

  dayClose(date: string): DayCloseResult {
    const db = getDb()

    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN pos_payment_mode = 'cash'   THEN grand_total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN pos_payment_mode = 'upi'    THEN grand_total ELSE 0 END), 0) AS total_upi,
        COALESCE(SUM(CASE WHEN pos_payment_mode = 'card'   THEN grand_total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN pos_payment_mode = 'credit' THEN grand_total ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(grand_total), 0) AS total_revenue,
        COUNT(*) AS total_orders,
        COALESCE(SUM(cgst_total + sgst_total + igst_total), 0) AS total_tax,
        COALESCE(SUM(discount_amount), 0) AS total_discount,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_orders
      FROM sales_invoices
      WHERE status IN ('confirmed', 'cancelled')
        AND DATE(invoice_date, 'localtime') = ?
    `).get(date) as {
      total_cash: number; total_upi: number; total_card: number; total_credit: number
      total_revenue: number; total_orders: number; total_tax: number
      total_discount: number; cancelled_orders: number
    }

    const topItems = db.prepare(`
      SELECT
        sil.item_name AS name,
        COALESCE(SUM(sil.quantity), 0) AS quantity,
        COALESCE(SUM(sil.line_total), 0) AS revenue
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON sil.sales_invoice_id = si.id
      WHERE si.status = 'confirmed'
        AND DATE(si.invoice_date, 'localtime') = ?
      GROUP BY sil.item_name
      ORDER BY revenue DESC
      LIMIT 10
    `).all(date) as { name: string; quantity: number; revenue: number }[]

    // Expand split_payments JSON for accurate per-mode breakdown
    let splitCash = 0, splitUpi = 0, splitCard = 0, splitCredit = 0
    try {
      const splits = db.prepare(`
        SELECT
          json_extract(value, '$.mode') AS mode,
          CAST(json_extract(value, '$.amount') AS REAL) AS amount
        FROM sales_invoices, json_each(sales_invoices.split_payments)
        WHERE status = 'confirmed'
          AND pos_payment_mode = 'split'
          AND split_payments IS NOT NULL
          AND DATE(invoice_date, 'localtime') = ?
      `).all(date) as { mode: string; amount: number }[]

      for (const r of splits) {
        if (r.mode === 'cash')   splitCash   += r.amount ?? 0
        if (r.mode === 'upi')    splitUpi    += r.amount ?? 0
        if (r.mode === 'card')   splitCard   += r.amount ?? 0
        if (r.mode === 'credit') splitCredit += r.amount ?? 0
      }
    } catch {
      // split_payments not yet populated or json_each unavailable — skip expansion
    }

    return {
      date,
      top_items: topItems,
      total_cash:       (summary.total_cash ?? 0)   + splitCash,
      total_upi:        (summary.total_upi ?? 0)    + splitUpi,
      total_card:       (summary.total_card ?? 0)   + splitCard,
      total_credit:     (summary.total_credit ?? 0) + splitCredit,
      total_revenue:    summary.total_revenue ?? 0,
      total_orders:     summary.total_orders ?? 0,
      total_tax:        summary.total_tax ?? 0,
      total_discount:   summary.total_discount ?? 0,
      cancelled_orders: summary.cancelled_orders ?? 0,
    }
  },

  gstSummary(dateFrom: string, dateTo: string): GSTResult {
    const db = getDb()

    const byRate = db.prepare(`
      SELECT
        sil.gst_rate,
        COALESCE(SUM(sil.taxable_amount), 0) AS taxable_amount,
        COALESCE(SUM(sil.cgst), 0) AS cgst_total,
        COALESCE(SUM(sil.sgst), 0) AS sgst_total,
        COALESCE(SUM(sil.igst), 0) AS igst_total,
        COALESCE(SUM(sil.cgst + sil.sgst + sil.igst), 0) AS total_tax
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON sil.sales_invoice_id = si.id
      WHERE si.status = 'confirmed'
        AND DATE(si.invoice_date, 'localtime') >= ?
        AND DATE(si.invoice_date, 'localtime') <= ?
      GROUP BY sil.gst_rate
      ORDER BY sil.gst_rate ASC
    `).all(dateFrom, dateTo) as {
      gst_rate: number; taxable_amount: number
      cgst_total: number; sgst_total: number; igst_total: number; total_tax: number
    }[]

    const totals = byRate.reduce(
      (acc, r) => ({
        taxable: acc.taxable + (r.taxable_amount ?? 0),
        cgst:    acc.cgst   + (r.cgst_total ?? 0),
        sgst:    acc.sgst   + (r.sgst_total ?? 0),
        igst:    acc.igst   + (r.igst_total ?? 0),
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0 },
    )

    return {
      date_from: dateFrom,
      date_to: dateTo,
      by_rate: byRate,
      total_taxable: totals.taxable,
      total_cgst:    totals.cgst,
      total_sgst:    totals.sgst,
      total_igst:    totals.igst,
    }
  },
}
