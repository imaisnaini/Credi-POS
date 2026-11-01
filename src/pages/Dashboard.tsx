import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Receipt,
  Package,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  ChevronRight,
  Store,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardMetrics } from '../types/index.ts';
import { formatRupiah } from '../lib/financial.ts';

interface DashboardProps {
  onNavigateToPOS?: () => void;
  onNavigateToCredit?: () => void;
  onNavigateToInventory?: () => void;
}

const PIE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToPOS,
  onNavigateToCredit,
  onNavigateToInventory,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto">
      {/* OVERDUE NOTICE BANNER */}
      {metrics.overdueAccountsCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-950">
                Peringatan: {metrics.overdueAccountsCount} Akun Tagihan Melewati Jatuh Tempo!
              </h4>
              <p className="text-xs text-red-700">
                Segera hubungi pelanggan untuk konfirmasi pembayaran atau penyesuaian jadwal pelunasan.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToCredit}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
          >
            Buka Daftar Piutang &rarr;
          </button>
        </div>
      )}

      {/* TOP ROW: PRIMARY FINANCIAL METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Penjualan Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4F46E5] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#111827] tabular-nums">
              {formatRupiah(metrics.todaySales)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              <strong>{metrics.todayTransactions}</strong> transaksi • rata-rata{' '}
              {formatRupiah(metrics.avgTransactionValue)}
            </p>
          </div>
        </div>

        {/* Total Outstanding Debt */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Piutang Belum Lunas</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#EF4444] tabular-nums">
              {formatRupiah(metrics.totalOutstandingDebt)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dari <strong>{metrics.customersWithDebtCount}</strong> pelanggan aktif berhutang
            </p>
          </div>
        </div>

        {/* Repayments Received */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pelunasan Diterima</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#10B981] tabular-nums">
              {formatRupiah(metrics.totalRepaymentsReceived)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Kas masuk dari cicilan & pembayaran piutang
            </p>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Nilai Aset Stok</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#111827] tabular-nums">
              {formatRupiah(metrics.inventoryValuationRetail)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Harga Modal: {formatRupiah(metrics.inventoryValuationCost)}
            </p>
          </div>
        </div>
      </div>

      {/* SECOND ROW: SALES & PAYMENT CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 Cols) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#111827]">Tren Penjualan (7 Hari Terakhir)</h3>
              <p className="text-xs text-gray-500">Perbandingan transaksi Tunai vs Hutang</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-gray-600">
                <span className="w-3 h-3 rounded-full bg-[#4F46E5]" /> Tunai/Lunas
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-600">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" /> Kredit (Bon)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.salesTrend}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `Rp${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatRupiah(Number(val)), '']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="cash"
                  name="Tunai"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCash)"
                />
                <Area
                  type="monotone"
                  dataKey="credit"
                  name="Kredit"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCredit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut Chart */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#111827]">Distribusi Pembayaran</h3>
            <p className="text-xs text-gray-500">Berdasarkan total omzet masuk</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.paymentDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {metrics.paymentDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => formatRupiah(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {metrics.paymentDistribution.map((p, idx) => (
              <div key={p.name} className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-1.5 capitalize">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  {p.name.replace('_', ' ')}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {formatRupiah(p.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* THIRD ROW: AGING ANALYSIS & TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit Aging Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#111827]">Analisis Umur Piutang (Aging)</h3>
              <p className="text-xs text-gray-500">Klasifikasi jatuh tempo dan risiko kredit</p>
            </div>
            <button
              onClick={onNavigateToCredit}
              className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1"
            >
              Lihat Rincian <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {metrics.agingDistribution.map((b) => (
              <div key={b.category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-gray-700">{b.label}</span>
                  <span className="font-bold tabular-nums text-gray-900">
                    {formatRupiah(b.amount)} ({b.count} akun)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${
                      b.category === 'not_due'
                        ? 'bg-[#10B981]'
                        : b.category === 'overdue_1_7'
                        ? 'bg-amber-400'
                        : b.category === 'overdue_8_30'
                        ? 'bg-amber-500'
                        : b.category === 'overdue_31_60'
                        ? 'bg-red-400'
                        : 'bg-red-600'
                    }`}
                    style={{
                      width: `${
                        metrics.totalOutstandingDebt > 0
                          ? Math.min(100, (b.amount / metrics.totalOutstandingDebt) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Best Selling Products */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#111827]">Produk Terlaris (Top 5)</h3>
              <p className="text-xs text-gray-500">Volume kuantitas dan total pendapatan</p>
            </div>
            <button
              onClick={onNavigateToInventory}
              className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1"
            >
              Kelola Stok <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {metrics.topProducts.map((tp, idx) => (
              <div
                key={tp.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-[#4F46E5] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{tp.name}</p>
                    <p className="text-gray-500 text-[11px]">Terjual {tp.quantity} unit</p>
                  </div>
                </div>
                <span className="font-bold text-[#4F46E5] tabular-nums shrink-0">
                  {formatRupiah(tp.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
