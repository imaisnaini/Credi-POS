/**
 * Financial calculations and credit rules for CrediPOS.
 * Pure logic decoupled from UI and database layers.
 */

export interface CartItemCalculation {
  price: number;
  quantity: number;
  discount?: number; // Item-level discount in IDR
}

export interface SaleTotalsResult {
  itemsSubtotal: number;
  totalItemDiscounts: number;
  netItemsSubtotal: number;
  transactionDiscount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
}

export interface PaymentBreakdownResult {
  amountPaid: number;
  grandTotal: number;
  changeAmount: number;
  remainingBalance: number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
}

export type AgingCategory =
  | 'not_due'
  | 'overdue_1_7'
  | 'overdue_8_30'
  | 'overdue_31_60'
  | 'overdue_60_plus';

export interface AgingResult {
  category: AgingCategory;
  categoryLabel: string;
  isOverdue: boolean;
  daysDiff: number; // positive = days overdue, negative = days remaining until due
}

/**
 * Format numerical amount to standard Indonesian Rupiah (IDR).
 * Example: 25000 -> "Rp 25.000"
 */
export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rp 0';
  }
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(rounded));
  return rounded < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Calculate individual item subtotal after item-level discount.
 */
export function calculateItemSubtotal(price: number, quantity: number, discount: number = 0): number {
  const gross = Math.max(0, price) * Math.max(0, quantity);
  const net = Math.max(0, gross - Math.max(0, discount));
  return Math.round(net);
}

/**
 * Calculate totals for a sale transaction.
 * Grand Total = (sum(items gross - item discount) - transaction discount) + tax
 */
export function calculateSaleTotals(
  items: CartItemCalculation[],
  transactionDiscount: number = 0,
  taxRate: number = 0 // e.g. 0.11 for 11% PPN or 0 if exempt
): SaleTotalsResult {
  let itemsSubtotal = 0;
  let totalItemDiscounts = 0;

  for (const item of items) {
    const gross = Math.max(0, item.price) * Math.max(0, item.quantity);
    const itemDisc = Math.min(gross, Math.max(0, item.discount || 0));
    itemsSubtotal += gross;
    totalItemDiscounts += itemDisc;
  }

  const netItemsSubtotal = Math.max(0, itemsSubtotal - totalItemDiscounts);
  const validTransDisc = Math.min(netItemsSubtotal, Math.max(0, transactionDiscount));
  const taxableAmount = Math.max(0, netItemsSubtotal - validTransDisc);
  const taxAmount = Math.round(taxableAmount * Math.max(0, taxRate));
  const grandTotal = taxableAmount + taxAmount;

  return {
    itemsSubtotal,
    totalItemDiscounts,
    netItemsSubtotal,
    transactionDiscount: validTransDisc,
    taxableAmount,
    taxRate,
    taxAmount,
    grandTotal,
  };
}

/**
 * Calculate payment breakdown and resulting payment status.
 */
export function calculatePaymentBreakdown(
  grandTotal: number,
  amountPaid: number
): PaymentBreakdownResult {
  const safeTotal = Math.max(0, Math.round(grandTotal));
  const safePaid = Math.max(0, Math.round(amountPaid));

  if (safePaid >= safeTotal) {
    return {
      amountPaid: safePaid,
      grandTotal: safeTotal,
      changeAmount: safePaid - safeTotal,
      remainingBalance: 0,
      paymentStatus: 'paid',
    };
  } else if (safePaid > 0) {
    return {
      amountPaid: safePaid,
      grandTotal: safeTotal,
      changeAmount: 0,
      remainingBalance: safeTotal - safePaid,
      paymentStatus: 'partially_paid',
    };
  } else {
    return {
      amountPaid: 0,
      grandTotal: safeTotal,
      changeAmount: 0,
      remainingBalance: safeTotal,
      paymentStatus: 'unpaid',
    };
  }
}

/**
 * Validates whether a customer has sufficient available credit limit
 * to take on additional credit.
 */
export function validateCreditPurchase(
  currentBalance: number,
  creditLimit: number,
  additionalDebt: number
): { allowed: boolean; remainingCreditAvailable: number; projectedBalance: number; error?: string } {
  const safeBalance = Math.max(0, currentBalance);
  const safeLimit = Math.max(0, creditLimit);
  const safeDebt = Math.max(0, additionalDebt);
  const projectedBalance = safeBalance + safeDebt;
  const remainingCreditAvailable = Math.max(0, safeLimit - safeBalance);

  if (projectedBalance > safeLimit) {
    return {
      allowed: false,
      remainingCreditAvailable,
      projectedBalance,
      error: `Credit limit exceeded. Available credit is ${formatRupiah(remainingCreditAvailable)}, requested debt is ${formatRupiah(safeDebt)}.`,
    };
  }

  return {
    allowed: true,
    remainingCreditAvailable: safeLimit - projectedBalance,
    projectedBalance,
  };
}

/**
 * Calculate credit debt aging category based on due date.
 * Aging buckets:
 * - Not yet due
 * - 1-7 days overdue
 * - 8-30 days overdue
 * - 31-60 days overdue
 * - >60 days overdue
 */
export function calculateCreditAging(
  dueDateStr: string,
  remainingBalance: number,
  asOfDateStr?: string
): AgingResult {
  if (remainingBalance <= 0) {
    return {
      category: 'not_due',
      categoryLabel: 'Lunas / Settled',
      isOverdue: false,
      daysDiff: 0,
    };
  }

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
  asOfDate.setHours(0, 0, 0, 0);

  const diffMs = asOfDate.getTime() - dueDate.getTime();
  const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff <= 0) {
    return {
      category: 'not_due',
      categoryLabel: 'Belum Jatuh Tempo (Not Due)',
      isOverdue: false,
      daysDiff,
    };
  }

  if (daysDiff <= 7) {
    return {
      category: 'overdue_1_7',
      categoryLabel: '1–7 Hari Lewat Tempo',
      isOverdue: true,
      daysDiff,
    };
  }

  if (daysDiff <= 30) {
    return {
      category: 'overdue_8_30',
      categoryLabel: '8–30 Hari Lewat Tempo',
      isOverdue: true,
      daysDiff,
    };
  }

  if (daysDiff <= 60) {
    return {
      category: 'overdue_31_60',
      categoryLabel: '31–60 Hari Lewat Tempo',
      isOverdue: true,
      daysDiff,
    };
  }

  return {
    category: 'overdue_60_plus',
    categoryLabel: '>60 Hari Lewat Tempo (Macet)',
    isOverdue: true,
    daysDiff,
  };
}

/**
 * Apply a repayment against a credit account balance.
 */
export function applyCreditRepayment(
  currentRemainingBalance: number,
  repaymentAmount: number
): { newRemainingBalance: number; excessChange: number; isFullySettled: boolean } {
  const safeBalance = Math.max(0, currentRemainingBalance);
  const safeRepayment = Math.max(0, repaymentAmount);

  if (safeRepayment >= safeBalance) {
    return {
      newRemainingBalance: 0,
      excessChange: safeRepayment - safeBalance,
      isFullySettled: true,
    };
  }

  return {
    newRemainingBalance: safeBalance - safeRepayment,
    excessChange: 0,
    isFullySettled: false,
  };
}
