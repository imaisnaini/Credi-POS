import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  MapPin,
  CreditCard,
  Receipt,
  Eye,
  Edit2,
  X,
  CheckCircle,
  AlertCircle,
  History,
} from 'lucide-react';
import { Customer } from '../types/index.ts';
import { formatRupiah } from '../lib/financial.ts';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustDetail, setSelectedCustDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 1000000,
    notes: '',
    status: 'active' as 'active' | 'suspended',
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.address && c.address.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  // View Customer Profile Drawer
  const viewCustomerProfile = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/customers/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedCustDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      credit_limit: 1000000,
      notes: '',
      status: 'active',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.name,
      phone: cust.phone,
      email: cust.email || '',
      address: cust.address || '',
      credit_limit: cust.credit_limit,
      notes: cust.notes || '',
      status: cust.status,
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        fetchCustomers();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Database Pelanggan & Plafon Kredit</h2>
          <p className="text-xs text-gray-500">
            Total {customers.length} pelanggan terdaftar dengan limit kredit dan riwayat transaksi
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Tambah Pelanggan Baru</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama pelanggan, nomor telepon, atau alamat domisili..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#4F46E5] focus:bg-white"
          />
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Kontak & Alamat</th>
                <th className="py-3 px-4 text-right">Plafon Kredit</th>
                <th className="py-3 px-4 text-right">Hutang Berjalan</th>
                <th className="py-3 px-4 text-right">Sisa Limit Kredit</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Memuat data pelanggan...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Tidak ada pelanggan yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const availableLimit = Math.max(0, cust.credit_limit - cust.current_balance);
                  const isExceeded = cust.current_balance > cust.credit_limit;

                  return (
                    <tr key={cust.id} className="hover:bg-gray-50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{cust.name}</div>
                        <div className="text-[11px] text-gray-500">
                          {cust.total_transactions || 0} transaksi • Belanja {formatRupiah(cust.total_purchases || 0)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="flex items-center gap-1 font-medium text-gray-900">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{cust.phone}</span>
                        </div>
                        {cust.address && (
                          <div className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5">
                            {cust.address}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-gray-800">
                        {formatRupiah(cust.credit_limit)}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-extrabold text-sm text-[#EF4444]">
                        {formatRupiah(cust.current_balance)}
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-emerald-700">
                        {formatRupiah(availableLimit)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            cust.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {cust.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewCustomerProfile(cust.id)}
                            title="Lihat Profil & Riwayat"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#4F46E5] hover:bg-indigo-50 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cust)}
                            title="Edit Data"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
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

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">
                {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Pelanggan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">No. WhatsApp / HP *</label>
                <input
                  type="tel"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Alamat Domisili</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap tempat tinggal"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Plafon Kredit Maksimal (IDR)
                </label>
                <input
                  type="number"
                  step="50000"
                  min="0"
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5] font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Catatan Khusus</label>
                <input
                  type="text"
                  placeholder="Catatan usaha / waktu pembayaran biasa"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              {editingCustomer && (
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Status Akun</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full p-2.5 border rounded-xl"
                  >
                    <option value="active">Aktif (Dapat mengambil kredit)</option>
                    <option value="suspended">Ditangguhkan (Kredit dibekukan)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold shadow-md hover:bg-[#4338CA]"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER DETAIL PROFILE MODAL */}
      {selectedCustDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  {selectedCustDetail.customer.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedCustDetail.customer.phone} • {selectedCustDetail.customer.address || 'Alamat belum diisi'}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustDetail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Credit Financial Summary Cards */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl text-xs border">
              <div>
                <span className="text-gray-500 block">Plafon Kredit</span>
                <span className="font-bold tabular-nums text-gray-800 text-sm">
                  {formatRupiah(selectedCustDetail.customer.credit_limit)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Hutang Berjalan</span>
                <span className="font-bold tabular-nums text-red-600 text-sm">
                  {formatRupiah(selectedCustDetail.customer.current_balance)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Sisa Kredit Tersedia</span>
                <span className="font-bold tabular-nums text-emerald-600 text-sm">
                  {formatRupiah(
                    Math.max(
                      0,
                      selectedCustDetail.customer.credit_limit - selectedCustDetail.customer.current_balance
                    )
                  )}
                </span>
              </div>
            </div>

            {/* History Tabs */}
            <div className="space-y-4">
              {/* Credit Accounts History */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#4F46E5]" />
                  Daftar Tagihan Hutang / Piutang
                </h4>
                {(!selectedCustDetail.credits || selectedCustDetail.credits.length === 0) ? (
                  <p className="text-xs text-gray-400 italic">Tidak ada catatan hutang.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {selectedCustDetail.credits.map((cr: any) => (
                      <div
                        key={cr.id}
                        className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-gray-900">
                            {cr.transaction_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cr.remaining_balance <= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : cr.is_overdue
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {cr.remaining_balance <= 0 ? 'Lunas' : cr.aging_label}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Awal: {formatRupiah(cr.original_amount)}</span>
                          <span>Dibayar: {formatRupiah(cr.amount_paid)}</span>
                          <span className="font-bold text-red-600">
                            Sisa: {formatRupiah(cr.remaining_balance)}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Jatuh tempo: {cr.due_date}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transactions History */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#4F46E5]" />
                  Riwayat Pembelian Terakhir
                </h4>
                {(!selectedCustDetail.sales || selectedCustDetail.sales.length === 0) ? (
                  <p className="text-xs text-gray-400 italic">Belum ada transaksi pembelian.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {selectedCustDetail.sales.map((s: any) => (
                      <div
                        key={s.id}
                        className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-mono font-medium text-gray-900">{s.transaction_number}</p>
                          <p className="text-[11px] text-gray-500">{s.sale_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold tabular-nums text-gray-900">
                            {formatRupiah(s.grand_total)}
                          </p>
                          <span className="text-[10px] text-gray-500 capitalize">
                            {s.payment_type?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCustDetail(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
