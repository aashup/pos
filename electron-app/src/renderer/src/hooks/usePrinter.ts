import { useCallback } from 'react'
import { ipc } from '../bridge/ipc'
import type { LocalPrintTemplate } from '../bridge/ipc'
import { renderTemplate } from '../lib/renderTemplate'
import { DEFAULT_KOT_TEMPLATE, DEFAULT_INVOICE_TEMPLATE } from '../lib/defaultTemplates'
import type { KotTemplateData, InvoiceTemplateData, PrintResult } from '../types/printing'

// ── Invoice data flattening ───────────────────────────────────────────────────
// renderTemplate works on flat Record<string, unknown>. We convert InvoiceTemplateData
// into a shape where nested arrays (items, splitPayments) are already structured for
// the {{#items}} block syntax.

function flattenInvoiceData(data: InvoiceTemplateData): Record<string, unknown> {
  return {
    ...data,
    orderType: data.orderType.replace('_', ' '),
    // Append tableName with a space-padded separator when present
    tableName: data.tableName ? ` — ${data.tableName}` : '',
    discount:        data.discount.toFixed(2),
    cgst:            data.cgst.toFixed(2),
    sgst:            data.sgst.toFixed(2),
    grandTotal:      data.grandTotal.toFixed(2),
    subtotal:        data.subtotal.toFixed(2),
    amountTendered:  data.amountTendered != null ? data.amountTendered.toFixed(2) : '',
    change:          data.change != null ? data.change.toFixed(2) : '',
    footerNote:      data.footerNote ?? 'Thank you! Visit again.',
    items: data.items.map((l) => ({
      name:      l.name,
      quantity:  l.quantity,
      rate:      l.rate.toFixed(2),
      lineTotal: l.lineTotal.toFixed(2),
      gstRate:   l.gstRate,
    })),
    splitPayments: data.splitPayments ?? [],
  }
}

// ── Duplicate KOT guard ───────────────────────────────────────────────────────

async function isAlreadyPrinted(kotNumber: string): Promise<boolean> {
  try {
    const kots = await ipc.kots.list()
    const kot = kots.find((k) => k.kot_number === kotNumber)
    return kot != null && kot.print_count > 0
  } catch {
    return false
  }
}

// ── usePrinter ────────────────────────────────────────────────────────────────

export interface UsePrinterResult {
  printKOT: (data: KotTemplateData, opts?: { skipDuplicateCheck?: boolean }) => Promise<PrintResult>
  printInvoice: (data: InvoiceTemplateData) => Promise<PrintResult>
  isOffline: boolean
}

export function usePrinter(): UsePrinterResult {
  const isOffline = !navigator.onLine

  const printKOT = useCallback(
    async (
      data: KotTemplateData,
      opts: { skipDuplicateCheck?: boolean } = {},
    ): Promise<PrintResult> => {
      // Duplicate guard — warn if already printed, let caller decide to re-print
      if (!opts.skipDuplicateCheck) {
        const alreadyPrinted = await isAlreadyPrinted(data.kotNumber)
        if (alreadyPrinted) {
          const confirmed = window.confirm(
            `KOT #${data.kotNumber} has already been printed.\nPrint again?`,
          )
          if (!confirmed) return { success: false, error: 'Cancelled by user' }
        }
      }

      // Fetch active template (SQLite — works offline)
      let template: LocalPrintTemplate | null = null
      try {
        template = await ipc.templates.getActive('kot')
      } catch {
        // Ignore — fall through to defaults
      }

      const effectiveTemplate = template ?? DEFAULT_KOT_TEMPLATE

      // Route: template-driven ESC/POS if layout is non-trivial; raw fallback otherwise
      if (effectiveTemplate.id !== '__default_kot__' || template != null) {
        return ipc.print.kotFromTemplate(data, effectiveTemplate.layout)
      }

      // Hardcoded ESC/POS fallback (existing printKOT path)
      return ipc.print.kot(data)
    },
    [],
  )

  const printInvoice = useCallback(async (data: InvoiceTemplateData): Promise<PrintResult> => {
    // Fetch active invoice template (SQLite — works offline)
    let template: LocalPrintTemplate | null = null
    try {
      template = await ipc.templates.getActive('invoice')
    } catch {
      // Ignore — fall through to defaults
    }

    if (template != null) {
      // HTML path: render template → hidden BrowserWindow → webContents.print()
      const html = renderTemplate(template.layout, flattenInvoiceData(data))
      return ipc.print.htmlInvoice(html)
    }

    if (DEFAULT_INVOICE_TEMPLATE.layout) {
      const html = renderTemplate(DEFAULT_INVOICE_TEMPLATE.layout, flattenInvoiceData(data))
      return ipc.print.htmlInvoice(html)
    }

    // Last resort: ESC/POS receipt fallback
    return ipc.print.receipt(data)
  }, [])

  return { printKOT, printInvoice, isOffline }
}
