import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  PackageCheck,
  X,
  Trash2,
} from 'lucide-react';
import { Supplier, Purchase, Product } from '../types/index.ts';
import { formatRupiah } from '../lib/financial.ts';
import { useAuth } from '../context/AuthContext.tsx';

export const Purchasing: React.FC = () => {
  const { canManageInventory } = useAuth();
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showPOModal, setShowPOModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  // Purchase Order / Goods Receiving Form
  const [poForm, setPoForm] = useState<{
    supplier_id: string;
    invoice_number: string;
    notes: string;
    items: { product_id: string; quantity: number; unit_cost: number }[];
  }>({
    supplier_id: '',
    invoice_number: '',
    notes: '',
    items: [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purRes, supRes, prodRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/suppliers'),
        fetch('/api/products'),
      ]);
      const purData = await purRes.json();
      const supData = await supRes.json();
      const prodData = await prodRes.json();

      if (purData.success) setPurchases(purData.purchases);
      if (supData.success) setSuppliers(supData.suppliers);
      if (prodData.success) setProducts(prodData.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewPO = () => {
    setPoForm({
      supplier_id: suppliers[0]?.id || '',
      invoice_number: `INV-SUP-${Date.now().toString().slice(-6)}`,
      notes: '',
      items: [
        {
          product_id: products[0]?.id || '',
          quantity: 10,
          unit_cost: products[0]?.purchase_price || 0,
        },
      ],
    });
    setShowPOModal(true);
  };

  const addPOItem = () => {
    setPoForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: products[0]?.id || '',
          quantity: 10,
          unit_cost: products[0]?.purchase_price || 0,
        },
      ],
    }));
  };

  const removePOItem = (idx: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const updatePOItem = (idx: number, field: string, val: any) => {
    setPoForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[idx], [field]: val };
      if (field === 'product_id') {
        const prod = products.find((p) => p.id === val);
        if (prod) item.unit_cost = prod.purchase_price;
      }
      items[idx] = item;
      return { ...prev, items };
    });
  };

  // Submit PO
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poForm.items.length === 0) {
      alert('Tambahkan setidaknya 1 produk barang yang diterima.');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowPOModal(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Supplier
  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowSupplierModal(false);
        setSupplierForm({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          address: '',
          notes: '',
        });
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
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Supplier & Pembelian Barang Masuk</h2>
          <p className="text-xs text-gray-500">
            Pencatatan faktur supplier dan pembaruan stok gudang otomatis saat barang diterima
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'purchases' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Faktur Pembelian ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'suppliers' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Daftar Supplier ({suppliers.length})
            </button>
          </div>

          {canManageInventory && (
            <button
              onClick={activeTab === 'purchases' ? openNewPO : () => setShowSupplierModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeTab === 'purchases' ? '+ Catat Terima Barang Masuk' : '+ Tambah Supplier'}
              </span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'purchases' ? (
        /* PURCHASES TABLE */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">No. Faktur / Invoice</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Tanggal Pembelian</th>
                  <th className="py-3 px-4">Item Diterima</th>
                  <th className="py-3 px-4 text-right">Total Pembelian</th>
                  <th className="py-3 px-4">Petugas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Memuat pembelian...
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      Belum ada transaksi pembelian supplier.
                    </td>
                  </tr>
                ) : (
                  purchases.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {po.invoice_number}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        {po.supplier_name}
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        {po.purchase_date}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px] text-gray-600">
                          {po.items?.map((it, idx) => (
                            <div key={idx}>
                              • {it.product_name} ({it.quantity} unit @ {formatRupiah(it.unit_cost)})
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-sm tabular-nums text-[#111827]">
                        {formatRupiah(po.total_amount)}
                      </td>

                      <td className="py-3.5 px-4 text-gray-500">
                        {po.created_by_name}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Selesai & Masuk Stok
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SUPPLIERS TABLE */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Nama Supplier</th>
                  <th className="py-3 px-4">Kontak Person</th>
                  <th className="py-3 px-4">No. Telepon & Email</th>
                  <th className="py-3 px-4">Alamat Gudang / Kantor</th>
                  <th className="py-3 px-4 text-center">Total Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{s.name}</td>
                    <td className="py-3.5 px-4 text-gray-700">{s.contact_person || '-'}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <div>{s.phone}</div>
                      {s.email && <div className="text-[11px] text-gray-400">{s.email}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{s.address || '-'}</td>
                    <td className="py-3.5 px-4 text-center font-bold">{s.total_purchases || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW PO / GOODS RECEIVING MODAL */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#4F46E5]" />
                <h3 className="font-bold text-base text-gray-900">
                  Penerimaan Barang Dari Supplier
                </h3>
              </div>
              <button onClick={() => setShowPOModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Pilih Supplier *</label>
                  <select
                    required
                    value={poForm.supplier_id}
                    onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                    className="w-full p-2.5 border rounded-xl"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    No. Faktur / Surat Jalan *
                  </label>
                  <input
                    type="text"
                    required
                    value={poForm.invoice_number}
                    onChange={(e) => setPoForm({ ...poForm, invoice_number: e.target.value })}
                    className="w-full p-2.5 border rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Daftar Barang Masuk</span>
                  <button
                    type="button"
                    onClick={addPOItem}
                    className="text-xs text-[#4F46E5] font-bold hover:underline"
                  >
                    + Tambah Baris Produk
                  </button>
                </div>

                <div className="space-y-2">
                  {poForm.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 border rounded-xl flex items-center gap-2"
                    >
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Produk</label>
                        <select
                          value={it.product_id}
                          onChange={(e) => updatePOItem(idx, 'product_id', e.target.value)}
                          className="w-full p-2 bg-white border rounded-lg text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stok skrg: {p.current_stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Qty Masuk</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={it.quantity}
                          onChange={(e) =>
                            updatePOItem(idx, 'quantity', Math.max(1, Number(e.target.value)))
                          }
                          className="w-full p-2 bg-white border rounded-lg text-xs tabular-nums font-bold"
                        />
                      </div>

                      <div className="w-32">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Harga Beli</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={it.unit_cost}
                          onChange={(e) =>
                            updatePOItem(idx, 'unit_cost', Math.max(0, Number(e.target.value)))
                          }
                          className="w-full p-2 bg-white border rounded-lg text-xs tabular-nums"
                        />
                      </div>

                      <div className="w-32 text-right">
                        <label className="text-[10px] text-gray-500 block mb-0.5">Subtotal</label>
                        <div className="font-bold text-xs pt-2 tabular-nums">
                          {formatRupiah(it.quantity * it.unit_cost)}
                        </div>
                      </div>

                      {poForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePOItem(idx)}
                          className="p-2 text-gray-400 hover:text-red-600 pt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-right p-2 font-bold text-sm text-[#4F46E5]">
                  Total Faktur:{' '}
                  {formatRupiah(
                    poForm.items.reduce((acc, it) => acc + it.quantity * it.unit_cost, 0)
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Catatan</label>
                <input
                  type="text"
                  placeholder="Catatan surat jalan atau kondisi kemasan"
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold hover:bg-[#4338CA] shadow-md"
                >
                  Terima Barang & Tambah Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">Tambah Data Supplier Baru</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Nama Supplier / PT *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Indomarco Adi Prima"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Nama Kontak Person</label>
                <input
                  type="text"
                  placeholder="Nama Sales / PIC"
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">No. Telepon / WA *</label>
                <input
                  type="tel"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Alamat Gudang / Kantor</label>
                <textarea
                  rows={2}
                  placeholder="Alamat kantor / gudang supplier"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold hover:bg-[#4338CA] shadow-md"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
