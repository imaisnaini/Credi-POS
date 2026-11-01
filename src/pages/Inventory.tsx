import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  History,
  SlidersHorizontal,
  Edit2,
  Trash2,
  X,
  Check,
  ArrowUpDown,
  Barcode,
} from 'lucide-react';
import { Product, ProductCategory, InventoryMovement } from '../types/index.ts';
import { formatRupiah } from '../lib/financial.ts';
import { useAuth } from '../context/AuthContext.tsx';

export const Inventory: React.FC = () => {
  const { canManageInventory } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  // Product Form
  const [productForm, setProductForm] = useState({
    category_id: '',
    sku: '',
    barcode: '',
    name: '',
    description: '',
    unit: 'pcs',
    purchase_price: 0,
    selling_price: 0,
    current_stock: 0,
    min_stock_threshold: 5,
  });

  // Adjust Stock Form
  const [adjustForm, setAdjustForm] = useState({
    adjustment_type: 'adjustment' as 'adjustment' | 'loss' | 'return',
    quantity: 0,
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, movRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/inventory/movements'),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const movData = await movRes.json();

      if (prodData.success) setProducts(prodData.products);
      if (catData.success) setCategories(catData.categories);
      if (movData.success) setMovements(movData.movements);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.includes(term);

      const matchesCat =
        selectedCategory === 'all' || p.category_id === selectedCategory;

      const isOut = p.current_stock <= 0;
      const isLow = p.current_stock <= p.min_stock_threshold && !isOut;
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && isLow) ||
        (stockFilter === 'out' && isOut);

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  // Handle open product add/edit
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProductForm({
      category_id: categories[0]?.id || '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `899${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: '',
      description: '',
      unit: 'pcs',
      purchase_price: 0,
      selling_price: 0,
      current_stock: 10,
      min_stock_threshold: 5,
    });
    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      category_id: p.category_id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      description: p.description || '',
      unit: p.unit,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      current_stock: p.current_stock,
      min_stock_threshold: p.min_stock_threshold,
    });
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowProductModal(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Stock Adjust
  const handleOpenAdjust = (p: Product) => {
    setAdjustingProduct(p);
    setAdjustForm({
      adjustment_type: 'adjustment',
      quantity: p.current_stock,
      notes: '',
    });
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    try {
      const res = await fetch(`/api/products/${adjustingProduct.id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowAdjustModal(false);
        setAdjustingProduct(null);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER & TOP TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Manajemen Inventaris & Stok</h2>
          <p className="text-xs text-gray-500">
            Total {products.length} produk katalog dengan penelusuran pergerakan stok lengkap
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Tab Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'products'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Katalog Produk
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'movements'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Riwayat Pergerakan Stok
            </button>
          </div>

          {canManageInventory && activeTab === 'products' && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Produk</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'products' ? (
        <>
          {/* FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, SKU, atau barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#4F46E5] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
              {/* Category filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Stock status filter */}
              <button
                onClick={() => setStockFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  stockFilter === 'all'
                    ? 'bg-[#4F46E5] text-white font-bold'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Semua Stok
              </button>
              <button
                onClick={() => setStockFilter('low')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  stockFilter === 'low'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                Stok Menipis
              </button>
              <button
                onClick={() => setStockFilter('out')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  stockFilter === 'out'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                Stok Habis
              </button>
            </div>
          </div>

          {/* PRODUCTS TABLE */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Nama Produk & SKU</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Harga Modal</th>
                    <th className="py-3 px-4 text-right">Harga Jual</th>
                    <th className="py-3 px-4 text-right">Stok Fisik</th>
                    <th className="py-3 px-4 text-center">Status Stok</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        Memuat produk...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        Tidak ada produk yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isOut = p.current_stock <= 0;
                      const isLow = p.current_stock <= p.min_stock_threshold && !isOut;

                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{p.name}</div>
                            <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>SKU: {p.sku}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <Barcode className="w-3 h-3 text-gray-400" /> {p.barcode}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                              {p.category_name}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums text-gray-500">
                            {formatRupiah(p.purchase_price)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#4F46E5]">
                            {formatRupiah(p.selling_price)}
                          </td>

                          <td className="py-3.5 px-4 text-right tabular-nums font-extrabold text-sm">
                            {p.current_stock} <span className="text-xs font-normal text-gray-500">{p.unit}</span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isOut
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isOut ? 'Habis (0)' : isLow ? `Menipis (Min ${p.min_stock_threshold})` : 'Aman'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {canManageInventory && (
                                <>
                                  <button
                                    onClick={() => handleOpenAdjust(p)}
                                    title="Sesuaikan Stok Fisik"
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEdit(p)}
                                    title="Edit Produk"
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* INVENTORY MOVEMENTS AUDIT LOG */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-xs text-gray-900">
              Audit Trail Pergerakan Stok (Semua Penjualan, Penerimaan Supplier, & Penyesuaian)
            </h3>
            <span className="text-xs text-gray-500">{movements.length} catatan pergerakan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Tipe Pergerakan</th>
                  <th className="py-3 px-4 text-right">Perubahan Qty</th>
                  <th className="py-3 px-4 text-right">Stok Akhir</th>
                  <th className="py-3 px-4">Catatan / Keterangan</th>
                  <th className="py-3 px-4">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => {
                  const isPositive = m.quantity > 0;

                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {m.created_at}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {m.product_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.movement_type === 'sale'
                              ? 'bg-blue-50 text-blue-700'
                              : m.movement_type === 'purchase'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.movement_type === 'loss'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {m.movement_type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-bold ${
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-gray-800">
                        {m.balance_after}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{m.notes}</td>
                      <td className="py-3 px-4 text-gray-500">{m.created_by_name || 'System'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT ADD / EDIT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru ke Katalog'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Kategori Produk *</label>
                <select
                  required
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Nama Produk *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beras Ramos 5kg"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Kode SKU *</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full p-2.5 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Barcode *</label>
                  <input
                    type="text"
                    required
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full p-2.5 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Harga Beli (Modal) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.purchase_price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, purchase_price: Number(e.target.value) })
                    }
                    className="w-full p-2.5 border rounded-xl font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Harga Jual *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.selling_price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, selling_price: Number(e.target.value) })
                    }
                    className="w-full p-2.5 border rounded-xl font-bold tabular-nums text-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Satuan</label>
                  <input
                    type="text"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                    placeholder="pcs / kg / bungkus"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Stok Awal</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.current_stock}
                      onChange={(e) =>
                        setProductForm({ ...productForm, current_stock: Number(e.target.value) })
                      }
                      className="w-full p-2.5 border rounded-xl font-bold tabular-nums"
                    />
                  </div>
                )}
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Batas Peringatan Stok Minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.min_stock_threshold}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        min_stock_threshold: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 border rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold hover:bg-[#4338CA] shadow-md"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">
                Penyesuaian Stok Fisik Produk
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1 border">
              <p className="font-bold text-gray-900">{adjustingProduct.name}</p>
              <p className="text-gray-500">
                Stok Tercatat di Sistem: <strong>{adjustingProduct.current_stock} {adjustingProduct.unit}</strong>
              </p>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Jenis Penyesuaian
                </label>
                <select
                  value={adjustForm.adjustment_type}
                  onChange={(e) =>
                    setAdjustForm({
                      ...adjustForm,
                      adjustment_type: e.target.value as any,
                    })
                  }
                  className="w-full p-2.5 border rounded-xl"
                >
                  <option value="adjustment">Stock Opname / Reset Hitung Fisik Nyata</option>
                  <option value="loss">Barang Rusak / Hilang / Kadaluarsa (Pengurangan)</option>
                  <option value="return">Pengembalian / Retur (Penambahan)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  {adjustForm.adjustment_type === 'adjustment'
                    ? 'Jumlah Stok Fisik Sebenarnya'
                    : 'Jumlah Unit'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustForm.quantity}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })
                  }
                  className="w-full p-2.5 border rounded-xl font-bold tabular-nums text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Alasan Penyesuaian *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Selisih hitung opname akhir bulan / kemasan bocor"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold hover:bg-[#4338CA] shadow-md"
                >
                  Perbarui Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
