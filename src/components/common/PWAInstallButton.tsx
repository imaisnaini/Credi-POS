/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Download, CheckCircle2, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'sidebar';
}

export default function PWAInstallButton({
  className = '',
  variant = 'compact',
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!isInstallable) {
      return;
    }

    try {
      setInstalling(true);
      await install();
    } finally {
      setInstalling(false);
    }
  };

  // If already running standalone / installed
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">CrediPOS Terpasang (PWA)</span>
        </div>
      );
    }
    return null;
  }

  // If not installable and not iOS, don't clutter the top nav, but in sidebar or full variant show informative state
  if (!isInstallable && !isIOS && variant === 'compact') {
    return null;
  }

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between text-xs font-semibold px-3 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-sm transition-all ${className}`}
        >
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Pasang Aplikasi CrediPOS</span>
          </div>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
            PWA
          </span>
        </button>
      ) : variant === 'full' ? (
        <div
          className={`p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-600 text-white flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Pasang CrediPOS di Layar Utama (PWA)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Akses cepat kasir satu ketukan, layar penuh mandiri, dan caching offline berkinerja tinggi.
              </p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{isIOS ? 'Petunjuk iOS' : installing ? 'Memasang...' : 'Pasang Sekarang'}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/20 dark:hover:bg-indigo-500/30 transition-colors ${className}`}
          title="Pasang aplikasi di layar utama perangkat Anda"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pasang PWA</span>
        </button>
      )}

      {/* iOS Install Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Pasang di iPhone / iPad
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Ikuti 2 langkah mudah dari browser Safari untuk memasang CrediPOS ke layar utama Anda:
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start space-x-3 text-xs text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Ketuk tombol <strong className="font-semibold">Bagikan (Share)</strong>{' '}
                  <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> pada bar navigasi bawah Safari.
                </p>
              </div>
              <div className="flex items-start space-x-3 text-xs text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  Gulir ke bawah dan ketuk opsi <strong className="font-semibold">"Tambah ke Layar Utama" (Add to Home Screen)</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
