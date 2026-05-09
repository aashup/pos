import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function calcGST(amount: number, rate: number, isInterState: boolean) {
  const gstAmount = (amount * rate) / 100
  if (isInterState) return { igst: gstAmount, cgst: 0, sgst: 0 }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2 }
}

export function calcRoundOff(total: number): { roundOff: number; netPayable: number } {
  const fraction = Math.round((total - Math.floor(total)) * 100) / 100
  const netPayable = fraction > 0.6 ? Math.ceil(total) : Math.floor(total)
  return { roundOff: +(netPayable - total).toFixed(2), netPayable }
}

export function todayLocalDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function elapsedMinutes(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
}
