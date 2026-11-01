export type UserRole = 'owner' | 'cashier' | 'inventory_manager';

export interface User {
  id: string;
  business_id: string;
  store_id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  active: number;
}

export interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  tax_rate: number;
  logo_url?: string;
  timezone: string;
}

export interface ProductCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  product_count?: number;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string;
  category_name?: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_threshold: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  credit_limit: number;
  current_balance: number;
  notes?: string;
  status: 'active' | 'suspended';
  created_at: string;
  total_purchases?: number;
  total_transactions?: number;
}

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'qris'
  | 'ewallet'
  | 'split'
  | 'partial'
  | 'credit';

export type PaymentStatus = 'paid' | 'partially_paid' | 'unpaid' | 'refunded';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  cost_price: number;
  quantity: number;
  discount_amount: number;
  subtotal: number;
}

export interface PaymentRecord {
  id: string;
  sale_id: string;
  payment_method: string;
  amount: number;
  reference_code?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  store_id: string;
  transaction_number: string;
  cashier_id: string;
  cashier_name?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  change_amount: number;
  payment_type: PaymentMethod;
  payment_status: PaymentStatus;
  notes?: string;
  created_at: string;
  items?: SaleItem[];
  payments?: PaymentRecord[];
  credit_account_id?: string;
}

export type CreditStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

export interface CreditPayment {
  id: string;
  credit_account_id: string;
  payment_reference: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes?: string;
  received_by: string;
  received_by_name?: string;
  created_at: string;
}

export interface CreditAccount {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  sale_id: string;
  transaction_number: string;
  original_amount: number;
  amount_paid: number;
  remaining_balance: number;
  due_date: string;
  status: CreditStatus;
  created_at: string;
  updated_at: string;
  days_overdue?: number;
  aging_category?: string;
  repayments?: CreditPayment[];
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  business_id: string;
  store_id: string;
  supplier_id: string;
  supplier_name?: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  payment_status: 'paid' | 'unpaid';
  notes?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  items?: PurchaseItem[];
}

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'return' | 'loss';
  quantity: number;
  balance_after: number;
  reference_type: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

export interface DashboardMetrics {
  todaySales: number;
  todayTransactions: number;
  avgTransactionValue: number;
  cashSales: number;
  nonCashSales: number;
  creditSales: number;
  totalOutstandingDebt: number;
  totalRepaymentsReceived: number;
  customersWithDebtCount: number;
  overdueAccountsCount: number;
  totalProductsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValuationCost: number;
  inventoryValuationRetail: number;
  recentSales: Sale[];
  overdueCredits: CreditAccount[];
  salesTrend: { date: string; cash: number; credit: number; total: number }[];
  paymentDistribution: { name: string; value: number; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  agingDistribution: { category: string; label: string; amount: number; count: number }[];
}
