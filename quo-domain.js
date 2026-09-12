/* Pure payment rules. Amounts passed here are integer minor units. */
function paymentSummary(totalMinor, paidMinor) {
  if (!Number.isSafeInteger(totalMinor) || !Number.isSafeInteger(paidMinor) ||
      totalMinor < 0 || paidMinor < 0) {
    throw new Error('Amounts must be non-negative integer minor units.');
  }
  return {
    balanceMinor: Math.max(totalMinor - paidMinor, 0),
    creditMinor: Math.max(paidMinor - totalMinor, 0),
    status: paidMinor >= totalMinor ? 'Paid' : paidMinor > 0 ? 'Part Paid' : 'Unpaid'
  };
}

// The existing app accepts fractional quantities and unrounded GST totals.
// Use integer rules only when values are already at currency precision;
// preserve the existing half-laari tolerance otherwise.
function paymentStatusFromTotals(total, paid, balance) {
  const totalMinor = Math.round(total * 100);
  const paidMinor = Math.round(paid * 100);
  const atCurrencyPrecision = value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
  if (Number.isSafeInteger(totalMinor) && Number.isSafeInteger(paidMinor) &&
      total >= 0 && paid >= 0 && atCurrencyPrecision(total) && atCurrencyPrecision(paid)) {
    return paymentSummary(totalMinor, paidMinor).status;
  }
  return balance <= 0.005 ? 'Paid' : paid > 0.005 ? 'Part Paid' : 'Unpaid';
}
