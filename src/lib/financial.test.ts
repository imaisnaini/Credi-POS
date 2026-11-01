import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRupiah,
  calculateItemSubtotal,
  calculateSaleTotals,
  calculatePaymentBreakdown,
  validateCreditPurchase,
  calculateCreditAging,
  applyCreditRepayment,
} from './financial.ts';

test('formatRupiah formats IDR currency properly', () => {
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(25000), 'Rp 25.000');
  assert.equal(formatRupiah(1250000), 'Rp 1.250.000');
  assert.equal(formatRupiah(-50000), '-Rp 50.000');
});

test('calculateItemSubtotal handles price, quantity, and item discount', () => {
  // 3 packs of Indomie @ Rp 3.500 = 10.500
  assert.equal(calculateItemSubtotal(3500, 3, 0), 10500);
  // With Rp 1.000 discount
  assert.equal(calculateItemSubtotal(3500, 3, 1000), 9500);
  // Discount exceeding gross does not yield negative
  assert.equal(calculateItemSubtotal(3500, 1, 5000), 0);
});

test('calculateSaleTotals calculates subtotal, discounts, tax, and grand total', () => {
  const items = [
    { price: 15000, quantity: 2, discount: 2000 }, // Gross 30.000, disc 2.000 = 28.000
    { price: 50000, quantity: 1, discount: 0 },    // Gross 50.000 = 50.000
  ];
  // Subtotal gross = 80.000, item discounts = 2.000, net items = 78.000
  // Transaction discount = 3.000 -> Taxable = 75.000
  // Tax rate = 0.10 (10%) -> Tax amount = 7.500
  // Grand total = 82.500
  const totals = calculateSaleTotals(items, 3000, 0.10);

  assert.equal(totals.itemsSubtotal, 80000);
  assert.equal(totals.totalItemDiscounts, 2000);
  assert.equal(totals.netItemsSubtotal, 78000);
  assert.equal(totals.transactionDiscount, 3000);
  assert.equal(totals.taxableAmount, 75000);
  assert.equal(totals.taxAmount, 7500);
  assert.equal(totals.grandTotal, 82500);
});

test('calculatePaymentBreakdown handles full, partial, and zero payments', () => {
  // Full cash payment with change
  const full = calculatePaymentBreakdown(150000, 200000);
  assert.equal(full.paymentStatus, 'paid');
  assert.equal(full.changeAmount, 50000);
  assert.equal(full.remainingBalance, 0);

  // Exact payment
  const exact = calculatePaymentBreakdown(150000, 150000);
  assert.equal(exact.paymentStatus, 'paid');
  assert.equal(exact.changeAmount, 0);
  assert.equal(exact.remainingBalance, 0);

  // Partial payment -> creates remaining debt
  const partial = calculatePaymentBreakdown(150000, 50000);
  assert.equal(partial.paymentStatus, 'partially_paid');
  assert.equal(partial.changeAmount, 0);
  assert.equal(partial.remainingBalance, 100000);

  // Zero payment (Credit / Pay Later)
  const credit = calculatePaymentBreakdown(150000, 0);
  assert.equal(credit.paymentStatus, 'unpaid');
  assert.equal(credit.changeAmount, 0);
  assert.equal(credit.remainingBalance, 150000);
});

test('validateCreditPurchase enforces credit limits', () => {
  // Balance: 200.000, Limit: 1.000.000, New debt: 300.000 -> Allowed (500k <= 1M)
  const res1 = validateCreditPurchase(200000, 1000000, 300000);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remainingCreditAvailable, 500000);
  assert.equal(res1.projectedBalance, 500000);

  // Balance: 800.000, Limit: 1.000.000, New debt: 300.000 -> Denied (1.1M > 1M)
  const res2 = validateCreditPurchase(800000, 1000000, 300000);
  assert.equal(res2.allowed, false);
  assert.equal(res2.projectedBalance, 1100000);
  assert.ok(res2.error?.includes('Credit limit exceeded'));
});

test('calculateCreditAging categorizes debt into specified aging buckets', () => {
  const asOf = '2026-11-01';

  // Future due date (2026-11-10) -> not_due
  const notDue = calculateCreditAging('2026-11-10', 50000, asOf);
  assert.equal(notDue.category, 'not_due');
  assert.equal(notDue.isOverdue, false);

  // Due 3 days ago (2026-10-29) -> overdue_1_7
  const overdue17 = calculateCreditAging('2026-10-29', 50000, asOf);
  assert.equal(overdue17.category, 'overdue_1_7');
  assert.equal(overdue17.isOverdue, true);

  // Due 15 days ago (2026-10-17) -> overdue_8_30
  const overdue830 = calculateCreditAging('2026-10-17', 50000, asOf);
  assert.equal(overdue830.category, 'overdue_8_30');
  assert.equal(overdue830.isOverdue, true);

  // Due 45 days ago (2026-09-17) -> overdue_31_60
  const overdue3160 = calculateCreditAging('2026-09-17', 50000, asOf);
  assert.equal(overdue3160.category, 'overdue_31_60');
  assert.equal(overdue3160.isOverdue, true);

  // Due 75 days ago (2026-08-18) -> overdue_60_plus
  const overdue60plus = calculateCreditAging('2026-08-18', 50000, asOf);
  assert.equal(overdue60plus.category, 'overdue_60_plus');
  assert.equal(overdue60plus.isOverdue, true);

  // Zero balance is settled
  const settled = calculateCreditAging('2026-08-18', 0, asOf);
  assert.equal(settled.category, 'not_due');
  assert.equal(settled.isOverdue, false);
});

test('applyCreditRepayment updates remaining balance and excess change', () => {
  // Partial repayment
  const p1 = applyCreditRepayment(200000, 75000);
  assert.equal(p1.newRemainingBalance, 125000);
  assert.equal(p1.excessChange, 0);
  assert.equal(p1.isFullySettled, false);

  // Full repayment
  const p2 = applyCreditRepayment(200000, 200000);
  assert.equal(p2.newRemainingBalance, 0);
  assert.equal(p2.excessChange, 0);
  assert.equal(p2.isFullySettled, true);

  // Overpayment (returns change)
  const p3 = applyCreditRepayment(200000, 250000);
  assert.equal(p3.newRemainingBalance, 0);
  assert.equal(p3.excessChange, 50000);
  assert.equal(p3.isFullySettled, true);
});
