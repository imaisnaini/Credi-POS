import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'credipos.db');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys for concurrent reads & relational integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Executes a function within an ACID transaction.
 */
export function runTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Initialize all database tables, constraints, and indexes.
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      currency TEXT NOT NULL DEFAULT 'IDR',
      tax_rate REAL NOT NULL DEFAULT 0.0,
      logo_url TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'cashier', 'inventory_manager')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      purchase_price REAL NOT NULL CHECK(purchase_price >= 0),
      selling_price REAL NOT NULL CHECK(selling_price >= 0),
      current_stock INTEGER NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
      min_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(min_stock_threshold >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES product_categories(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      credit_limit REAL NOT NULL DEFAULT 1000000 CHECK(credit_limit >= 0),
      current_balance REAL NOT NULL DEFAULT 0 CHECK(current_balance >= 0),
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      purchase_date TEXT NOT NULL,
      total_amount REAL NOT NULL CHECK(total_amount >= 0),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('paid', 'unpaid')),
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      transaction_number TEXT NOT NULL UNIQUE,
      cashier_id TEXT NOT NULL,
      customer_id TEXT,
      sale_date TEXT NOT NULL,
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      discount_amount REAL NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
      tax_amount REAL NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
      grand_total REAL NOT NULL CHECK(grand_total >= 0),
      amount_paid REAL NOT NULL DEFAULT 0 CHECK(amount_paid >= 0),
      change_amount REAL NOT NULL DEFAULT 0 CHECK(change_amount >= 0),
      payment_type TEXT NOT NULL,
      payment_status TEXT NOT NULL CHECK(payment_status IN ('paid', 'partially_paid', 'unpaid', 'refunded')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (cashier_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      cost_price REAL NOT NULL DEFAULT 0 CHECK(cost_price >= 0),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      discount_amount REAL NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      reference_code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_accounts (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      sale_id TEXT NOT NULL UNIQUE,
      original_amount REAL NOT NULL CHECK(original_amount > 0),
      amount_paid REAL NOT NULL DEFAULT 0 CHECK(amount_paid >= 0),
      remaining_balance REAL NOT NULL CHECK(remaining_balance >= 0),
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS credit_payments (
      id TEXT PRIMARY KEY,
      credit_account_id TEXT NOT NULL,
      payment_reference TEXT NOT NULL UNIQUE,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      payment_method TEXT NOT NULL,
      notes TEXT,
      received_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (received_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('sale', 'purchase', 'adjustment', 'return', 'loss')),
      quantity INTEGER NOT NULL,
      balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_credit_status ON credit_accounts(status);
    CREATE INDEX IF NOT EXISTS idx_credit_customer ON credit_accounts(customer_id);
    CREATE INDEX IF NOT EXISTS idx_credit_due_date ON credit_accounts(due_date);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
  `);
}

/**
 * Seed full realistic demonstration dataset for Toko Sembako Berkah Mandiri.
 */
export function seedDatabase(force: boolean = false) {
  initDatabase();

  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0 && !force) {
    return;
  }

  runTransaction(() => {
    // If forcing reset, purge existing tables in order
    if (force) {
      db.exec(`
        DELETE FROM credit_payments;
        DELETE FROM credit_accounts;
        DELETE FROM payments;
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM purchase_items;
        DELETE FROM purchases;
        DELETE FROM inventory_movements;
        DELETE FROM products;
        DELETE FROM product_categories;
        DELETE FROM suppliers;
        DELETE FROM customers;
        DELETE FROM users;
        DELETE FROM stores;
        DELETE FROM businesses;
        DELETE FROM audit_logs;
      `);
    }

    const businessId = 'biz_berkah_01';
    const storeId = 'store_pusat_01';

    // 1. Business
    db.prepare(`
      INSERT INTO businesses (id, name, address, phone, email, currency, tax_rate, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      businessId,
      'Toko Sembako Berkah Mandiri',
      'Jl. Kemang Raya No. 18, Jakarta Selatan 12730',
      '0812-8899-7766',
      'berkah.mandiri@credipos.id',
      'IDR',
      0.0, // Retail groceries exempt by default
      'Asia/Jakarta'
    );

    // 2. Store
    db.prepare(`
      INSERT INTO stores (id, business_id, name, address, phone, is_default)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(storeId, businessId, 'Toko Utama (Kemang)', 'Jl. Kemang Raya No. 18, Jakarta Selatan', '0812-8899-7766');

    // 3. Users (Owner, Cashier 1, Cashier 2, Inventory Manager)
    const users = [
      { id: 'usr_owner_01', name: 'Hendra Wijaya', username: 'admin', email: 'hendra@berkah.id', role: 'owner' },
      { id: 'usr_cashier_01', name: 'Siti Rahma', username: 'kasir1', email: 'siti@berkah.id', role: 'cashier' },
      { id: 'usr_cashier_02', name: 'Dewi Lestari', username: 'kasir2', email: 'dewi@berkah.id', role: 'cashier' },
      { id: 'usr_inventory_01', name: 'Bambang Santoso', username: 'gudang', email: 'bambang@berkah.id', role: 'inventory_manager' },
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (id, business_id, store_id, name, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
      insertUser.run(u.id, businessId, storeId, u.name, u.username, u.email, 'hash_pass_123', u.role);
    }

    // 4. Categories
    const categories = [
      { id: 'cat_pokok', name: 'Bahan Pokok', description: 'Beras, gula, telur, tepung' },
      { id: 'cat_minyak_bumbu', name: 'Minyak & Bumbu', description: 'Minyak goreng, kecap, saus, garam, penyedap' },
      { id: 'cat_mie_instan', name: 'Mie & Makanan Siap Saji', description: 'Indomie, mie instan, sarden' },
      { id: 'cat_minuman', name: 'Minuman & Kopi', description: 'Kopi, teh, susu, air mineral' },
      { id: 'cat_snack', name: 'Makanan Ringan', description: 'Biskuit, keripik, camilan' },
      { id: 'cat_rumah', name: 'Kebutuhan Rumah', description: 'Sabun, deterjen, cairan pencuci piring' },
    ];

    const insertCat = db.prepare(`INSERT INTO product_categories (id, business_id, name, description) VALUES (?, ?, ?, ?)`);
    for (const c of categories) {
      insertCat.run(c.id, businessId, c.name, c.description);
    }

    // 5. Products (25 realistic products)
    const products = [
      { id: 'prd_01', cat: 'cat_mie_instan', sku: 'IND-GOR-01', bar: '8998866200112', name: 'Indomie Goreng Spesial 85g', buy: 2800, sell: 3500, stock: 150, min: 30, unit: 'bungkus' },
      { id: 'prd_02', cat: 'cat_mie_instan', sku: 'IND-AB-02', bar: '8998866200129', name: 'Indomie Kuah Ayam Bawang 69g', buy: 2800, sell: 3500, stock: 120, min: 30, unit: 'bungkus' },
      { id: 'prd_03', cat: 'cat_mie_instan', sku: 'IND-SK-03', bar: '8998866200136', name: 'Indomie Soto Mie 70g', buy: 2800, sell: 3500, stock: 95, min: 25, unit: 'bungkus' },
      { id: 'prd_04', cat: 'cat_pokok', sku: 'BRS-RAM-05', bar: '8991001500054', name: 'Beras Setra Ramos 5kg', buy: 65000, sell: 75000, stock: 25, min: 8, unit: 'karung' },
      { id: 'prd_05', cat: 'cat_pokok', sku: 'BRS-PDN-05', bar: '8991001500061', name: 'Beras Pandan Wangi Super 5kg', buy: 78000, sell: 89000, stock: 18, min: 6, unit: 'karung' },
      { id: 'prd_06', cat: 'cat_minyak_bumbu', sku: 'MYK-BIM-02', bar: '8992775120025', name: 'Minyak Goreng Bimoli Pouch 2L', buy: 34000, sell: 38500, stock: 40, min: 10, unit: 'pouch' },
      { id: 'prd_07', cat: 'cat_minyak_bumbu', sku: 'MYK-SUN-02', bar: '8992775120032', name: 'Minyak Goreng SunCo Pouch 2L', buy: 33500, sell: 38000, stock: 30, min: 10, unit: 'pouch' },
      { id: 'prd_08', cat: 'cat_pokok', sku: 'GUL-GKU-01', bar: '8992388100101', name: 'Gula Pasir Gulaku Kuning 1kg', buy: 15500, sell: 18000, stock: 45, min: 15, unit: 'kg' },
      { id: 'prd_09', cat: 'cat_pokok', sku: 'TLR-AYM-01', bar: '8999900100018', name: 'Telur Ayam Negeri Fresh 1kg', buy: 26000, sell: 30000, stock: 35, min: 10, unit: 'kg' },
      { id: 'prd_10', cat: 'cat_pokok', sku: 'TRG-SGT-01', bar: '8992741980010', name: 'Tepung Terigu Segitiga Biru 1kg', buy: 11000, sell: 13500, stock: 40, min: 12, unit: 'kg' },
      { id: 'prd_11', cat: 'cat_minuman', sku: 'KPI-KPL-10', bar: '8991002102004', name: 'Kopi Kapal Api Spesial Mix 10x24g', buy: 12000, sell: 15000, stock: 60, min: 15, unit: 'renceng' },
      { id: 'prd_12', cat: 'cat_minuman', sku: 'TEH-SSR-30', bar: '8992753010118', name: 'Teh Celup Sosro Box 30s', buy: 6500, sell: 8500, stock: 50, min: 15, unit: 'kotak' },
      { id: 'prd_13', cat: 'cat_minuman', sku: 'SUS-FF-370', bar: '8992745300012', name: 'Susu Kental Manis Frisian Flag 370g', buy: 11500, sell: 14000, stock: 32, min: 10, unit: 'kaleng' },
      { id: 'prd_14', cat: 'cat_minyak_bumbu', sku: 'KCP-BNG-520', bar: '8999999015024', name: 'Kecap Manis Bango Refill 520ml', buy: 22000, sell: 26000, stock: 25, min: 8, unit: 'pouch' },
      { id: 'prd_15', cat: 'cat_minyak_bumbu', sku: 'SAS-ABC-335', bar: '8992696100115', name: 'Saus Sambal ABC Asli Botol 335ml', buy: 14000, sell: 17500, stock: 28, min: 8, unit: 'botol' },
      { id: 'prd_16', cat: 'cat_rumah', sku: 'SBN-LFB-04', bar: '8999999034117', name: 'Sabun Mandi Lifebuoy Total 10 4x110g', buy: 15000, sell: 18500, stock: 25, min: 8, unit: 'pack' },
      { id: 'prd_17', cat: 'cat_rumah', sku: 'DTR-DIA-850', bar: '8992741987654', name: 'Deterjen Daia Bunga 850g', buy: 16500, sell: 19500, stock: 22, min: 8, unit: 'bungkus' },
      { id: 'prd_18', cat: 'cat_rumah', sku: 'SUN-LGT-700', bar: '8999999023456', name: 'Sunlight Jeruk Nipis Refill 700ml', buy: 13500, sell: 16000, stock: 35, min: 10, unit: 'pouch' },
      { id: 'prd_19', cat: 'cat_minuman', sku: 'AQU-BTL-600', bar: '8992753210013', name: 'Aqua Air Mineral Botol 600ml', buy: 3000, sell: 4500, stock: 85, min: 24, unit: 'botol' },
      { id: 'prd_20', cat: 'cat_minuman', sku: 'TEH-KOT-250', bar: '8992753020025', name: 'Teh Botol Sosro Kotak 250ml', buy: 3200, sell: 4500, stock: 70, min: 20, unit: 'kotak' },
      { id: 'prd_21', cat: 'cat_snack', sku: 'BSK-ROM-300', bar: '8992775210016', name: 'Biskuit Roma Kelapa 300g', buy: 10000, sell: 12500, stock: 28, min: 8, unit: 'bungkus' },
      { id: 'prd_22', cat: 'cat_snack', sku: 'SNK-CHT-068', bar: '8999999551234', name: 'Chitato Sapi Panggang 68g', buy: 9500, sell: 12000, stock: 3, min: 10, unit: 'bungkus' }, // LOW STOCK
      { id: 'prd_23', cat: 'cat_minyak_bumbu', sku: 'BMU-RYC-100', bar: '8999999045123', name: 'Royco Rasa Ayam Sachet 100g', buy: 4500, sell: 6000, stock: 2, min: 15, unit: 'bungkus' }, // LOW STOCK
      { id: 'prd_24', cat: 'cat_minyak_bumbu', sku: 'GRM-KPL-250', bar: '8991234567890', name: 'Garam Beryodium Cap Kapal 250g', buy: 2500, sell: 3500, stock: 0, min: 10, unit: 'bungkus' }, // OUT OF STOCK
      { id: 'prd_25', cat: 'cat_rumah', sku: 'PST-PEP-190', bar: '8999999012345', name: 'Pasta Gigi Pepsodent White 190g', buy: 13000, sell: 16500, stock: 24, min: 8, unit: 'kotak' },
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (id, business_id, category_id, sku, barcode, name, unit, purchase_price, selling_price, current_stock, min_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (id, business_id, product_id, movement_type, quantity, balance_after, reference_type, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of products) {
      insertProd.run(p.id, businessId, p.cat, p.sku, p.bar, p.name, p.unit, p.buy, p.sell, p.stock, p.min);
      insertMovement.run(
        `mov_init_${p.id}`,
        businessId,
        p.id,
        'adjustment',
        p.stock,
        p.stock,
        'initial_stock',
        'Stok awal pembukaan sistem CrediPOS',
        'usr_owner_01'
      );
    }

    // 6. Customers (12 realistic neighborhood customers with various credit states)
    const customers = [
      { id: 'cust_01', name: 'Pak Budi Santoso', phone: '081234567801', addr: 'Jl. Melati No. 5 RT 02/04', limit: 1500000, balance: 145000, notes: 'Langganan tetap, bayar tiap tanggal 15' },
      { id: 'cust_02', name: 'Ibu Siti Aisyah (Warung Bu Siti)', phone: '081398765402', addr: 'Jl. Mawar No. 12 RT 01/03', limit: 3500000, balance: 680000, notes: 'Warung makan pecel lele, belanja mingguan' },
      { id: 'cust_03', name: 'Pak Joko Susilo', phone: '081122334403', addr: 'Jl. Anggrek No. 8 RT 05/02', limit: 1000000, balance: 350000, notes: 'Guru honorer SMPN 2' },
      { id: 'cust_04', name: 'Ibu Sri Wahyuni', phone: '085678901204', addr: 'Jl. Dahlia No. 3 RT 03/01', limit: 750000, balance: 0, notes: 'Selalu bayar tepat waktu' },
      { id: 'cust_05', name: 'Pak Agus Pratama', phone: '087788990005', addr: 'Jl. Kenanga No. 14 RT 04/05', limit: 1200000, balance: 420000, notes: 'Driver ojek online' },
      { id: 'cust_06', name: 'Ibu Ratna Dewi', phone: '081299887706', addr: 'Jl. Cempaka No. 2 RT 02/02', limit: 500000, balance: 0, notes: 'Ibu RT' },
      { id: 'cust_07', name: 'Pak Tri Nugroho', phone: '081355443307', addr: 'Jl. Flamboyan No. 9 RT 06/03', limit: 2000000, balance: 850000, notes: 'Usaha bengkel motor, suka telat bayar' },
      { id: 'cust_08', name: 'Ibu Nurjanah (Catering Nur)', phone: '085211223308', addr: 'Jl. Kamboja No. 21 RT 01/01', limit: 4500000, balance: 1200000, notes: 'Usaha katering harian, plafon kredit besar' },
      { id: 'cust_09', name: 'Pak Dedi Kusuma', phone: '087812345609', addr: 'Jl. Teratai No. 7 RT 03/04', limit: 800000, balance: 310000, notes: 'Karyawan swasta' },
      { id: 'cust_10', name: 'Ibu Rina Marlina', phone: '081566778810', addr: 'Jl. Bougenville No. 11 RT 02/05', limit: 600000, balance: 0, notes: 'Ibu rumah tangga' },
      { id: 'cust_11', name: 'Pak Rudi Hartono (Bengkel)', phone: '081822334411', addr: 'Jl. Raya Kemang No. 45', limit: 2500000, balance: 520000, notes: 'Pelanggan lama sejak 2021' },
      { id: 'cust_12', name: 'Ibu Maya Safitri', phone: '081900112212', addr: 'Jl. Melati II No. 15 RT 04/04', limit: 1000000, balance: 175000, notes: 'Pegawai puskesmas' },
    ];

    const insertCust = db.prepare(`
      INSERT INTO customers (id, business_id, name, phone, address, credit_limit, current_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of customers) {
      insertCust.run(c.id, businessId, c.name, c.phone, c.addr, c.limit, c.balance, c.notes);
    }

    // 7. Suppliers
    const suppliers = [
      { id: 'sup_01', name: 'PT Indomarco Adi Prima', contact: 'Budi Hartawan', phone: '021-78901234', email: 'sales@indomarco.co.id', addr: 'Kawasan Industri Pulogadung, Jakarta Timur' },
      { id: 'sup_02', name: 'CV Sumber Makmur Sembako', contact: 'Haji Mansyur', phone: '0812-7788-9900', email: 'mansyur@sumbermakmur.com', addr: 'Pasar Induk Kramat Jati Blok C No. 12' },
      { id: 'sup_03', name: 'PT Wings Surya Distribusi', contact: 'Andreas Chen', phone: '021-55667788', email: 'order@wingsdist.co.id', addr: 'Jl. Daan Mogot Km. 11, Jakarta Barat' },
    ];

    const insertSup = db.prepare(`
      INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of suppliers) {
      insertSup.run(s.id, businessId, s.name, s.contact, s.phone, s.email, s.addr);
    }

    // 8. Purchases from suppliers
    const purchases = [
      {
        id: 'po_01',
        inv: 'INV-IND-202610-098',
        sup: 'sup_01',
        date: '2026-10-25 10:30:00',
        total: 1450000,
        items: [
          { prd: 'prd_01', qty: 200, cost: 2800, sub: 560000 },
          { prd: 'prd_02', qty: 150, cost: 2800, sub: 420000 },
          { prd: 'prd_11', qty: 30, cost: 12000, sub: 360000 },
          { prd: 'prd_12', qty: 15, cost: 6500, sub: 97500 },
        ],
      },
      {
        id: 'po_02',
        inv: 'INV-SMS-202610-332',
        sup: 'sup_02',
        date: '2026-10-28 14:00:00',
        total: 2850000,
        items: [
          { prd: 'prd_04', qty: 20, cost: 65000, sub: 1300000 },
          { prd: 'prd_06', qty: 30, cost: 34000, sub: 1020000 },
          { prd: 'prd_09', qty: 20, cost: 26000, sub: 520000 },
        ],
      },
    ];

    const insertPO = db.prepare(`
      INSERT INTO purchases (id, business_id, store_id, supplier_id, invoice_number, purchase_date, total_amount, payment_status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'Pembelian rutin supplier', 'usr_inventory_01')
    `);
    const insertPOItem = db.prepare(`
      INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const po of purchases) {
      insertPO.run(po.id, businessId, storeId, po.sup, po.inv, po.date, po.total);
      for (let i = 0; i < po.items.length; i++) {
        const it = po.items[i];
        insertPOItem.run(`poi_${po.id}_${i}`, po.id, it.prd, it.qty, it.cost, it.sub);
      }
    }

    // 9. Historical Sales, Credit Accounts, and Payments
    // We create realistic past transactions demonstrating:
    // - Paid Cash transactions
    // - Paid QRIS transactions
    // - Credit transactions with aging buckets:
    //   * not yet due
    //   * 1-7 days overdue
    //   * 8-30 days overdue
    //   * 31-60 days overdue
    //   * >60 days overdue
    //   * partial repayments recorded with receipts

    const insertSale = db.prepare(`
      INSERT INTO sales (
        id, business_id, store_id, transaction_number, cashier_id, customer_id,
        sale_date, subtotal, discount_amount, tax_amount, grand_total, amount_paid,
        change_amount, payment_type, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        id, sale_id, product_id, product_name, sku, unit_price, cost_price, quantity, discount_amount, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayment = db.prepare(`
      INSERT INTO payments (id, sale_id, payment_method, amount, reference_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertCreditAcc = db.prepare(`
      INSERT INTO credit_accounts (
        id, business_id, customer_id, sale_id, original_amount, amount_paid, remaining_balance, due_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCreditPay = db.prepare(`
      INSERT INTO credit_payments (
        id, credit_account_id, payment_reference, payment_date, amount, payment_method, notes, received_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Helper date calculator relative to 2026-11-01
    const baseDate = new Date('2026-11-01T10:00:00Z');
    const getDateStr = (daysAgo: number) => {
      const d = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      return d.toISOString().replace('T', ' ').substring(0, 19);
    };
    const getDueDateStr = (daysAhead: number) => {
      const d = new Date(baseDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      return d.toISOString().substring(0, 10);
    };

    // Sale 1: Cash sale today (fully paid)
    insertSale.run(
      'sale_01', businessId, storeId, 'TRX-20261101-0001', 'usr_cashier_01', 'cust_04',
      getDateStr(0), 113500, 0, 0, 113500, 120000, 6500, 'cash', 'paid', 'Pelanggan umum', getDateStr(0)
    );
    insertSaleItem.run('si_01_1', 'sale_01', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 1, 0, 75000);
    insertSaleItem.run('si_01_2', 'sale_01', 'prd_06', 'Minyak Goreng Bimoli Pouch 2L', 'MYK-BIM-02', 38500, 34000, 1, 0, 38500);
    insertPayment.run('pay_01', 'sale_01', 'cash', 120000, 'CASH-0001', getDateStr(0));

    // Sale 2: QRIS sale today
    insertSale.run(
      'sale_02', businessId, storeId, 'TRX-20261101-0002', 'usr_cashier_02', 'cust_06',
      getDateStr(0), 57000, 2000, 0, 55000, 55000, 0, 'qris', 'paid', 'Bayar via QRIS BCA', getDateStr(0)
    );
    insertSaleItem.run('si_02_1', 'sale_02', 'prd_08', 'Gula Pasir Gulaku Kuning 1kg', 'GUL-GKU-01', 18000, 15500, 2, 0, 36000);
    insertSaleItem.run('si_02_2', 'sale_02', 'prd_17', 'Deterjen Daia Bunga 850g', 'DTR-DIA-850', 19500, 16500, 1, 0, 19500);
    insertPayment.run('pay_02', 'sale_02', 'qris', 55000, 'QRIS-ID-884920', getDateStr(0));

    // Sale 3: Credit sale - Customer Pak Budi (Not yet due, due in 7 days: 2026-11-08)
    insertSale.run(
      'sale_03', businessId, storeId, 'TRX-20261025-0014', 'usr_cashier_01', 'cust_01',
      getDateStr(7), 145000, 0, 0, 145000, 0, 0, 'credit', 'unpaid', 'Hutang sembako mingguan', getDateStr(7)
    );
    insertSaleItem.run('si_03_1', 'sale_03', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 1, 0, 75000);
    insertSaleItem.run('si_03_2', 'sale_03', 'prd_01', 'Indomie Goreng Spesial 85g', 'IND-GOR-01', 3500, 2800, 20, 0, 70000);
    insertCreditAcc.run(
      'cacc_01', businessId, 'cust_01', 'sale_03', 145000, 0, 145000,
      getDueDateStr(7), 'unpaid', getDateStr(7), getDateStr(7)
    );

    // Sale 4: Credit sale - Ibu Siti Aisyah (Warung), Due 4 days ago (1-7 days overdue: due 2026-10-28)
    // Original debt 980.000, paid 300.000, remaining 680.000 (status: partially_paid / overdue)
    insertSale.run(
      'sale_04', businessId, storeId, 'TRX-20261014-0021', 'usr_cashier_02', 'cust_02',
      getDateStr(18), 980000, 0, 0, 980000, 0, 0, 'credit', 'partially_paid', 'Kebutuhan warung pecel lele', getDateStr(18)
    );
    insertSaleItem.run('si_04_1', 'sale_04', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 4, 0, 300000);
    insertSaleItem.run('si_04_2', 'sale_04', 'prd_06', 'Minyak Goreng Bimoli Pouch 2L', 'MYK-BIM-02', 38500, 34000, 10, 0, 385000);
    insertSaleItem.run('si_04_3', 'sale_04', 'prd_09', 'Telur Ayam Negeri Fresh 1kg', 'TLR-AYM-01', 30000, 26000, 9, 0, 270000);
    insertSaleItem.run('si_04_4', 'sale_04', 'prd_10', 'Tepung Terigu Segitiga Biru 1kg', 'TRG-SGT-01', 13500, 11000, 2, 2000, 25000);

    insertCreditAcc.run(
      'cacc_02', businessId, 'cust_02', 'sale_04', 980000, 300000, 680000,
      '2026-10-28', 'overdue', getDateStr(18), getDateStr(5)
    );
    // Repayment 1 on this account
    insertCreditPay.run(
      'cpay_01', 'cacc_02', 'PAY-20261027-0001', getDateStr(5), 300000, 'cash', 'Cicilan pertama warung', 'usr_cashier_01', getDateStr(5)
    );

    // Sale 5: Credit sale - Pak Joko Susilo (Due 14 days ago: 8-30 days overdue, due 2026-10-18)
    insertSale.run(
      'sale_05', businessId, storeId, 'TRX-20261004-0008', 'usr_cashier_01', 'cust_03',
      getDateStr(28), 350000, 0, 0, 350000, 0, 0, 'credit', 'unpaid', 'Kebutuhan keluarga bulanan', getDateStr(28)
    );
    insertSaleItem.run('si_05_1', 'sale_05', 'prd_05', 'Beras Pandan Wangi Super 5kg', 'BRS-PDN-05', 89000, 78000, 2, 0, 178000);
    insertSaleItem.run('si_05_2', 'sale_05', 'prd_08', 'Gula Pasir Gulaku Kuning 1kg', 'GUL-GKU-01', 18000, 15500, 3, 0, 54000);
    insertSaleItem.run('si_05_3', 'sale_05', 'prd_11', 'Kopi Kapal Api Spesial Mix 10x24g', 'KPI-KPL-10', 15000, 12000, 4, 0, 60000);
    insertSaleItem.run('si_05_4', 'sale_05', 'prd_13', 'Susu Kental Manis Frisian Flag 370g', 'SUS-FF-370', 14000, 11500, 4, 0, 56000);

    insertCreditAcc.run(
      'cacc_03', businessId, 'cust_03', 'sale_05', 350000, 0, 350000,
      '2026-10-18', 'overdue', getDateStr(28), getDateStr(28)
    );

    // Sale 6: Credit sale - Pak Agus Pratama (Due 40 days ago: 31-60 days overdue, due 2026-09-22)
    insertSale.run(
      'sale_06', businessId, storeId, 'TRX-20260908-0011', 'usr_cashier_02', 'cust_05',
      getDateStr(54), 420000, 0, 0, 420000, 0, 0, 'credit', 'unpaid', 'Sembako kontrakan', getDateStr(54)
    );
    insertSaleItem.run('si_06_1', 'sale_06', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 2, 0, 150000);
    insertSaleItem.run('si_06_2', 'sale_06', 'prd_06', 'Minyak Goreng Bimoli Pouch 2L', 'MYK-BIM-02', 38500, 34000, 4, 0, 154000);
    insertSaleItem.run('si_06_3', 'sale_06', 'prd_01', 'Indomie Goreng Spesial 85g', 'IND-GOR-01', 3500, 2800, 30, 0, 105000);
    insertSaleItem.run('si_06_4', 'sale_06', 'prd_18', 'Sunlight Jeruk Nipis Refill 700ml', 'SUN-LGT-700', 16000, 13500, 1, 5000, 11000);

    insertCreditAcc.run(
      'cacc_04', businessId, 'cust_05', 'sale_06', 420000, 0, 420000,
      '2026-09-22', 'overdue', getDateStr(54), getDateStr(54)
    );

    // Sale 7: Credit sale - Pak Tri Nugroho (>60 days overdue: due 2026-08-20)
    insertSale.run(
      'sale_07', businessId, storeId, 'TRX-20260806-0005', 'usr_cashier_01', 'cust_07',
      getDateStr(87), 850000, 0, 0, 850000, 0, 0, 'credit', 'unpaid', 'Bon bengkel motor', getDateStr(87)
    );
    insertSaleItem.run('si_07_1', 'sale_07', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 4, 0, 300000);
    insertSaleItem.run('si_07_2', 'sale_07', 'prd_09', 'Telur Ayam Negeri Fresh 1kg', 'TLR-AYM-01', 30000, 26000, 10, 0, 300000);
    insertSaleItem.run('si_07_3', 'sale_07', 'prd_11', 'Kopi Kapal Api Spesial Mix 10x24g', 'KPI-KPL-10', 15000, 12000, 10, 0, 150000);
    insertSaleItem.run('si_07_4', 'sale_07', 'prd_08', 'Gula Pasir Gulaku Kuning 1kg', 'GUL-GKU-01', 18000, 15500, 5, 0, 90000);
    insertSaleItem.run('si_07_5', 'sale_07', 'prd_12', 'Teh Celup Sosro Box 30s', 'TEH-SSR-30', 8500, 6500, 2, 7000, 10000);

    insertCreditAcc.run(
      'cacc_05', businessId, 'cust_07', 'sale_07', 850000, 0, 850000,
      '2026-08-20', 'overdue', getDateStr(87), getDateStr(87)
    );

    // Sale 8: Credit sale - Ibu Nurjanah Catering (Original 1.8M, Paid 600k, remaining 1.2M, due in 5 days)
    insertSale.run(
      'sale_08', businessId, storeId, 'TRX-20261020-0033', 'usr_cashier_02', 'cust_08',
      getDateStr(12), 1800000, 0, 0, 1800000, 0, 0, 'credit', 'partially_paid', 'Belanja bahan katering', getDateStr(12)
    );
    insertSaleItem.run('si_08_1', 'sale_08', 'prd_04', 'Beras Setra Ramos 5kg', 'BRS-RAM-05', 75000, 65000, 10, 0, 750000);
    insertSaleItem.run('si_08_2', 'sale_08', 'prd_06', 'Minyak Goreng Bimoli Pouch 2L', 'MYK-BIM-02', 38500, 34000, 15, 0, 577500);
    insertSaleItem.run('si_08_3', 'sale_08', 'prd_09', 'Telur Ayam Negeri Fresh 1kg', 'TLR-AYM-01', 30000, 26000, 15, 0, 450000);
    insertSaleItem.run('si_08_4', 'sale_08', 'prd_14', 'Kecap Manis Bango Refill 520ml', 'KCP-BNG-520', 26000, 22000, 1, 3500, 22500);

    insertCreditAcc.run(
      'cacc_06', businessId, 'cust_08', 'sale_08', 1800000, 600000, 1200000,
      getDueDateStr(5), 'partially_paid', getDateStr(12), getDateStr(4)
    );
    insertCreditPay.run(
      'cpay_02', 'cacc_06', 'PAY-20261028-0002', getDateStr(4), 600000, 'bank_transfer', 'Transfer BCA cicilan 1', 'usr_cashier_02', getDateStr(4)
    );

    // Initial audit log
    db.prepare(`
      INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'log_01', businessId, 'usr_owner_01', 'system_init', 'business', businessId,
      'CrediPOS initialized with demo retail catalog, 12 customers, and initial credit records.'
    );
  });
}
