import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Eye,
  Printer,
  Calendar,
  X,
  CreditCard,
  Banknote,
  Receipt,
  User,
} from 'lucide-react';
import { Sale } from '../types/index.ts';
import { formatRupiah } from '../lib/financial.ts';
import { ReceiptModal } from '../components/common/ReceiptModal.tsx';

export const Transactions: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');

  // Modals
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any>(null);
  const [receiptSale, setReceiptSale] = useState<any>(null);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales');
      const data = await res.json();
      if (data.success) {
        setSales(data.sales);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        s.transaction_number.toLowerCase().includes(term) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(term)) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'all' || s.payment_status === statusFilter;

      const matchesType =
        paymentTypeFilter === 'all' || s.payment_type === paymentTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [sales, searchTerm, statusFilter, paymentTypeFilter]);

  const viewSaleDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/sales/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSaleDetail(data.sale);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Riwayat Transaksi Penjualan</h2>
        <p className="text-xs text-gray-500">
          Semua catatan penjualan kasir tersimpan permanen demi akuntabilitas keuangan
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari no. faktur, nama kasir, atau pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#4F46E5] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
          {/* Payment Type */}
          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
          >
            <option value="all">Semua Metode</option>
            <option value="cash">Tunai (Cash)</option>
            <option value="qris">QRIS</option>
            <option value="bank_transfer">Transfer Bank</option>
            <option value="credit">Hutang / Bon</option>
            <option value="partial">Bayar Sebagian</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
          >
            <option value="all">Semua Status</option>
            <option value="paid">Lunas</option>
            <option value="partially_paid">Bayar Sebagian</option>
            <option value="unpaid">Belum Lunas</option>
          </select>
        </div>
      </div>

      {/* SALES TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">No. Faktur</th>
                <th className="py-3 px-4">Tanggal & Waktu</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4 text-right">Total Transaksi</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Memuat transaksi...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Tidak ada transaksi yang cocok.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                      {s.transaction_number}
                    </td>

                    <td className="py-3.5 px-4 text-gray-600">
                      {s.sale_date}
                    </td>

                    <td className="py-3.5 px-4 text-gray-700">
                      {s.cashier_name}
                    </td>

                    <td className="py-3.5 px-4">
                      {s.customer_name ? (
                        <div>
                          <span className="font-semibold text-gray-900">{s.customer_name}</span>
                          <span className="block text-[11px] text-gray-400">{s.customer_phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Umum / Walk-in</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right tabular-nums font-extrabold text-sm text-[#111827]">
                      {formatRupiah(s.grand_total)}
                    </td>

                    <td className="py-3.5 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[11px] font-medium">
                        {s.payment_type?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          s.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.payment_status === 'partially_paid'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {s.payment_status === 'paid'
                          ? 'Lunas'
                          : s.payment_status === 'partially_paid'
                          ? 'Dicicil'
                          : 'Belum Lunas'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => viewSaleDetail(s.id)}
                          title="Lihat Rincian Item"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#4F46E5] hover:bg-indigo-50 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/sales/${s.id}`);
                            const data = await res.json();
                            if (data.success) {
                              setReceiptSale({
                                ...data.sale,
                                customer: data.sale.customer_name
                                  ? { name: data.sale.customer_name, phone: data.sale.customer_phone }
                                  : null,
                              });
                            }
                          }}
                          title="Cetak Ulang Struk"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSACTION DETAIL MODAL */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Faktur {selectedSaleDetail.transaction_number}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedSaleDetail.sale_date} • Kasir: {selectedSaleDetail.cashier_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Info */}
            {selectedSaleDetail.customer_name && (
              <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                <span className="text-gray-500 block">Data Pelanggan:</span>
                <p className="font-bold text-gray-900">
                  {selectedSaleDetail.customer_name} ({selectedSaleDetail.customer_phone})
                </p>
                {selectedSaleDetail.customer_address && (
                  <p className="text-gray-500">{selectedSaleDetail.customer_address}</p>
                )}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-gray-800">Daftar Produk Dibeli</h4>
              <div className="divide-y divide-gray-100 border rounded-xl overflow-hidden text-xs">
                {selectedSaleDetail.items?.map((it: any) => (
                  <div key={it.id} className="p-3 bg-white flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{it.product_name}</p>
                      <p className="text-[11px] text-gray-500">
                        {it.quantity} x {formatRupiah(it.unit_price)}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-gray-900">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Payments */}
            <div className="space-y-1.5 p-3 bg-gray-50 rounded-xl text-xs border">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="tabular-nums">{formatRupiah(selectedSaleDetail.subtotal)}</span>
              </div>
              {selectedSaleDetail.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon:</span>
                  <span className="tabular-nums">-{formatRupiah(selectedSaleDetail.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t text-[#4F46E5]">
                <span>Total:</span>
                <span className="tabular-nums">{formatRupiah(selectedSaleDetail.grand_total)}</span>
              </div>
              <div className="flex justify-between text-gray-600 pt-1">
                <span>Jumlah Dibayar:</span>
                <span className="tabular-nums">{formatRupiah(selectedSaleDetail.amount_paid)}</span>
              </div>
              {selectedSaleDetail.change_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Kembalian:</span>
                  <span className="tabular-nums">{formatRupiah(selectedSaleDetail.change_amount)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 text-xs"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setReceiptSale({
                    ...selectedSaleDetail,
                    customer: selectedSaleDetail.customer_name
                      ? { name: selectedSaleDetail.customer_name, phone: selectedSaleDetail.customer_phone }
                      : null,
                  });
                }}
                className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold hover:bg-[#4338CA] flex items-center justify-center gap-1.5 text-xs shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPRINT RECEIPT MODAL */}
      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
      )}
    </div>
  );
};
