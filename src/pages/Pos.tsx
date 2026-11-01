import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  Clock,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Receipt,
  Check,
  X,
} from 'lucide-react';
import { Product, ProductCategory, Customer } from '../types/index.ts';
import {
  formatRupiah,
  calculateItemSubtotal,
  calculateSaleTotals,
  calculatePaymentBreakdown,
  validateCreditPurchase,
} from '../lib/financial.ts';
import { ReceiptModal } from '../components/common/ReceiptModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export const Pos: React.FC = () => {
  const { business } = useAuth();
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactionDiscount, setTransactionDiscount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<
    'cash' | 'qris' | 'bank_transfer' | 'ewallet' | 'partial' | 'credit'
  >('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().substring(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [mobilePosTab, setMobilePosTab] = useState<'catalog' | 'cart'>('catalog');

  // UI Modals
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: '',
    phone: '',
    address: '',
    credit_limit: 1000000,
    notes: '',
  });
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch initial master data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/customers'),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const custData = await custRes.json();

      if (prodData.success) setProducts(prodData.products);
      if (catData.success) setCategories(catData.categories);
      if (custData.success) setCustomers(custData.customers);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Cart financial calculations
  const cartTotals = useMemo(() => {
    const items = cart.map((item) => ({
      price: item.product.selling_price,
      quantity: item.quantity,
      discount: item.discount,
    }));
    return calculateSaleTotals(items, transactionDiscount, business?.tax_rate || 0);
  }, [cart, transactionDiscount, business]);

  // Amount Paid logic
  const resolvedAmountPaid = useMemo(() => {
    if (paymentType === 'credit') return 0;
    if (paymentType === 'qris' || paymentType === 'bank_transfer' || paymentType === 'ewallet') {
      return cartTotals.grandTotal;
    }
    if (!amountPaidInput && paymentType === 'cash') {
      return cartTotals.grandTotal;
    }
    const parsed = parseFloat(amountPaidInput);
    return isNaN(parsed) ? 0 : parsed;
  }, [paymentType, amountPaidInput, cartTotals.grandTotal]);

  const paymentBreakdown = useMemo(() => {
    return calculatePaymentBreakdown(cartTotals.grandTotal, resolvedAmountPaid);
  }, [cartTotals.grandTotal, resolvedAmountPaid]);

  // Credit limit validation
  const creditValidation = useMemo(() => {
    if (paymentBreakdown.remainingBalance <= 0) return { allowed: true };
    if (!selectedCustomer) {
      return {
        allowed: false,
        error: 'Pilih data pelanggan terdaftar untuk pembelian hutang/kredit.',
      };
    }
    return validateCreditPurchase(
      selectedCustomer.current_balance,
      selectedCustomer.credit_limit,
      paymentBreakdown.remainingBalance
    );
  }, [paymentBreakdown.remainingBalance, selectedCustomer]);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      alert(`Stok produk "${product.name}" habis.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          alert(`Maksimal stok tersedia hanya ${product.current_stock} ${product.unit}.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.current_stock) {
              alert(`Stok tidak mencukupi. Tersedia: ${item.product.current_stock}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discount: Math.max(0, discount) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setTransactionDiscount(0);
    setAmountPaidInput('');
    setPaymentType('cash');
    setNotes('');
    setErrorMessage(null);
  };

  // Quick cash buttons
  const setQuickCash = (amount: number) => {
    setAmountPaidInput(amount.toString());
  };

  // Handle Quick Customer Registration
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustForm),
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) => [...prev, data.customer]);
        setSelectedCustomer(data.customer);
        setShowNewCustModal(false);
        setNewCustForm({ name: '', phone: '', address: '', credit_limit: 1000000, notes: '' });
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Checkout Submission
  const handleCheckout = async () => {
    setErrorMessage(null);

    if (!isOnline) {
      setErrorMessage(
        'Koneksi internet terputus. Demi integritas pembukuan finansial, transaksi kasir baru dinonaktifkan saat offline.'
      );
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('Keranjang masih kosong.');
      return;
    }

    if (paymentBreakdown.remainingBalance > 0 && !selectedCustomer) {
      setErrorMessage('Transaksi kredit / bayar sebagian wajib memilih pelanggan terdaftar.');
      return;
    }

    if (paymentBreakdown.remainingBalance > 0 && !creditValidation.allowed) {
      setErrorMessage(creditValidation.error || 'Plafon kredit pelanggan tidak mencukupi.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        customer_id: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount: item.discount,
        })),
        transaction_discount: transactionDiscount,
        payment_type: paymentType,
        amount_paid: resolvedAmountPaid,
        due_date: paymentBreakdown.remainingBalance > 0 ? dueDate : null,
        notes,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setCompletedSale(data.sale);
        clearCart();
        // Refresh product stock and customer balances
        fetchData();
      } else {
        setErrorMessage(data.error || 'Terjadi kesalahan saat memproses transaksi.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghubungi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#F9FAFB]">
      {/* LEFT SECTION: PRODUCT CATALOG */}
      <div
        className={`flex-1 flex flex-col border-r border-gray-200 overflow-hidden ${
          mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Search & Category Filter Header */}
        <div className="p-4 bg-white border-b border-gray-200 space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari produk nama, SKU, atau scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:bg-white transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-[#4F46E5] text-white shadow-sm font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semua Kategori ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-[#4F46E5] text-white shadow-sm font-semibold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name} ({cat.product_count || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-sm font-medium">Tidak ada produk yang cocok</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                const isLowStock = p.current_stock <= p.min_stock_threshold && !isOutOfStock;

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`text-left p-3.5 bg-white border rounded-xl transition duration-150 flex flex-col justify-between group relative shadow-xs ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                        : 'border-gray-200 hover:border-[#4F46E5] hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div>
                      {/* Stock badge */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-gray-400 truncate max-w-[90px]">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isOutOfStock ? 'Habis' : `Stok: ${p.current_stock} ${p.unit}`}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-[#111827] line-clamp-2 leading-snug group-hover:text-[#4F46E5]">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#4F46E5] tabular-nums">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 text-[#4F46E5] flex items-center justify-center text-xs font-bold group-hover:bg-[#4F46E5] group-hover:text-white transition">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Floating Cart Summary Button */}
        {cart.length > 0 && (
          <div className="lg:hidden p-3 bg-white border-t border-gray-200">
            <button
              onClick={() => setMobilePosTab('cart')}
              className="w-full py-2.5 px-4 bg-[#A3E635] text-[#111827] rounded-xl font-bold text-xs flex items-center justify-between shadow-md"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span>Lihat Keranjang ({cart.reduce((a, b) => a + b.quantity, 0)} Item)</span>
              </span>
              <span className="tabular-nums font-extrabold">{formatRupiah(cartTotals.grandTotal)} &rarr;</span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: CART & CHECKOUT PANEL */}
      <div
        className={`w-full lg:w-[420px] bg-white flex flex-col h-full border-l border-gray-200 shrink-0 ${
          mobilePosTab === 'catalog' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Mobile Back to Catalog Bar */}
        <div className="lg:hidden p-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <button
            onClick={() => setMobilePosTab('catalog')}
            className="text-xs font-bold text-[#4F46E5] flex items-center gap-1.5"
          >
            &larr; Kembali ke Katalog Produk
          </button>
          <span className="text-[11px] text-indigo-900 font-semibold">
            {cart.reduce((a, b) => a + b.quantity, 0)} Item
          </span>
        </div>

        {/* Customer Header */}
        <div className="p-3 border-b border-gray-200 bg-gray-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#4F46E5]" />
              Pelanggan Transaksi
            </span>
            <button
              onClick={() => setShowNewCustModal(true)}
              className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + Pelanggan Baru
            </button>
          </div>

          {/* Customer Selection Select */}
          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const val = e.target.value;
              const found = customers.find((c) => c.id === val) || null;
              setSelectedCustomer(found);
            }}
            className="w-full text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
          >
            <option value="">👤 Pelanggan Umum (Walk-in, Hanya Tunai/Lunas)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) — Hutang: {formatRupiah(c.current_balance)} / Limit: {formatRupiah(c.credit_limit)}
              </option>
            ))}
          </select>

          {/* Selected Customer Credit Info Pill */}
          {selectedCustomer && (
            <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-[11px] flex items-center justify-between">
              <div>
                <span className="font-bold text-indigo-950">{selectedCustomer.name}</span>
                <span className="text-indigo-600 block text-[10px]">
                  Hutang berjalan: {formatRupiah(selectedCustomer.current_balance)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500">Sisa Plafon Kredit:</span>
                <span className="font-bold text-emerald-700 block tabular-nums">
                  {formatRupiah(Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <ShoppingCart className="w-12 h-12 mb-3 stroke-[1.5] text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">Keranjang Masih Kosong</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Pilih produk dari katalog di sebelah kiri untuk memulai penjualan.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const subtotal = calculateItemSubtotal(
                item.product.selling_price,
                item.quantity,
                item.discount
              );

              return (
                <div
                  key={item.product.id}
                  className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {item.product.name}
                      </p>
                      <p className="text-[11px] text-gray-500 tabular-nums">
                        {formatRupiah(item.product.selling_price)} / {item.product.unit}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quantity Stepper & Subtotal */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-gray-900 tabular-nums">
                        {formatRupiah(subtotal)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Financial Totals & Payment Control Panel */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 bg-white p-3.5 space-y-3">
            {/* Totals Summary */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} item):</span>
                <span className="tabular-nums">{formatRupiah(cartTotals.netItemsSubtotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between text-gray-600 gap-2">
                <span>Potongan / Diskon:</span>
                <div className="w-32 flex items-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={transactionDiscount || ''}
                    onChange={(e) => setTransactionDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full text-right py-1 px-2 border border-gray-300 rounded text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-200 text-sm">
                <span className="font-bold text-gray-900">Total Belanja:</span>
                <span className="font-extrabold text-lg text-[#4F46E5] tabular-nums">
                  {formatRupiah(cartTotals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Type Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 block">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('cash');
                    setAmountPaidInput(cartTotals.grandTotal.toString());
                  }}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 font-medium transition ${
                    paymentType === 'cash'
                      ? 'border-[#4F46E5] bg-indigo-50/70 text-[#4F46E5] font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Tunai (Cash)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('qris');
                    setAmountPaidInput(cartTotals.grandTotal.toString());
                  }}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 font-medium transition ${
                    paymentType === 'qris'
                      ? 'border-[#4F46E5] bg-indigo-50/70 text-[#4F46E5] font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QRIS</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('bank_transfer');
                    setAmountPaidInput(cartTotals.grandTotal.toString());
                  }}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 font-medium transition ${
                    paymentType === 'bank_transfer'
                      ? 'border-[#4F46E5] bg-indigo-50/70 text-[#4F46E5] font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('partial');
                    setAmountPaidInput(Math.round(cartTotals.grandTotal / 2).toString());
                  }}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 font-medium transition ${
                    paymentType === 'partial'
                      ? 'border-[#F59E0B] bg-amber-50 text-amber-900 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Bayar Sebagian</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('credit');
                    setAmountPaidInput('0');
                  }}
                  className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 font-medium transition col-span-2 ${
                    paymentType === 'credit'
                      ? 'border-[#EF4444] bg-red-50 text-red-900 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-red-600" />
                  <span>Hutang / Bon (Kredit Penuh)</span>
                </button>
              </div>
            </div>

            {/* Dynamic Cash Input / Partial / Credit Fields */}
            {paymentType === 'cash' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">Nominal Diterima:</span>
                  <input
                    type="number"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className="w-36 text-right py-1 px-2.5 border border-gray-300 rounded-lg text-sm font-bold tabular-nums focus:ring-2 focus:ring-[#4F46E5]"
                  />
                </div>

                {/* Quick cash pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1">
                  <button
                    type="button"
                    onClick={() => setQuickCash(cartTotals.grandTotal)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-800"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 150000, 200000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setQuickCash(amt)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 whitespace-nowrap"
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                </div>

                {/* Change amount */}
                <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-emerald-50 text-emerald-900">
                  <span className="font-medium">Kembalian:</span>
                  <span className="font-extrabold text-sm tabular-nums text-emerald-700">
                    {formatRupiah(paymentBreakdown.changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {(paymentType === 'partial' || paymentType === 'credit') && (
              <div className="space-y-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                {paymentType === 'partial' && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-900">Uang Muka (DP):</span>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      className="w-32 text-right py-1 px-2 bg-white border border-amber-300 rounded text-xs font-bold tabular-nums"
                    />
                  </div>
                )}

                <div className="flex justify-between text-amber-900 font-bold">
                  <span>Sisa Dicatat Hutang:</span>
                  <span className="text-red-700 tabular-nums">
                    {formatRupiah(paymentBreakdown.remainingBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-amber-900 font-medium">Jatuh Tempo:</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="py-1 px-2 bg-white border border-amber-300 rounded text-xs font-semibold"
                  />
                </div>

                {!selectedCustomer && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Wajib pilih akun pelanggan untuk hutang!
                  </p>
                )}
                {selectedCustomer && !creditValidation.allowed && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {creditValidation.error}
                  </p>
                )}
              </div>
            )}

            {/* Offline Notification */}
            {!isOnline && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Mode Offline:</strong> Koneksi server terputus. Checkout kasir dinonaktifkan sementara untuk menjaga validitas saldo dan stok.
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* ACTION CTA BUTTONS */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={clearCart}
                className="px-3 py-3 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-semibold text-xs transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isSubmitting || !isOnline}
                onClick={handleCheckout}
                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition duration-150 ${
                  !isOnline
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
                    : 'bg-[#A3E635] hover:bg-[#84CC16] text-[#111827]'
                } disabled:opacity-50`}
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {!isOnline
                    ? 'Offline — Transaksi Ditangguhkan'
                    : isSubmitting
                    ? 'Memproses...'
                    : 'Proses & Cetak Struk'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QUICK CUSTOMER REGISTRATION MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">Registrasi Pelanggan Baru</h3>
              <button
                onClick={() => setShowNewCustModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ibu Rina Marlina"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">No. WhatsApp / HP *</label>
                <input
                  type="tel"
                  required
                  placeholder="08123456789"
                  value={newCustForm.phone}
                  onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Alamat Domisili</label>
                <input
                  type="text"
                  placeholder="Jl. Melati RT 02/03"
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Plafon Kredit Maksimal (IDR)
                </label>
                <input
                  type="number"
                  step="50000"
                  value={newCustForm.credit_limit}
                  onChange={(e) =>
                    setNewCustForm({ ...newCustForm, credit_limit: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="flex-1 py-2.5 border rounded-lg font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-lg font-bold hover:bg-[#4338CA]"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETED TRANSACTION RECEIPT MODAL */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
};
