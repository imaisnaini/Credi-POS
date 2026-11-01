/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WifiOff, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-amber-500 text-slate-950 px-4 py-2 text-xs md:text-sm font-semibold flex items-center justify-between shadow-md sticky top-0 z-50 border-b border-amber-600 animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <div className="flex items-center space-x-2 max-w-5xl mx-auto w-full">
        <div className="p-1 bg-amber-600/30 rounded-full flex-shrink-0">
          <WifiOff className="w-4 h-4 text-slate-950" />
        </div>
        <div className="flex-1">
          <span className="font-bold">Mode Offline Terdeteksi:</span>{' '}
          <span className="font-medium text-slate-900">
            Koneksi internet terputus. Data ditampilkan dari cache. Transaksi baru ditangguhkan demi konsistensi dan integritas pembukuan finansial.
          </span>
        </div>
        <div className="hidden sm:flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 bg-slate-950 text-amber-400 rounded">
          <AlertTriangle className="w-3 h-3" />
          <span>CHECKOUT DINONAKTIFKAN</span>
        </div>
      </div>
    </div>
  );
}
