import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Users,
  Package,
  Truck,
  History,
  BarChart3,
  Settings,
  Store,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import PWAInstallButton from '../common/PWAInstallButton.tsx';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  overdueCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  overdueCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { currentUser, isOwner, isCashier, isInventoryManager, business } = useAuth();

  const navItems = [
    {
      id: 'pos',
      label: 'Kasir (POS)',
      icon: ShoppingCart,
      roles: ['owner', 'cashier'],
      badge: 'Utama',
      badgeClass: 'bg-[#A3E635] text-[#111827] font-semibold',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['owner', 'inventory_manager'],
    },
    {
      id: 'credits',
      label: 'Kelola Piutang & Kredit',
      icon: Receipt,
      roles: ['owner', 'cashier'],
      badge: overdueCount > 0 ? `${overdueCount} Lewat` : undefined,
      badgeClass: 'bg-red-100 text-red-700 font-bold animate-pulse',
    },
    {
      id: 'customers',
      label: 'Data Pelanggan',
      icon: Users,
      roles: ['owner', 'cashier', 'inventory_manager'],
    },
    {
      id: 'inventory',
      label: 'Produk & Stok',
      icon: Package,
      roles: ['owner', 'inventory_manager'],
    },
    {
      id: 'purchasing',
      label: 'Supplier & Pembelian',
      icon: Truck,
      roles: ['owner', 'inventory_manager'],
    },
    {
      id: 'transactions',
      label: 'Riwayat Transaksi',
      icon: History,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'reports',
      label: 'Laporan Bisnis',
      icon: BarChart3,
      roles: ['owner'],
      badge: 'Owner',
      badgeClass: 'bg-indigo-100 text-[#4F46E5] text-[10px]',
    },
    {
      id: 'settings',
      label: 'Pengaturan Toko',
      icon: Settings,
      roles: ['owner'],
    },
  ];

  // Filter accessible navigation based on current user role
  const accessibleItems = navItems.filter((item) =>
    currentUser ? item.roles.includes(currentUser.role) : true
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 select-none transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white font-black text-xl shadow-sm">
              C<span className="text-[#A3E635] text-sm font-bold ml-0.5">P</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#111827] tracking-tight">CrediPOS</span>
                <span className="bg-[#A3E635] text-[#111827] text-[10px] font-bold px-1.5 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              <span className="text-xs text-[#6B7280] truncate max-w-[130px]">
                {business?.name || 'Toko Retail'}
              </span>
            </div>
          </div>
        </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider px-3 mb-2">
          Menu Operasional
        </div>

        {accessibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#4F46E5] text-white shadow-sm font-semibold'
                  : 'text-[#111827] hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : item.badgeClass
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* PWA Install Promotion */}
      <div className="px-3 pb-2">
        <PWAInstallButton variant="sidebar" />
      </div>

      {/* Current User Role Footer */}
      <div className="p-3 border-t border-gray-100 bg-[#F9FAFB]">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-200">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isOwner
                ? 'bg-purple-100 text-purple-700'
                : isCashier
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#111827] truncate">
              {currentUser?.name || 'Kasir'}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
              <span className="capitalize">{currentUser?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};
