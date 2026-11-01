import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Store,
  Users,
  Shield,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatRupiah } from '../../lib/financial.ts';
import PWAInstallButton from '../common/PWAInstallButton.tsx';

interface TopNavProps {
  title: string;
  subtitle?: string;
  overdueCount?: number;
  totalDebt?: number;
  onNavigateToCredit?: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  title,
  subtitle,
  overdueCount = 0,
  totalDebt = 0,
  onNavigateToCredit,
  onToggleMobileMenu,
}) => {
  const { currentUser, users, switchUser, business } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Subtitle with Mobile Menu Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
          aria-label="Buka menu navigasi"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 className="text-base md:text-xl font-bold text-[#111827] tracking-tight">{title}</h1>
          {subtitle && <p className="text-[11px] md:text-xs text-[#6B7280] hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Overdue Debt Alert Pill */}
        {overdueCount > 0 && (
          <button
            onClick={onNavigateToCredit}
            className="hidden sm:flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>
              <strong>{overdueCount} Tagihan Lewat Tempo</strong> ({formatRupiah(totalDebt)})
            </span>
          </button>
        )}

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#6B7280] bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200">
          <Clock className="w-3.5 h-3.5 text-[#4F46E5]" />
          <span className="tabular-nums font-mono font-medium">{currentTime} WIB</span>
        </div>

        {/* Store Identifier */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#111827] bg-indigo-50/70 text-indigo-900 px-3 py-1.5 rounded-md border border-indigo-100">
          <Store className="w-3.5 h-3.5 text-[#4F46E5]" />
          <span className="font-semibold">{business?.name || 'Toko Utama'}</span>
        </div>

        {/* PWA Install Button */}
        <PWAInstallButton variant="compact" />

        {/* RBAC Role / User Switcher for Easy Evaluation */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-[#111827] transition shadow-sm"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                currentUser?.role === 'owner'
                  ? 'bg-purple-600'
                  : currentUser?.role === 'cashier'
                  ? 'bg-blue-600'
                  : 'bg-amber-600'
              }`}
            />
            <span className="font-bold">{currentUser?.name}</span>
            <span className="text-[#6B7280] capitalize">
              ({currentUser?.role?.replace('_', ' ')})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#6B7280] uppercase border-b border-gray-100">
                Ganti Role Pengguna (Demo RBAC)
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u.id);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 transition ${
                    currentUser?.id === u.id ? 'bg-indigo-50/80 font-bold text-[#4F46E5]' : 'text-[#111827]'
                  }`}
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-[11px] text-[#6B7280] capitalize">
                      {u.role.replace('_', ' ')} • @{u.username}
                    </p>
                  </div>
                  {currentUser?.id === u.id && (
                    <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
