import { Router } from 'express';
import crypto from 'node:crypto';
import { db, runTransaction, seedDatabase } from './db.ts';
import {
  calculateSaleTotals,
  calculatePaymentBreakdown,
  validateCreditPurchase,
  calculateCreditAging,
  applyCreditRepayment,
} from '../src/lib/financial.ts';

export const apiRouter = Router();

// Current active user session (in a production app this would use JWT/session cookies, here we support session switcher)
let activeUserId = 'usr_owner_01';

// Middleware to get current active user and enforce business tenancy
apiRouter.use((req, res, next) => {
  const customUserId = req.headers['x-user-id'] as string;
  const currentId = customUserId || activeUserId;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(currentId) as any;
  (req as any).user = user || db.prepare('SELECT * FROM users LIMIT 1').get();
  next();
});

// Helper to audit log
function recordAudit(userId: string, action: string, entityType: string, entityId?: string, details?: string) {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details)
    VALUES (?, 'biz_berkah_01', ?, ?, ?, ?, ?)
  `).run(id, userId, action, entityType, entityId || null, details || null);
}

// ----------------------------------------------------
// AUTH & USERS
// ----------------------------------------------------
apiRouter.get('/auth/me', (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, user });
});

apiRouter.get('/auth/users', (req, res) => {
  const users = db.prepare('SELECT id, name, username, email, role, active FROM users').all();
  res.json({ success: true, users, activeUserId });
});

apiRouter.post('/auth/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  activeUserId = userId;
  res.json({ success: true, user });
});

// ----------------------------------------------------
// BUSINESS & SETTINGS
// ----------------------------------------------------
apiRouter.get('/business', (req, res) => {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get('biz_berkah_01');
  const store = db.prepare('SELECT * FROM stores WHERE business_id = ? AND is_default = 1').get('biz_berkah_01');
  res.json({ success: true, business: biz, store });
});

apiRouter.put('/business', (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'owner') {
    return res.status(403).json({ success: false, error: 'Only owners can modify business settings' });
  }
  const { name, address, phone, email, currency, tax_rate, timezone } = req.body;
  db.prepare(`
    UPDATE businesses
    SET name = ?, address = ?, phone = ?, email = ?, currency = ?, tax_rate = ?, timezone = ?
    WHERE id = ?
  `).run(name, address, phone, email, currency || 'IDR', tax_rate || 0, timezone || 'Asia/Jakarta', 'biz_berkah_01');

  recordAudit(user.id, 'update', 'business', 'biz_berkah_01', `Updated business profile: ${name}`);
  res.json({ success: true, message: 'Business settings updated' });
});

// ----------------------------------------------------
// CATEGORIES
// ----------------------------------------------------
apiRouter.get('/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) as product_count
    FROM product_categories c
    WHERE c.business_id = 'biz_berkah_01'
    ORDER BY c.name ASC
  `).all();
  res.json({ success: true, categories });
});

apiRouter.post('/categories', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Category name is required' });

  const id = `cat_${Date.now()}`;
  db.prepare(`
    INSERT INTO product_categories (id, business_id, name, description)
    VALUES (?, 'biz_berkah_01', ?, ?)
  `).run(id, name, description || '');

  res.json({ success: true, category: { id, name, description } });
});

// ----------------------------------------------------
// PRODUCTS & INVENTORY
// ----------------------------------------------------
apiRouter.get('/products', (req, res) => {
  const { search, category_id, low_stock } = req.query;
  let sql = `
    SELECT p.*, c.name as category_name
    FROM products p
    JOIN product_categories c ON p.category_id = c.id
    WHERE p.business_id = 'biz_berkah_01' AND p.is_active = 1
  `;
  const params: any[] = [];

  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (low_stock === 'true') {
    sql += ' AND p.current_stock <= p.min_stock_threshold';
  }

  sql += ' ORDER BY p.name ASC';
  const products = db.prepare(sql).all(...params);
  res.json({ success: true, products });
});

