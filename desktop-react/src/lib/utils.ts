import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function haversineDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000; // metres
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export function calcGST(
  taxable: number,
  cgstPct: number,
  sgstPct: number,
): { cgst: number; sgst: number } {
  return {
    cgst: +(taxable * (cgstPct / 100)).toFixed(2),
    sgst: +(taxable * (sgstPct / 100)).toFixed(2),
  };
}

export function calcRoundOff(amount: number): { netPayable: number; roundOff: number } {
  const netPayable = Math.round(amount);
  return { netPayable, roundOff: +(netPayable - amount).toFixed(2) };
}
