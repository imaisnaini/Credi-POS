import React from 'react';
import { Printer, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatRupiah } from '../../lib/financial.ts';

interface ReceiptModalProps {
  sale: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCredit = sale.payment_type === 'credit' || sale.remaining_balance > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#4F46E5] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#A3E635]" />
            <h3 className="font-bold text-base">Transaksi Berhasil Disimpan</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content Printable Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 flex justify-center">
          <div
            id="printable-receipt"
            className="w-full max-w-[320px] bg-white p-5 border border-gray-200 rounded-lg shadow-sm font-mono text-xs text-[#111827]"
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-300">
              <h2 className="font-bold text-sm text-[#111827]">TOKO BERKAH MANDIRI</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Jl. Kemang Raya No. 18, Jakarta Selatan
              </p>
              <p className="text-[10px] text-gray-500">Telp: 0812-8899-7766</p>
            </div>

            {/* Meta Information */}
            <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">No. Trx:</span>
                <span className="font-bold">{sale.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal:</span>
                <span>{sale.sale_date || new Date().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kasir:</span>
                <span>{sale.cashier_name || 'Kasir'}</span>
              </div>
              {sale.customer && (
                <div className="flex justify-between font-medium">
                  <span className="text-gray-500">Pelanggan:</span>
                  <span className="text-[#4F46E5] font-bold">{sale.customer.name}</span>
                </div>
              )}
            </div>

            {/* Itemized List */}
            <div className="py-2.5 border-b border-dashed border-gray-300 space-y-2 text-[11px]">
              {sale.items?.map((item: any, idx: number) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-gray-900">{item.product_name}</div>
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {item.quantity} x {formatRupiah(item.unit_price)}
                    </span>
                    <span className="tabular-nums font-medium text-gray-900">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                  {item.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 text-[10px]">
                      <span>Diskon item:</span>
                      <span>-{formatRupiah(item.discount_amount)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal:</span>
                <span className="tabular-nums">{formatRupiah(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon Transaksi:</span>
                  <span className="tabular-nums">-{formatRupiah(sale.discount_amount)}</span>
                </div>
              )}
              {sale.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">PPN:</span>
                  <span className="tabular-nums">{formatRupiah(sale.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200">
                <span>TOTAL:</span>
                <span className="tabular-nums text-[#4F46E5]">{formatRupiah(sale.grand_total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
              <div className="flex justify-between capitalize">
                <span className="text-gray-500">Metode Bayar:</span>
                <span className="font-semibold">{sale.payment_type?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dibayar:</span>
                <span className="tabular-nums font-semibold">{formatRupiah(sale.amount_paid)}</span>
              </div>
              {sale.change_amount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Kembalian:</span>
                  <span className="tabular-nums">{formatRupiah(sale.change_amount)}</span>
                </div>
              )}
            </div>

            {/* Credit / Piutang Section if applicable */}
            {isCredit && (
              <div className="my-2.5 p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[10px] space-y-1">
                <div className="flex items-center gap-1 font-bold text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>CATATAN BON / HUTANG</span>
                </div>
                <div className="flex justify-between font-bold text-[11px]">
                  <span>Sisa Piutang:</span>
                  <span className="text-red-700 tabular-nums">
                    {formatRupiah(sale.remaining_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Jatuh Tempo:</span>
                  <span className="font-semibold">{sale.due_date || '14 hari kedepan'}</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-gray-500 space-y-1">
              <p>Barang yang sudah dibeli tidak dapat ditukar kecuali ada perjanjian.</p>
              <p className="font-semibold text-gray-700">*** TERIMA KASIH ***</p>
              <p className="text-[9px] text-gray-400">Powered by CrediPOS System</p>
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-bold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk (Print)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