apiRouter.post('/products', (req, res) => {
  const user = (req as any).user;
  if (user.role === 'cashier') {
    return res.status(403).json({ success: false, error: 'Cashiers cannot create products' });
  }

  const { category_id, sku, barcode, name, description, unit, purchase_price, selling_price, current_stock, min_stock_threshold } = req.body;
  if (!name || !sku || !barcode || !category_id) {
    return res.status(400).json({ success: false, error: 'Name, SKU, Barcode and Category are required' });
  }

  try {
    const id = `prd_${Date.now()}`;
    const stock = Number(current_stock) || 0;

    runTransaction(() => {
      db.prepare(`
        INSERT INTO products (
          id, business_id, category_id, sku, barcode, name, description, unit,
          purchase_price, selling_price, current_stock, min_stock_threshold
        ) VALUES (?, 'biz_berkah_01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, category_id, sku, barcode, name, description || '', unit || 'pcs',
        Number(purchase_price) || 0, Number(selling_price) || 0, stock, Number(min_stock_threshold) || 5
      );

      if (stock > 0) {
        db.prepare(`
          INSERT INTO inventory_movements (
            id, business_id, product_id, movement_type, quantity, balance_after, reference_type, notes, created_by
          ) VALUES (?, 'biz_berkah_01', ?, 'adjustment', ?, ?, 'initial_stock', 'Initial product stock', ?)
        `).run(`mov_${Date.now()}`, id, stock, stock, user.id);
      }
    });

    recordAudit(user.id, 'create', 'product', id, `Created product ${name} (SKU: ${sku})`);
    res.json({ success: true, id, message: 'Product created successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.put('/products/:id', (req, res) => {
  const user = (req as any).user;
  if (user.role === 'cashier') {
    return res.status(403).json({ success: false, error: 'Cashiers cannot edit products' });
  }

  const { id } = req.params;
  const { category_id, sku, barcode, name, description, unit, purchase_price, selling_price, min_stock_threshold } = req.body;

  try {
    db.prepare(`
      UPDATE products
      SET category_id = ?, sku = ?, barcode = ?, name = ?, description = ?, unit = ?,
          purchase_price = ?, selling_price = ?, min_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = 'biz_berkah_01'
    `).run(
      category_id, sku, barcode, name, description || '', unit || 'pcs',
      Number(purchase_price) || 0, Number(selling_price) || 0, Number(min_stock_threshold) || 5, id
    );

    recordAudit(user.id, 'update', 'product', id, `Updated product ${name}`);
    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/products/:id/adjust-stock', (req, res) => {
  const user = (req as any).user;
  if (user.role === 'cashier') {
    return res.status(403).json({ success: false, error: 'Cashiers cannot manually adjust stock' });
  }

  const { id } = req.params;
  const { adjustment_type, quantity, notes } = req.body; // adjustment_type: 'adjustment' | 'loss' | 'return'
  const qty = Number(quantity);

  if (!qty || isNaN(qty)) {
    return res.status(400).json({ success: false, error: 'Valid adjustment quantity is required' });
  }

  try {
    runTransaction(() => {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!prod) throw new Error('Product not found');

      let newStock = prod.current_stock;
      if (adjustment_type === 'adjustment') {
        newStock = qty; // Direct stock count reset
      } else if (adjustment_type === 'loss') {
        newStock = Math.max(0, prod.current_stock - Math.abs(qty));
      } else if (adjustment_type === 'return') {
        newStock = prod.current_stock + Math.abs(qty);
      }

      db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newStock, id);

      const movId = `mov_${Date.now()}`;
      db.prepare(`
        INSERT INTO inventory_movements (
          id, business_id, product_id, movement_type, quantity, balance_after, reference_type, notes, created_by
        ) VALUES (?, 'biz_berkah_01', ?, ?, ?, ?, 'manual_adjustment', ?, ?)
      `).run(movId, id, adjustment_type, newStock - prod.current_stock, newStock, notes || 'Penyesuaian stok manual', user.id);
    });

    recordAudit(user.id, 'adjust_stock', 'product', id, `Adjusted stock for product ${id}: ${notes}`);
    res.json({ success: true, message: 'Stock adjusted successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// CUSTOMERS & PROFILES
// ----------------------------------------------------
apiRouter.get('/customers', (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT c.*,
      (SELECT count(*) FROM sales s WHERE s.customer_id = c.id) as total_transactions,
      (SELECT COALESCE(sum(s.grand_total), 0) FROM sales s WHERE s.customer_id = c.id) as total_purchases
    FROM customers c
    WHERE c.business_id = 'biz_berkah_01'
  `;
  const params: any[] = [];
  if (search) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  sql += ' ORDER BY c.name ASC';
  const customers = db.prepare(sql).all(...params);
  res.json({ success: true, customers });
});

apiRouter.get('/customers/:id', (req, res) => {
  const { id } = req.params;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  // Purchases history
  const sales = db.prepare(`
    SELECT * FROM sales
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(id);

  // Credit accounts history with repayments
  const credits = db.prepare(`
    SELECT ca.*, s.transaction_number
    FROM credit_accounts ca
    JOIN sales s ON ca.sale_id = s.id
    WHERE ca.customer_id = ?
    ORDER BY ca.created_at DESC
  `).all(id) as any[];

  for (const c of credits) {
    c.repayments = db.prepare(`
      SELECT cp.*, u.name as received_by_name
      FROM credit_payments cp
      JOIN users u ON cp.received_by = u.id
      WHERE cp.credit_account_id = ?
      ORDER BY cp.created_at DESC
    `).all(c.id);

    const aging = calculateCreditAging(c.due_date, c.remaining_balance);
    c.aging_category = aging.category;
    c.aging_label = aging.categoryLabel;
    c.is_overdue = aging.isOverdue;
    c.days_overdue = aging.daysDiff;
  }

  res.json({ success: true, customer, sales, credits });
});

apiRouter.post('/customers', (req, res) => {
  const { name, phone, email, address, credit_limit, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }

  const id = `cust_${Date.now()}`;
  db.prepare(`
    INSERT INTO customers (id, business_id, name, phone, email, address, credit_limit, current_balance, notes)
    VALUES (?, 'biz_berkah_01', ?, ?, ?, ?, ?, 0, ?)
  `).run(id, name, phone, email || '', address || '', Number(credit_limit) || 1000000, notes || '');

  const user = (req as any).user;
  recordAudit(user.id, 'create', 'customer', id, `Registered customer ${name}`);
  res.json({ success: true, customer: { id, name, phone, address, credit_limit, current_balance: 0 } });
});

apiRouter.put('/customers/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, credit_limit, notes, status } = req.body;

  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, email = ?, address = ?, credit_limit = ?, notes = ?, status = ?
    WHERE id = ? AND business_id = 'biz_berkah_01'
  `).run(name, phone, email || '', address || '', Number(credit_limit) || 1000000, notes || '', status || 'active', id);

  res.json({ success: true, message: 'Customer updated successfully' });
});

// ----------------------------------------------------
// POS CHECKOUT & SALES TRANSACTIONS (ATOMIC)
// ----------------------------------------------------
apiRouter.post('/sales', (req, res) => {
  const user = (req as any).user;
  const {
    customer_id,
    items, // Array of { product_id, quantity, discount }
    transaction_discount = 0,
    payment_type, // 'cash' | 'bank_transfer' | 'qris' | 'ewallet' | 'split' | 'partial' | 'credit'
    amount_paid = 0,
    payments_list = [], // For split payments: [{ method, amount, reference }]
    due_date, // Required if remaining > 0 (credit / partial)
    notes,
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: 'Cannot checkout with an empty cart' });
  }

  try {
    const saleResult = runTransaction(() => {
      // 1. Fetch current business settings (for tax rate)
      const biz = db.prepare('SELECT tax_rate FROM businesses WHERE id = ?').get('biz_berkah_01') as any;
      const taxRate = biz?.tax_rate || 0;

      // 2. Validate and recalculate all item totals securely from current database product prices
      const validatedItems: any[] = [];
      const itemCalcs: any[] = [];

      for (const item of items) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id) as any;
        if (!prod) {
          throw new Error(`Product ${item.product_id} is no longer available`);
        }

        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        if (prod.current_stock < qty) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.current_stock}, requested: ${qty}`);
        }

        const itemDisc = Math.min(prod.selling_price * qty, Math.max(0, Number(item.discount) || 0));
        const subtotal = (prod.selling_price * qty) - itemDisc;

        validatedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          unit_price: prod.selling_price,
          cost_price: prod.purchase_price,
          quantity: qty,
          discount_amount: itemDisc,
          subtotal,
          current_stock: prod.current_stock,
        });

        itemCalcs.push({
          price: prod.selling_price,
          quantity: qty,
          discount: itemDisc,
        });
      }

      // 3. Compute accurate financial totals
      const totals = calculateSaleTotals(itemCalcs, Number(transaction_discount) || 0, taxRate);
      const paidNum = Number(amount_paid) || 0;
      const breakdown = calculatePaymentBreakdown(totals.grandTotal, paidNum);

      // 4. Critical business logic check for Credit / Partial Payment:
      if (breakdown.remainingBalance > 0) {
        if (!customer_id) {
          throw new Error('Credit purchases or partial payments must be linked to a registered customer account. Anonymous customers cannot take debt.');
        }

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id) as any;
        if (!customer) {
          throw new Error('Customer account not found');
        }
        if (customer.status !== 'active') {
          throw new Error(`Customer account is ${customer.status}. Credit purchases are suspended.`);
        }

        // Validate credit limit
        const creditCheck = validateCreditPurchase(customer.current_balance, customer.credit_limit, breakdown.remainingBalance);
        if (!creditCheck.allowed) {
          throw new Error(creditCheck.error);
        }
      }

      // 5. Generate unique transaction number TRX-YYYYMMDD-XXXX
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = db.prepare(`SELECT count(*) as count FROM sales WHERE transaction_number LIKE 'TRX-${datePart}-%'`).get() as { count: number };
      const seq = String(countToday.count + 1).padStart(4, '0');
      const transactionNumber = `TRX-${datePart}-${seq}`;
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 6. Insert Sale record
      db.prepare(`
        INSERT INTO sales (
          id, business_id, store_id, transaction_number, cashier_id, customer_id,
          sale_date, subtotal, discount_amount, tax_amount, grand_total, amount_paid,
          change_amount, payment_type, payment_status, notes, created_at
        ) VALUES (?, 'biz_berkah_01', 'store_pusat_01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId,
        transactionNumber,
        user.id,
        customer_id || null,
        nowIso,
        totals.netItemsSubtotal,
        totals.transactionDiscount,
        totals.taxAmount,
        totals.grandTotal,
        breakdown.amountPaid,
        breakdown.changeAmount,
        payment_type,
        breakdown.paymentStatus,
        notes || '',
        nowIso
      );

      // 7. Insert Sale Items, decrement inventory, and write inventory_movements
      const insertItem = db.prepare(`
        INSERT INTO sale_items (
          id, sale_id, product_id, product_name, sku, unit_price, cost_price, quantity, discount_amount, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (
          id, business_id, product_id, movement_type, quantity, balance_after, reference_type, reference_id, notes, created_by
        ) VALUES (?, 'biz_berkah_01', ?, 'sale', ?, ?, 'sale', ?, ?, ?)
      `);

      for (let i = 0; i < validatedItems.length; i++) {
        const it = validatedItems[i];
        const itemId = `si_${saleId}_${i}`;
        insertItem.run(itemId, saleId, it.product_id, it.product_name, it.sku, it.unit_price, it.cost_price, it.quantity, it.discount_amount, it.subtotal);

        const newStock = it.current_stock - it.quantity;
        updateStock.run(newStock, it.product_id);
        insertMovement.run(
          `mov_${Date.now()}_${i}`,
          it.product_id,
          -it.quantity,
          newStock,
          saleId,
          `Penjualan kasir #${transactionNumber}`,
          user.id
        );
      }

      // 8. Record payments
      const insertPayment = db.prepare(`
        INSERT INTO payments (id, sale_id, payment_method, amount, reference_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      if (payments_list && payments_list.length > 0) {
        for (let j = 0; j < payments_list.length; j++) {
          const p = payments_list[j];
          insertPayment.run(`pay_${saleId}_${j}`, saleId, p.method, Number(p.amount) || 0, p.reference || null, nowIso);
        }
      } else if (paidNum > 0) {
        insertPayment.run(`pay_${saleId}_0`, saleId, payment_type, paidNum, `${payment_type.toUpperCase()}-${seq}`, nowIso);
      }

      // 9. If remaining debt exists, create credit_account and update customer balance
      let creditAccountId: string | undefined = undefined;
      if (breakdown.remainingBalance > 0) {
        creditAccountId = `cacc_${Date.now()}`;
        const defaultDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
        const resolvedDueDate = due_date || defaultDue;

        db.prepare(`
          INSERT INTO credit_accounts (
            id, business_id, customer_id, sale_id, original_amount, amount_paid, remaining_balance, due_date, status, created_at, updated_at
          ) VALUES (?, 'biz_berkah_01', ?, ?, ?, 0, ?, ?, 'unpaid', ?, ?)
        `).run(
          creditAccountId,
          customer_id,
          saleId,
          breakdown.remainingBalance,
          breakdown.remainingBalance,
          resolvedDueDate,
          nowIso,
          nowIso
        );

        // Update customer balance atomically
        db.prepare(`
          UPDATE customers
          SET current_balance = current_balance + ?
          WHERE id = ?
        `).run(breakdown.remainingBalance, customer_id);
      }

      recordAudit(user.id, 'create_sale', 'sale', saleId, `Processed checkout ${transactionNumber} total: Rp ${totals.grandTotal}`);

      // Return complete sale object with items for instant receipt
      const createdCustomer = customer_id
        ? db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(customer_id)
        : null;

      return {
        id: saleId,
        transaction_number: transactionNumber,
        sale_date: nowIso,
        items: validatedItems,
        subtotal: totals.netItemsSubtotal,
        discount_amount: totals.transactionDiscount,
        tax_amount: totals.taxAmount,
        grand_total: totals.grandTotal,
        amount_paid: breakdown.amountPaid,
        change_amount: breakdown.changeAmount,
        remaining_balance: breakdown.remainingBalance,
        payment_type,
        payment_status: breakdown.paymentStatus,
        customer: createdCustomer,
        credit_account_id: creditAccountId,
        due_date: breakdown.remainingBalance > 0 ? (due_date || '14 hari kedepan') : null,
      };
    });

    res.json({ success: true, sale: saleResult });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// List Sales
apiRouter.get('/sales', (req, res) => {
  const { date_from, date_to, customer_id, payment_type, payment_status, limit = 50 } = req.query;
  let sql = `
    SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.business_id = 'biz_berkah_01'
  `;
  const params: any[] = [];

  if (date_from) {
    sql += ' AND s.sale_date >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND s.sale_date <= ?';
    params.push(`${date_to} 23:59:59`);
  }
  if (customer_id) {
    sql += ' AND s.customer_id = ?';
    params.push(customer_id);
  }
  if (payment_type) {
    sql += ' AND s.payment_type = ?';
    params.push(payment_type);
  }
  if (payment_status) {
    sql += ' AND s.payment_status = ?';
    params.push(payment_status);
  }

  sql += ' ORDER BY s.sale_date DESC LIMIT ?';
  params.push(Number(limit) || 50);

  const sales = db.prepare(sql).all(...params);
  res.json({ success: true, sales });
});

// Sale detail
apiRouter.get('/sales/:id', (req, res) => {
  const { id } = req.params;
  const sale = db.prepare(`
    SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `).get(id) as any;

  if (!sale) {
    return res.status(404).json({ success: false, error: 'Sale not found' });
  }

  sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  sale.payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(id);
  sale.credit = db.prepare('SELECT * FROM credit_accounts WHERE sale_id = ?').get(id);

  res.json({ success: true, sale });
});

// ----------------------------------------------------
// CREDIT & DEBT MANAGEMENT
// ----------------------------------------------------
apiRouter.get('/credits', (req, res) => {
  const { status, customer_id, aging_filter } = req.query;
  let sql = `
    SELECT ca.*, c.name as customer_name, c.phone as customer_phone, c.credit_limit, c.current_balance as customer_total_balance,
           s.transaction_number, s.sale_date
    FROM credit_accounts ca
    JOIN customers c ON ca.customer_id = c.id
    JOIN sales s ON ca.sale_id = s.id
    WHERE ca.business_id = 'biz_berkah_01'
  `;
  const params: any[] = [];

  if (customer_id) {
    sql += ' AND ca.customer_id = ?';
    params.push(customer_id);
  }
  if (status) {
    sql += ' AND ca.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY ca.due_date ASC, ca.remaining_balance DESC';
  const credits = db.prepare(sql).all(...params) as any[];

  // Dynamic aging calculation
  const enriched = credits.map((c) => {
    const aging = calculateCreditAging(c.due_date, c.remaining_balance);
    const isOverdue = aging.isOverdue;
    // Auto-update status to overdue if unpaid and past due date
    if (isOverdue && (c.status === 'unpaid' || c.status === 'partially_paid')) {
      c.status = 'overdue';
    }
    return {
      ...c,
      aging_category: aging.category,
      aging_label: aging.categoryLabel,
      is_overdue: isOverdue,
      days_overdue: aging.daysDiff,
    };
  });

  if (aging_filter) {
    const filtered = enriched.filter((c) => c.aging_category === aging_filter);
    return res.json({ success: true, credits: filtered });
  }

  res.json({ success: true, credits: enriched });
});

apiRouter.get('/credits/:id', (req, res) => {
  const { id } = req.params;
  const credit = db.prepare(`
    SELECT ca.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, c.credit_limit, c.current_balance,
           s.transaction_number, s.sale_date
    FROM credit_accounts ca
    JOIN customers c ON ca.customer_id = c.id
    JOIN sales s ON ca.sale_id = s.id
    WHERE ca.id = ?
  `).get(id) as any;

  if (!credit) {
    return res.status(404).json({ success: false, error: 'Credit account not found' });
  }

  credit.repayments = db.prepare(`
    SELECT cp.*, u.name as received_by_name
    FROM credit_payments cp
    JOIN users u ON cp.received_by = u.id
    WHERE cp.credit_account_id = ?
    ORDER BY cp.created_at DESC
  `).all(id);

  const aging = calculateCreditAging(credit.due_date, credit.remaining_balance);
  credit.aging_category = aging.category;
  credit.aging_label = aging.categoryLabel;
  credit.is_overdue = aging.isOverdue;
  credit.days_overdue = aging.daysDiff;

  res.json({ success: true, credit });
});

// Atomic Credit Repayment
apiRouter.post('/credits/:id/repay', (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { amount, payment_method = 'cash', notes } = req.body;
  const payAmount = Number(amount);

  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
  }

  try {
    const result = runTransaction(() => {
      const credit = db.prepare('SELECT * FROM credit_accounts WHERE id = ?').get(id) as any;
      if (!credit) throw new Error('Credit account not found');
      if (credit.remaining_balance <= 0) throw new Error('This credit account is already fully paid');

      const repaymentCalc = applyCreditRepayment(credit.remaining_balance, payAmount);
      const effectivePayment = payAmount - repaymentCalc.excessChange;
      const newPaidTotal = credit.amount_paid + effectivePayment;
      const newBalance = repaymentCalc.newRemainingBalance;
      const newStatus = repaymentCalc.isFullySettled ? 'paid' : 'partially_paid';

      // 1. Generate unique payment reference PAY-YYYYMMDD-XXXX
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = db.prepare(`SELECT count(*) as count FROM credit_payments WHERE payment_reference LIKE 'PAY-${datePart}-%'`).get() as { count: number };
      const ref = `PAY-${datePart}-${String(countToday.count + 1).padStart(4, '0')}`;
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 2. Insert into credit_payments (never overwriting previous history)
      const payId = `cpay_${Date.now()}`;
      db.prepare(`
        INSERT INTO credit_payments (
          id, credit_account_id, payment_reference, payment_date, amount, payment_method, notes, received_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(payId, id, ref, nowIso, effectivePayment, payment_method, notes || '', user.id, nowIso);

      // 3. Update credit_accounts balance & status
      db.prepare(`
        UPDATE credit_accounts
        SET amount_paid = ?, remaining_balance = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(newPaidTotal, newBalance, newStatus, nowIso, id);

      // 4. Update customer master balance
      db.prepare(`
        UPDATE customers
        SET current_balance = MAX(0, current_balance - ?)
        WHERE id = ?
      `).run(effectivePayment, credit.customer_id);

      // 5. Update parent sale status if fully paid
      if (repaymentCalc.isFullySettled) {
        db.prepare('UPDATE sales SET payment_status = ? WHERE id = ?').run('paid', credit.sale_id);
      }

      recordAudit(user.id, 'repayment', 'credit_account', id, `Received repayment ${ref} of Rp ${effectivePayment} for credit #${id}`);

      const cust = db.prepare('SELECT name, phone, current_balance FROM customers WHERE id = ?').get(credit.customer_id) as any;
      const sale = db.prepare('SELECT transaction_number FROM sales WHERE id = ?').get(credit.sale_id) as any;

      return {
        payment_reference: ref,
        payment_date: nowIso,
        amount_paid: effectivePayment,
        excess_change: repaymentCalc.excessChange,
        remaining_balance: newBalance,
        status: newStatus,
        customer_name: cust.name,
        customer_phone: cust.phone,
        customer_remaining_total: cust.current_balance,
        transaction_number: sale.transaction_number,
        received_by_name: user.name,
      };
    });

    res.json({ success: true, repayment: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// SUPPLIERS & PURCHASING
// ----------------------------------------------------
apiRouter.get('/suppliers', (req, res) => {
  const suppliers = db.prepare(`
    SELECT s.*, (SELECT count(*) FROM purchases p WHERE p.supplier_id = s.id) as total_purchases
    FROM suppliers s
    WHERE s.business_id = 'biz_berkah_01'
    ORDER BY s.name ASC
  `).all();
  res.json({ success: true, suppliers });
});

apiRouter.post('/suppliers', (req, res) => {
  const { name, contact_person, phone, email, address, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone are required' });

  const id = `sup_${Date.now()}`;
  db.prepare(`
    INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, address, notes)
    VALUES (?, 'biz_berkah_01', ?, ?, ?, ?, ?, ?)
  `).run(id, name, contact_person || '', phone, email || '', address || '', notes || '');

  res.json({ success: true, supplier: { id, name, phone } });
});

apiRouter.get('/purchases', (req, res) => {
  const purchases = db.prepare(`
    SELECT p.*, s.name as supplier_name, u.name as created_by_name
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN users u ON p.created_by = u.id
    WHERE p.business_id = 'biz_berkah_01'
    ORDER BY p.purchase_date DESC
  `).all() as any[];

  for (const p of purchases) {
    p.items = db.prepare(`
      SELECT pi.*, pr.name as product_name, pr.sku
      FROM purchase_items pi
      JOIN products pr ON pi.product_id = pr.id
      WHERE pi.purchase_id = ?
    `).all(p.id);
  }

  res.json({ success: true, purchases });
});

// Record purchase / Goods receiving from supplier
apiRouter.post('/purchases', (req, res) => {
  const user = (req as any).user;
  if (user.role === 'cashier') {
    return res.status(403).json({ success: false, error: 'Cashiers cannot record supplier purchases' });
  }

  const { supplier_id, invoice_number, items, notes } = req.body;
  if (!supplier_id || !invoice_number || !items || !items.length) {
    return res.status(400).json({ success: false, error: 'Supplier, Invoice #, and items are required' });
  }

  try {
    const purchaseResult = runTransaction(() => {
      let totalAmount = 0;
      const validatedItems: any[] = [];

      for (const it of items) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id) as any;
        if (!prod) throw new Error(`Product ${it.product_id} not found`);

        const qty = Math.max(1, Number(it.quantity));
        const cost = Math.max(0, Number(it.unit_cost));
        const subtotal = qty * cost;
        totalAmount += subtotal;

        validatedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          quantity: qty,
          unit_cost: cost,
          subtotal,
          current_stock: prod.current_stock,
        });
      }

      const purchaseId = `po_${Date.now()}`;
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.prepare(`
        INSERT INTO purchases (
          id, business_id, store_id, supplier_id, invoice_number, purchase_date, total_amount, payment_status, notes, created_by, created_at
        ) VALUES (?, 'biz_berkah_01', 'store_pusat_01', ?, ?, ?, ?, 'paid', ?, ?, ?)
      `).run(purchaseId, supplier_id, invoice_number, nowIso, totalAmount, notes || '', user.id, nowIso);

      const insertItem = db.prepare(`
        INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const updateProduct = db.prepare(`
        UPDATE products
        SET current_stock = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const insertMovement = db.prepare(`
        INSERT INTO inventory_movements (
          id, business_id, product_id, movement_type, quantity, balance_after, reference_type, reference_id, notes, created_by
        ) VALUES (?, 'biz_berkah_01', ?, 'purchase', ?, ?, 'purchase_order', ?, ?, ?)
      `);

      for (let i = 0; i < validatedItems.length; i++) {
        const it = validatedItems[i];
        insertItem.run(`poi_${purchaseId}_${i}`, purchaseId, it.product_id, it.quantity, it.unit_cost, it.subtotal);

        const newStock = it.current_stock + it.quantity;
        // Also update latest purchase price if specified
        updateProduct.run(newStock, it.unit_cost, it.product_id);

        insertMovement.run(
          `mov_${Date.now()}_${i}`,
          it.product_id,
          it.quantity,
          newStock,
          purchaseId,
          `Penerimaan barang dari supplier (Inv: ${invoice_number})`,
          user.id
        );
      }

      recordAudit(user.id, 'receive_purchase', 'purchase', purchaseId, `Received goods for PO ${invoice_number} total Rp ${totalAmount}`);
      return { id: purchaseId, invoice_number, total_amount: totalAmount };
    });

    res.json({ success: true, purchase: purchaseResult });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// INVENTORY MOVEMENTS AUDIT LOG
// ----------------------------------------------------
apiRouter.get('/inventory/movements', (req, res) => {
  const { product_id, movement_type, limit = 50 } = req.query;
  let sql = `
    SELECT im.*, p.name as product_name, p.sku, u.name as created_by_name
    FROM inventory_movements im
    JOIN products p ON im.product_id = p.id
    LEFT JOIN users u ON im.created_by = u.id
    WHERE im.business_id = 'biz_berkah_01'
  `;
  const params: any[] = [];
  if (product_id) {
    sql += ' AND im.product_id = ?';
    params.push(product_id);
  }
  if (movement_type) {
    sql += ' AND im.movement_type = ?';
    params.push(movement_type);
  }

  sql += ' ORDER BY im.created_at DESC LIMIT ?';
  params.push(Number(limit) || 50);

  const movements = db.prepare(sql).all(...params);
  res.json({ success: true, movements });
});

// ----------------------------------------------------
// DASHBOARD & ANALYTICS (REAL DATABASE CALCULATIONS)
// ----------------------------------------------------
apiRouter.get('/dashboard', (req, res) => {
  const todayDate = new Date().toISOString().slice(0, 10);

  // Today's sales metrics
  const todayStats = db.prepare(`
    SELECT
      COALESCE(sum(grand_total), 0) as todaySales,
      count(*) as todayTransactions,
      COALESCE(avg(grand_total), 0) as avgTransactionValue,
      COALESCE(sum(CASE WHEN payment_type = 'cash' THEN grand_total ELSE 0 END), 0) as cashSales,
      COALESCE(sum(CASE WHEN payment_type IN ('bank_transfer', 'qris', 'ewallet') THEN grand_total ELSE 0 END), 0) as nonCashSales,
      COALESCE(sum(CASE WHEN payment_type = 'credit' OR payment_status = 'partially_paid' THEN (grand_total - amount_paid) ELSE 0 END), 0) as creditSales
    FROM sales
    WHERE business_id = 'biz_berkah_01' AND date(sale_date) = date(?)
  `).get(todayDate) as any;

  // Credit overview
  const creditStats = db.prepare(`
    SELECT
      COALESCE(sum(remaining_balance), 0) as totalOutstandingDebt,
      COALESCE(sum(amount_paid), 0) as totalRepaymentsReceived,
      count(DISTINCT customer_id) as customersWithDebtCount
    FROM credit_accounts
    WHERE business_id = 'biz_berkah_01' AND remaining_balance > 0
  `).get() as any;

  // Overdue count
  const allUnpaidCredits = db.prepare(`
    SELECT due_date, remaining_balance
    FROM credit_accounts
    WHERE business_id = 'biz_berkah_01' AND remaining_balance > 0
  `).all() as any[];

  let overdueCount = 0;
  for (const c of allUnpaidCredits) {
    const aging = calculateCreditAging(c.due_date, c.remaining_balance);
    if (aging.isOverdue) overdueCount++;
  }

  // Inventory stats
  const invStats = db.prepare(`
    SELECT
      count(*) as totalProductsCount,
      COALESCE(sum(CASE WHEN current_stock <= min_stock_threshold AND current_stock > 0 THEN 1 ELSE 0 END), 0) as lowStockCount,
      COALESCE(sum(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END), 0) as outOfStockCount,
      COALESCE(sum(current_stock * purchase_price), 0) as inventoryValuationCost,
      COALESCE(sum(current_stock * selling_price), 0) as inventoryValuationRetail
    FROM products
    WHERE business_id = 'biz_berkah_01' AND is_active = 1
  `).get() as any;

  // Recent 5 sales
  const recentSales = db.prepare(`
    SELECT s.*, c.name as customer_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.business_id = 'biz_berkah_01'
    ORDER BY s.sale_date DESC LIMIT 5
  `).all();

  // Top overdue credits
  const overdueCredits = db.prepare(`
    SELECT ca.*, c.name as customer_name, c.phone as customer_phone, s.transaction_number
    FROM credit_accounts ca
    JOIN customers c ON ca.customer_id = c.id
    JOIN sales s ON ca.sale_id = s.id
    WHERE ca.business_id = 'biz_berkah_01' AND ca.remaining_balance > 0
    ORDER BY ca.due_date ASC LIMIT 5
  `).all() as any[];

  const overdueList = overdueCredits.map((c) => {
    const ag = calculateCreditAging(c.due_date, c.remaining_balance);
    return { ...c, days_overdue: ag.daysDiff, aging_label: ag.categoryLabel };
  });

  // Sales trend past 7 days
  const salesTrendRows = db.prepare(`
    SELECT
      date(sale_date) as d,
      COALESCE(sum(CASE WHEN payment_type = 'cash' THEN grand_total ELSE 0 END), 0) as cash,
      COALESCE(sum(CASE WHEN payment_type = 'credit' OR payment_status = 'partially_paid' THEN (grand_total - amount_paid) ELSE 0 END), 0) as credit,
      COALESCE(sum(grand_total), 0) as total
    FROM sales
    WHERE business_id = 'biz_berkah_01'
    GROUP BY date(sale_date)
    ORDER BY date(sale_date) DESC
    LIMIT 7
  `).all() as any[];

  const salesTrend = salesTrendRows.reverse().map((r) => ({
    date: r.d ? r.d.substring(5) : '',
    cash: r.cash,
    credit: r.credit,
    total: r.total,
  }));

  // Payment distribution
  const paymentDist = db.prepare(`
    SELECT payment_type as name, sum(grand_total) as value, count(*) as count
    FROM sales
    WHERE business_id = 'biz_berkah_01'
    GROUP BY payment_type
  `).all() as any[];

  // Top 5 selling products
  const topProducts = db.prepare(`
    SELECT product_name as name, sum(quantity) as quantity, sum(subtotal) as revenue
    FROM sale_items
    GROUP BY product_id
    ORDER BY revenue DESC
    LIMIT 5
  `).all();

  // Aging distribution buckets
  const agingBuckets = {
    not_due: { category: 'not_due', label: 'Belum Jatuh Tempo', amount: 0, count: 0 },
    overdue_1_7: { category: 'overdue_1_7', label: '1–7 Hari', amount: 0, count: 0 },
    overdue_8_30: { category: 'overdue_8_30', label: '8–30 Hari', amount: 0, count: 0 },
    overdue_31_60: { category: 'overdue_31_60', label: '31–60 Hari', amount: 0, count: 0 },
    overdue_60_plus: { category: 'overdue_60_plus', label: '>60 Hari (Macet)', amount: 0, count: 0 },
  };

  for (const c of allUnpaidCredits) {
    const ag = calculateCreditAging(c.due_date, c.remaining_balance);
    const bucket = (agingBuckets as any)[ag.category] || agingBuckets.not_due;
    bucket.amount += c.remaining_balance;
    bucket.count += 1;
  }

  res.json({
    success: true,
    metrics: {
      todaySales: todayStats.todaySales,
      todayTransactions: todayStats.todayTransactions,
      avgTransactionValue: Math.round(todayStats.avgTransactionValue),
      cashSales: todayStats.cashSales,
      nonCashSales: todayStats.nonCashSales,
      creditSales: todayStats.creditSales,
      totalOutstandingDebt: creditStats.totalOutstandingDebt,
      totalRepaymentsReceived: creditStats.totalRepaymentsReceived,
      customersWithDebtCount: creditStats.customersWithDebtCount,
      overdueAccountsCount: overdueCount,
      totalProductsCount: invStats.totalProductsCount,
      lowStockCount: invStats.lowStockCount,
      outOfStockCount: invStats.outOfStockCount,
      inventoryValuationCost: invStats.inventoryValuationCost,
      inventoryValuationRetail: invStats.inventoryValuationRetail,
      recentSales,
      overdueCredits: overdueList,
      salesTrend,
      paymentDistribution: paymentDist,
      topProducts,
      agingDistribution: Object.values(agingBuckets),
    },
  });
});

// ----------------------------------------------------
// REPORTS (SALES, CREDIT AGING, INVENTORY, P&L)
// ----------------------------------------------------
apiRouter.get('/reports', (req, res) => {
  const { type = 'sales', date_from, date_to } = req.query;

  if (type === 'sales') {
    let sql = `
      SELECT date(sale_date) as period, count(*) as count, sum(grand_total) as revenue,
             sum(amount_paid) as cash_collected, sum(grand_total - amount_paid) as credit_issued
      FROM sales
      WHERE business_id = 'biz_berkah_01'
    `;
    const params: any[] = [];
    if (date_from) {
      sql += ' AND sale_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND sale_date <= ?';
      params.push(`${date_to} 23:59:59`);
    }
    sql += ' GROUP BY date(sale_date) ORDER BY date(sale_date) DESC';
    const reportData = db.prepare(sql).all(...params);
    return res.json({ success: true, report: reportData });
  }

  if (type === 'credit_aging') {
    const credits = db.prepare(`
      SELECT ca.*, c.name as customer_name, c.phone as customer_phone, s.transaction_number, s.sale_date
      FROM credit_accounts ca
      JOIN customers c ON ca.customer_id = c.id
      JOIN sales s ON ca.sale_id = s.id
      WHERE ca.business_id = 'biz_berkah_01' AND ca.remaining_balance > 0
      ORDER BY ca.due_date ASC
    `).all() as any[];

    const enriched = credits.map((c) => {
      const ag = calculateCreditAging(c.due_date, c.remaining_balance);
      return {
        ...c,
        aging_category: ag.category,
        aging_label: ag.categoryLabel,
        days_overdue: ag.daysDiff,
      };
    });

    return res.json({ success: true, report: enriched });
  }

  if (type === 'pnl') {
    // Gross Profit = Sales Revenue - Cost of Goods Sold
    const salesAgg = db.prepare(`
      SELECT
        COALESCE(sum(s.grand_total), 0) as total_revenue,
        COALESCE(sum(si.cost_price * si.quantity), 0) as total_cogs
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = 'biz_berkah_01'
    `).get() as any;

    const repaymentsCollected = db.prepare(`
      SELECT COALESCE(sum(amount), 0) as total_repayments
      FROM credit_payments
    `).get() as any;

    const outstandingDebt = db.prepare(`
      SELECT COALESCE(sum(remaining_balance), 0) as total_outstanding
      FROM credit_accounts
      WHERE remaining_balance > 0
    `).get() as any;

    const grossProfit = salesAgg.total_revenue - salesAgg.total_cogs;
    const profitMargin = salesAgg.total_revenue > 0 ? (grossProfit / salesAgg.total_revenue) * 100 : 0;

    return res.json({
      success: true,
      report: {
        totalRevenue: salesAgg.total_revenue,
        costOfGoodsSold: salesAgg.total_cogs,
        grossProfit,
        profitMargin: Math.round(profitMargin * 10) / 10,
        repaymentsCollected: repaymentsCollected.total_repayments,
        outstandingDebt: outstandingDebt.total_outstanding,
      },
    });
  }

  res.json({ success: true, report: [] });
});

// Reseed / Reset endpoint for dev testing
apiRouter.post('/seed/reset', (req, res) => {
  seedDatabase(true);
  res.json({ success: true, message: 'Database reset and re-seeded with demo dataset' });
});
