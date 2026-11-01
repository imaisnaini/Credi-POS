import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Calendar,
  User,
  ArrowRight,
  Eye,
  X,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react';
import { CreditAccount } from '../types/index.ts';
import { formatRupiah, calculateCreditAging } from '../lib/financial.ts';
import { RepaymentReceiptModal } from '../components/common/RepaymentReceiptModal.tsx';

export const CreditManagement: React.FC = () => {
  const [credits, setCredits] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAging, setSelectedAging] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Repayment Modal & Detail Drawer State
  const [activeCreditAccount, setActiveCreditAccount] = useState<CreditAccount | null>(null);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayMethod, setRepayMethod] = useState<string>('cash');
  const [repayNotes, setRepayNotes] = useState<string>('');
  const [isSubmittingRepay, setIsSubmittingRepay] = useState(false);
  const [completedRepayment, setCompletedRepayment] = useState<any>(null);

  // Detail Modal
  const [detailCredit, setDetailCredit] = useState<CreditAccount | null>(null);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credits');
      const data = await res.json();
      if (data.success) {
        setCredits(data.credits);
      }
    } catch (err) {
      console.error('Failed to load credit accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  // Filtered accounts
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      // Search
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        c.customer_name.toLowerCase().includes(term) ||
        c.customer_phone.includes(term) ||
        c.transaction_number.toLowerCase().includes(term);

      // Status
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unpaid' && c.status === 'unpaid') ||
        (statusFilter === 'partially_paid' && c.status === 'partially_paid') ||
        (statusFilter === 'overdue' && c.is_overdue && c.remaining_balance > 0) ||
        (statusFilter === 'paid' && c.status === 'paid');

      // Aging
      const matchesAging =
        selectedAging === 'all' || c.aging_category === selectedAging;

      return matchesSearch && matchesStatus && matchesAging;
    });
  }, [credits, searchTerm, statusFilter, selectedAging]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let activeDebtorSet = new Set<string>();

    for (const c of credits) {
      if (c.remaining_balance > 0) {
        totalOutstanding += c.remaining_balance;
        activeDebtorSet.add(c.customer_id);
        if (c.is_overdue) {
          totalOverdue += c.remaining_balance;
          overdueCount++;
        }
      }
    }

    return {
      totalOutstanding,
      totalOverdue,
      overdueCount,
      debtorsCount: activeDebtorSet.size,
    };
  }, [credits]);

  // Initiate Repayment
  const openRepayModal = (account: CreditAccount) => {
    setActiveCreditAccount(account);
    setRepayAmount(account.remaining_balance.toString());
    setRepayMethod('cash');
    setRepayNotes('');
    setShowRepayModal(true);
  };

  // Submit Repayment
  const handleSubmitRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCreditAccount) return;

    const amountNum = parseFloat(repayAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Masukkan jumlah pembayaran yang valid.');
      return;
    }

    try {
      setIsSubmittingRepay(true);
      const res = await fetch(`/api/credits/${activeCreditAccount.id}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_method: repayMethod,
          notes: repayNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCompletedRepayment(data.repayment);
        setShowRepayModal(false);
        setActiveCreditAccount(null);
        fetchCredits();
      } else {
        alert(data.error || 'Gagal mencatat pembayaran');
      }
    } catch (err: any) {
      alert(err.message || 'Error server');
    } finally {
      setIsSubmittingRepay(false);
    }
  };

  // View full credit details with repayment logs
  const viewDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/credits/${id}`);
      const data = await res.json();
      if (data.success) {
        setDetailCredit(data.credit);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER & OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Piutang Berjalan
          </span>
          <div className="text-2xl font-black text-[#111827] mt-1 tabular-nums">
            {formatRupiah(stats.totalOutstanding)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">
            {stats.debtorsCount} Pelanggan Aktif Memiliki Hutang
          </span>
        </div>

        {/* Overdue Debt */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Total Piutang Lewat Tempo
          </span>
          <div className="text-2xl font-black text-[#EF4444] mt-1 tabular-nums">
            {formatRupiah(stats.totalOverdue)}
          </div>
          <span className="text-xs text-red-600 mt-1 block font-medium">
            {stats.overdueCount} Tagihan Butuh Tindakan Segera
          </span>
        </div>

        {/* Aging Buckets summary */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs col-span-1 sm:col-span-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Pilah Kategori Jatuh Tempo (Aging Filter)
          </span>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => setSelectedAging('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'all'
                  ? 'bg-[#4F46E5] text-white font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setSelectedAging('not_due')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'not_due'
                  ? 'bg-[#10B981] text-white font-bold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Belum Jatuh Tempo
            </button>
            <button
              onClick={() => setSelectedAging('overdue_1_7')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'overdue_1_7'
                  ? 'bg-amber-500 text-white font-bold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Lewat 1–7 Hari
            </button>
            <button
              onClick={() => setSelectedAging('overdue_8_30')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'overdue_8_30'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Lewat 8–30 Hari
            </button>
            <button
              onClick={() => setSelectedAging('overdue_31_60')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'overdue_31_60'
                  ? 'bg-red-500 text-white font-bold'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Lewat 31–60 Hari
            </button>
            <button
              onClick={() => setSelectedAging('overdue_60_plus')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAging === 'overdue_60_plus'
                  ? 'bg-red-700 text-white font-bold'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              &gt;60 Hari (Macet)
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama pelanggan, no. telepon, atau no. faktur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#4F46E5] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs">
          <span className="text-gray-500 shrink-0 font-medium">Status:</span>
          {['all', 'unpaid', 'partially_paid', 'overdue', 'paid'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-[#4F46E5] text-white font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {st === 'all'
                ? 'Semua'
                : st === 'unpaid'
                ? 'Belum Bayar'
                : st === 'partially_paid'
                ? 'Dicicil'
                : st === 'overdue'
                ? 'Lewat Tempo'
                : 'Lunas'}
            </button>
          ))}
        </div>
      </div>

      {/* CREDIT ACCOUNTS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4 text-right">Nominal Awal</th>
                <th className="py-3 px-4 text-right">Telah Dibayar</th>
                <th className="py-3 px-4 text-right">Sisa Piutang</th>
                <th className="py-3 px-4">Jatuh Tempo</th>
                <th className="py-3 px-4">Status & Aging</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Memuat data piutang...
                  </td>
                </tr>
              ) : filteredCredits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Tidak ada akun piutang yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredCredits.map((account) => {
                  const isSettled = account.remaining_balance <= 0;

                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-gray-50/80 transition group"
                    >
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{account.customer_name}</div>
                        <div className="text-[11px] text-gray-500">{account.customer_phone}</div>
                      </td>

                      {/* Transaction # */}
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-700">
                        {account.transaction_number}
                        <div className="text-[10px] text-gray-400 font-sans">
                          {account.created_at?.slice(0, 10)}
                        </div>
                      </td>

                      {/* Original Amount */}
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-600">
                        {formatRupiah(account.original_amount)}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3.5 px-4 text-right tabular-nums text-emerald-600 font-medium">
                        {formatRupiah(account.amount_paid)}
                      </td>

                      {/* Remaining Balance */}
                      <td className="py-3.5 px-4 text-right tabular-nums font-extrabold text-sm text-[#EF4444]">
                        {formatRupiah(account.remaining_balance)}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{account.due_date}</div>
                        {account.is_overdue && (
                          <span className="text-[10px] font-bold text-red-600 block">
                            Telat {account.days_overdue} hari
                          </span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4">
                        {isSettled ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                            Lunas
                          </span>
                        ) : account.is_overdue ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 inline-block">
                            {account.aging_label || 'Lewat Tempo'}
                          </span>
                        ) : account.amount_paid > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                            Dicicil Sebagian
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 inline-block">
                            Belum Bayar
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => viewDetails(account.id)}
                            title="Rincian & Riwayat Pembayaran"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#4F46E5] hover:bg-indigo-50 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!isSettled && (
                            <button
                              onClick={() => openRepayModal(account)}
                              className="px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>
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

      {/* RECORD REPAYMENT MODAL */}
      {showRepayModal && activeCreditAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#4F46E5]" />
                <h3 className="font-bold text-base text-gray-900">Catat Pembayaran Piutang</h3>
              </div>
              <button
                onClick={() => setShowRepayModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target account summary */}
            <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Pelanggan:</span>
                <span className="font-bold text-gray-900">{activeCreditAccount.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">No. Transaksi Asal:</span>
                <span className="font-mono">{activeCreditAccount.transaction_number}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                <span className="text-gray-700">Sisa Tagihan Faktur:</span>
                <span className="text-red-600 tabular-nums text-sm">
                  {formatRupiah(activeCreditAccount.remaining_balance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitRepay} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Nominal Pembayaran (IDR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1000"
                    max={activeCreditAccount.remaining_balance}
                    step="500"
                    required
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border rounded-xl font-bold text-sm tabular-nums focus:ring-2 focus:ring-[#4F46E5]"
                  />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setRepayAmount(activeCreditAccount.remaining_balance.toString())}
                    className="px-2.5 py-1 bg-indigo-50 text-[#4F46E5] rounded font-semibold text-[11px] hover:bg-indigo-100"
                  >
                    Bayar Lunas ({formatRupiah(activeCreditAccount.remaining_balance)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRepayAmount(Math.round(activeCreditAccount.remaining_balance / 2).toString())
                    }
                    className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded font-semibold text-[11px] hover:bg-gray-200"
                  >
                    Cicil 50%
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Metode Pembayaran *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Tunai', icon: Banknote },
                    { id: 'bank_transfer', label: 'Transfer', icon: CreditCard },
                    { id: 'qris', label: 'QRIS', icon: QrCode },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRepayMethod(m.id)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 font-semibold transition ${
                          repayMethod === m.id
                            ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Catatan Pembayaran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Titip lewat suaminya / via BCA"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepay}
                  className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl font-bold shadow-md hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {isSubmittingRepay ? 'Menyimpan...' : 'Simpan & Cetak Bukti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL */}
      {detailCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Rincian Piutang #{detailCredit.transaction_number}
                </h3>
                <p className="text-xs text-gray-500">
                  Pelanggan: {detailCredit.customer_name} ({detailCredit.customer_phone})
                </p>
              </div>
              <button
                onClick={() => setDetailCredit(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl text-center text-xs border">
              <div>
                <span className="text-gray-500 block">Total Awal</span>
                <span className="font-bold tabular-nums text-gray-800">
                  {formatRupiah(detailCredit.original_amount)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Telah Dibayar</span>
                <span className="font-bold tabular-nums text-emerald-600">
                  {formatRupiah(detailCredit.amount_paid)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Sisa Tagihan</span>
                <span className="font-bold tabular-nums text-red-600">
                  {formatRupiah(detailCredit.remaining_balance)}
                </span>
              </div>
            </div>

            {/* Repayment History Timeline */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-gray-800">Riwayat Pembayaran & Cicilan</h4>
              {(!detailCredit.repayments || detailCredit.repayments.length === 0) ? (
                <p className="text-xs text-gray-400 italic">Belum ada cicilan yang dicatat.</p>
              ) : (
                <div className="space-y-2">
                  {detailCredit.repayments.map((rp: any) => (
                    <div
                      key={rp.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-gray-900 font-mono">
                          {rp.payment_reference}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {rp.payment_date} • Kasir: {rp.received_by_name}
                        </div>
                        {rp.notes && (
                          <div className="text-[11px] text-gray-600 italic mt-0.5">
                            "{rp.notes}"
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 tabular-nums block text-sm">
                          {formatRupiah(rp.amount)}
                        </span>
                        <span className="text-[10px] text-gray-500 capitalize">
                          {rp.payment_method?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailCredit(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED REPAYMENT RECEIPT MODAL */}
      {completedRepayment && (
        <RepaymentReceiptModal
          repayment={completedRepayment}
          onClose={() => setCompletedRepayment(null)}
        />
      )}
    </div>
  );
};
