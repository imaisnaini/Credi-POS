import React from 'react';
import { Printer, X, CheckCircle } from 'lucide-react';
import { formatRupiah } from '../../lib/financial.ts';

interface RepaymentReceiptModalProps {
  repayment: any;
  onClose: () => void;
}

export const RepaymentReceiptModal: React.FC<RepaymentReceiptModalProps> = ({
  repayment,
  onClose,
}) => {
  if (!repayment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#10B981] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-white" />
            <h3 className="font-bold text-base">Pembayaran Piutang Berhasil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Voucher */}
        <div className="p-6 bg-gray-50 flex justify-center">
          <div
            id="printable-receipt"
            className="w-full max-w-[320px] bg-white p-5 border border-gray-200 rounded-lg shadow-sm font-mono text-xs text-[#111827]"
          >
            <div className="text-center pb-3 border-b border-dashed border-gray-300">
              <h2 className="font-bold text-sm text-[#111827]">TOKO BERKAH MANDIRI</h2>
              <p className="text-[10px] text-gray-500">BUKTI RESMI PEMBAYARAN HUTANG / PIUTANG</p>
              <p className="text-[10px] text-gray-400 mt-1">Ref: {repayment.payment_reference}</p>
            </div>

            <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal:</span>
                <span>{repayment.payment_date || new Date().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nama Pelanggan:</span>
                <span className="font-bold text-gray-900">{repayment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">No. Transaksi Asal:</span>
                <span>{repayment.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Penerima Kasir:</span>
                <span>{repayment.received_by_name || 'Kasir'}</span>
              </div>
            </div>

            <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between font-bold text-sm text-[#10B981]">
                <span>JUMLAH DIBAYAR:</span>
                <span className="tabular-nums">{formatRupiah(repayment.amount_paid)}</span>
              </div>
              {repayment.excess_change > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Kembalian:</span>
                  <span className="tabular-nums">{formatRupiah(repayment.excess_change)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Sisa Tagihan Faktur Ini:</span>
                <span className="tabular-nums font-semibold">
                  {formatRupiah(repayment.remaining_balance)}
                </span>
              </div>
              <div className="flex justify-between text-[#4F46E5] font-bold">
                <span>Total Sisa Hutang Pelanggan:</span>
                <span className="tabular-nums">
                  {formatRupiah(repayment.customer_remaining_total)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Status Faktur:</span>
                <span
                  className={`font-bold uppercase ${
                    repayment.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {repayment.status === 'paid' ? 'LUNAS' : 'SEBAGIAN (DICICIL)'}
                </span>
              </div>
            </div>

            <div className="text-center pt-3 text-[10px] text-gray-400 space-y-1">
              <p>Bukti ini sah dan dicatat dalam sistem buku besar CrediPOS.</p>
              <p className="font-semibold text-gray-600">Terima kasih atas pembayarannya.</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl text-sm font-bold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Bukti (Print)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
