import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { TopNav } from './components/layout/TopNav.tsx';
import OfflineIndicator from './components/common/OfflineIndicator.tsx';
import { Pos } from './pages/Pos.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { CreditManagement } from './pages/CreditManagement.tsx';
import { Customers } from './pages/Customers.tsx';
import { Inventory } from './pages/Inventory.tsx';
import { Purchasing } from './pages/Purchasing.tsx';
import { Transactions } from './pages/Transactions.tsx';
import { Reports } from './pages/Reports.tsx';
import { Settings } from './pages/Settings.tsx';

function MainApp() {
  const { currentUser, isOwner, isCashier, isInventoryManager } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('pos');
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [totalDebt, setTotalDebt] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Fetch quick debt summary for top notification badges
  const fetchDebtSummary = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success && data.metrics) {
        setOverdueCount(data.metrics.overdueAccountsCount || 0);
        setTotalDebt(data.metrics.totalOutstandingDebt || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDebtSummary();
    const interval = setInterval(fetchDebtSummary, 15000);
    return () => clearInterval(interval);
  }, []);

  // Enforce role permission routing:
  // If Cashier is on reports/settings, switch to POS
  useEffect(() => {
    if (isCashier && (currentTab === 'reports' || currentTab === 'settings' || currentTab === 'purchasing')) {
      setCurrentTab('pos');
    }
    if (isInventoryManager && (currentTab === 'reports' || currentTab === 'settings')) {
      setCurrentTab('inventory');
    }
  }, [currentUser, isCashier, isInventoryManager, currentTab]);

  const getPageTitle = () => {
    switch (currentTab) {
      case 'pos':
        return {
          title: 'Kasir Penjualan (Point of Sale)',
          subtitle: 'Proses transaksi tunai, transfer, QRIS, e-wallet, dan pembukuan piutang kredit (bon)',
        };
      case 'dashboard':
        return {
          title: 'Dashboard Analisis Bisnis',
          subtitle: 'Ringkasan omzet harian, rasio piutang, dan metrik kesehatan inventaris',
        };
      case 'credits':
        return {
          title: 'Manajemen Piutang & Kredit Pelanggan',
          subtitle: 'Pengawasan akun piutang, klasifikasi jatuh tempo (aging), dan pelunasan cicilan',
        };
      case 'customers':
        return {
          title: 'Buku Pelanggan & Plafon Kredit',
          subtitle: 'Pendaftaran pelanggan, riwayat belanja, dan pemantauan batas hutang maksimal',
        };
      case 'inventory':
        return {
          title: 'Katalog Produk & Pengawasan Stok',
          subtitle: 'Manajemen SKU, barcode, harga modal/jual, serta log pergerakan stok barang',
        };
      case 'purchasing':
        return {
          title: 'Supplier & Pembelian Barang Masuk',
          subtitle: 'Pencatatan faktur kulakan supplier dan otomatisasi penambahan stok gudang',
        };
      case 'transactions':
        return {
          title: 'Riwayat Transaksi Penjualan',
          subtitle: 'Arsip seluruh penjualan, bukti pembayaran, dan pencetakan ulang struk belanja',
        };
      case 'reports':
        return {
          title: 'Laporan Keuangan & Akuntansi Bisnis',
          subtitle: 'Laba rugi kotor (P&L), arus kas pelunasan vs omzet, dan ekspor data CSV',
        };
      case 'settings':
        return {
          title: 'Profil Toko & Pengaturan Sistem',
          subtitle: 'Informasi badan usaha, mata uang Rupiah (IDR), pajak, dan pengelolaan demo data',
        };
      default:
        return { title: 'CrediPOS', subtitle: 'Point of Sale & Credit Management System' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        overdueCount={overdueCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Offline Warning Banner */}
        <OfflineIndicator />

        {/* Top Navbar */}
        <TopNav
          title={title}
          subtitle={subtitle}
          overdueCount={overdueCount}
          totalDebt={totalDebt}
          onNavigateToCredit={() => setCurrentTab('credits')}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Dynamic Page Views */}
        <main className={`flex-1 min-h-0 min-w-0 bg-[#F9FAFB] ${currentTab === 'pos' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
          {currentTab === 'pos' && <Pos />}
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateToPOS={() => setCurrentTab('pos')}
              onNavigateToCredit={() => setCurrentTab('credits')}
              onNavigateToInventory={() => setCurrentTab('inventory')}
            />
          )}
          {currentTab === 'credits' && <CreditManagement />}
          {currentTab === 'customers' && <Customers />}
          {currentTab === 'inventory' && <Inventory />}
          {currentTab === 'purchasing' && <Purchasing />}
          {currentTab === 'transactions' && <Transactions />}
          {currentTab === 'reports' && <Reports />}
          {currentTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
