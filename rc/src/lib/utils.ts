export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function calcGST(
  taxable: number,
  cgstPct: number,
  sgstPct: number,
): {cgst: number; sgst: number} {
  return {
    cgst: +(taxable * (cgstPct / 100)).toFixed(2),
    sgst: +(taxable * (sgstPct / 100)).toFixed(2),
  };
}

export function calcRoundOff(amount: number): {netPayable: number; roundOff: number} {
  const netPayable = Math.round(amount);
  return {netPayable, roundOff: +(netPayable - amount).toFixed(2)};
}

export function makeLocalId(): string {
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}
