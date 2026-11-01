import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Receipt,
  PieChart,
  ShieldAlert,
} from 'lucide-react';
import { formatRupiah } from '../lib/financial.ts';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'pnl' | 'sales' | 'credit_aging'>('pnl');
  const [pnlData, setPnlData] = useState<any>(null);
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [creditReport, setCreditReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [pnlRes, salesRes, creditRes] = await Promise.all([
        fetch('/api/reports?type=pnl'),
        fetch('/api/reports?type=sales'),
        fetch('/api/reports?type=credit_aging'),
      ]);

      const pnlJson = await pnlRes.json();
      const salesJson = await salesRes.json();
      const creditJson = await creditRes.json();

      if (pnlJson.success) setPnlData(pnlJson.report);
      if (salesJson.success) setSalesReport(salesJson.report);
      if (creditJson.success) setCreditReport(creditJson.report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // CSV Exporter
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'sales') {
      csvContent += 'Periode,Jumlah Transaksi,Total Omzet,Kas Diterima di Kasir,Piutang Terbit\n';
      salesReport.forEach((row) => {
        csvContent += `${row.period},${row.count},${row.revenue},${row.cash_collected},${row.credit_issued}\n`;
      });
    } else if (reportType === 'credit_aging') {
      csvContent += 'Pelanggan,Telepon,No Transaksi,Tanggal Faktur,Jatuh Tempo,Nominal Awal,Sisa Piutang,Kategori Aging\n';
      creditReport.forEach((row) => {
        csvContent += `"${row.customer_name}",${row.customer_phone},${row.transaction_number},${row.sale_date},${row.due_date},${row.original_amount},${row.remaining_balance},"${row.aging_label}"\n`;
      });
    } else {
      csvContent += 'Metrik Keuangan,Nilai (IDR)\n';
      if (pnlData) {
        csvContent += `Total Omzet Penjualan,${pnlData.totalRevenue}\n`;
        csvContent += `Harga Pokok Penjualan (HPP),${pnlData.costOfGoodsSold}\n`;
        csvContent += `Laba Kotor (Gross Profit),${pnlData.grossProfit}\n`;
        csvContent += `Margin Laba Kotor,${pnlData.profitMargin}%\n`;
        csvContent += `Pelunasan Piutang Diterima,${pnlData.repaymentsCollected}\n`;
        csvContent += `Total Piutang Belum Tertagih,${pnlData.outstandingDebt}\n`;
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CrediPOS_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER & EXPORT */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Laporan Keuangan & Analisis Bisnis</h2>
          <p className="text-xs text-gray-500">
            Pemisahan akuntansi ketat antara pendapatan omzet, kas fisik, dan piutang kredit
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setReportType('pnl')}
              className={`px-3 py-1.5 rounded-lg transition ${
                reportType === 'pnl' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Laba Rugi (P&L)
            </button>
            <button
              onClick={() => setReportType('sales')}
              className={`px-3 py-1.5 rounded-lg transition ${
                reportType === 'sales' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Laporan Penjualan
            </button>
            <button
              onClick={() => setReportType('credit_aging')}
              className={`px-3 py-1.5 rounded-lg transition ${
                reportType === 'credit_aging' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
              }`}
            >
              Laporan Aging Piutang
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {reportType === 'pnl' && pnlData && (
        <div className="space-y-6">
          {/* CRITICAL ACCOUNTING DISTINCTION NOTICE */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 space-y-1">
            <h4 className="font-bold flex items-center gap-1.5 text-indigo-950">
              <TrendingUp className="w-4 h-4 text-[#4F46E5]" />
              Integritas & Pemisahan Akuntansi CrediPOS:
            </h4>
            <p>
              • <strong>Omzet Penjualan</strong> dihitung saat transaksi terjadi (Accrual Basis).
              <br />
              • <strong>Pelunasan Cicilan Piutang</strong> dicatat sebagai penerimaan kas pelunasan hak tagih, <em>TIDAK digandakan sebagai omzet penjualan baru</em>.
            </p>
          </div>

          {/* PROFIT & LOSS STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Pendapatan (Omzet)
              </span>
              <div className="text-2xl font-black text-[#111827] mt-1 tabular-nums">
                {formatRupiah(pnlData.totalRevenue)}
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Total faktur barang keluar kepada pelanggan
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Harga Pokok Penjualan (HPP / COGS)
              </span>
              <div className="text-2xl font-black text-gray-700 mt-1 tabular-nums">
                {formatRupiah(pnlData.costOfGoodsSold)}
              </div>
              <span className="text-xs text-gray-400 mt-1 block">
                Total modal pembelian produk yang terjual
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Laba Kotor (Gross Profit)
              </span>
              <div className="text-2xl font-black text-[#10B981] mt-1 tabular-nums">
                {formatRupiah(pnlData.grossProfit)}
              </div>
              <span className="text-xs text-emerald-700 mt-1 block font-bold">
                Margin Keuntungan: {pnlData.profitMargin}%
              </span>
            </div>
          </div>

          {/* CASH COLLECTION VS RECEIVABLES BREAKDOWN */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#111827]">
              Rekonsiliasi Kas Masuk vs Piutang Beredar
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <span className="font-bold text-emerald-900 block text-sm">
                  Kas Nyata dari Pelunasan Piutang
                </span>
                <div className="text-2xl font-black text-emerald-700 tabular-nums">
                  {formatRupiah(pnlData.repaymentsCollected)}
                </div>
                <p className="text-emerald-800 text-[11px]">
                  Uang tunai atau transfer yang berhasil ditagih kembali dari buku kas bon pelanggan.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
                <span className="font-bold text-red-900 block text-sm">
                  Total Tagihan Piutang Masih Tertahan
                </span>
                <div className="text-2xl font-black text-red-600 tabular-nums">
                  {formatRupiah(pnlData.outstandingDebt)}
                </div>
                <p className="text-red-800 text-[11px]">
                  Modal toko yang masih berada di tangan pelanggan dan menunggu pelunasan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'sales' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Tanggal Penjualan</th>
                  <th className="py-3 px-4 text-center">Jumlah Transaksi</th>
                  <th className="py-3 px-4 text-right">Total Omzet Penjualan</th>
                  <th className="py-3 px-4 text-right">Kas Diterima (Tunai/Non-Tunai)</th>
                  <th className="py-3 px-4 text-right">Piutang Diterbitkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesReport.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{r.period}</td>
                    <td className="py-3.5 px-4 text-center font-medium">{r.count} trx</td>
                    <td className="py-3.5 px-4 text-right font-extrabold tabular-nums text-[#111827]">
                      {formatRupiah(r.revenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-emerald-600">
                      {formatRupiah(r.cash_collected)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-amber-600">
                      {formatRupiah(r.credit_issued)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'credit_aging' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-4">No. Faktur</th>
                  <th className="py-3 px-4">Jatuh Tempo</th>
                  <th className="py-3 px-4 text-right">Nominal Awal</th>
                  <th className="py-3 px-4 text-right">Sisa Piutang</th>
                  <th className="py-3 px-4">Kategori Aging & Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creditReport.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{c.customer_name}</div>
                      <div className="text-[11px] text-gray-500">{c.customer_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{c.transaction_number}</td>
                    <td className="py-3.5 px-4">{c.due_date}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-gray-600">
                      {formatRupiah(c.original_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-red-600">
                      {formatRupiah(c.remaining_balance)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.aging_category === 'not_due'
                            ? 'bg-emerald-50 text-emerald-800'
                            : c.aging_category === 'overdue_1_7'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.aging_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
