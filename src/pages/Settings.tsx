import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Store,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import PWAInstallButton from '../components/common/PWAInstallButton.tsx';

export const Settings: React.FC = () => {
  const { business, refreshBusiness, isOwner, currentUser } = useAuth();
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    currency: 'IDR',
    tax_rate: 0,
    timezone: 'Asia/Jakarta',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        address: business.address || '',
        phone: business.phone || '',
        email: business.email || '',
        currency: business.currency || 'IDR',
        tax_rate: business.tax_rate || 0,
        timezone: business.timezone || 'Asia/Jakarta',
      });
    }
  }, [business]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      alert('Hanya pemilik (owner) yang memiliki hak akses mengubah profil toko.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveSuccess(false);
      const res = await fetch('/api/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        refreshBusiness();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSeedData = async () => {
    const confirmReset = window.confirm(
      'Apakah Anda yakin ingin mengatur ulang data ke dataset percontohan awal (25 produk ritel, 12 pelanggan, transaksi & piutang demo)?'
    );
    if (!confirmReset) return;

    try {
      setIsResetting(true);
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Database berhasil di-reset ke dataset percontohan.');
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Pengaturan Profil Usaha & Sistem</h2>
        <p className="text-xs text-gray-500">
          Kelola identitas ritel, mata uang Rupiah (IDR), dan konfigurasi perpajakan
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Nama Toko Ritel *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!isOwner}
                className="w-full p-2.5 border rounded-xl disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Nomor Telepon Toko *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={!isOwner}
                className="w-full p-2.5 border rounded-xl disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Alamat Fisik Toko</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!isOwner}
              className="w-full p-2.5 border rounded-xl disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Mata Uang Baku</label>
              <input
                type="text"
                disabled
                value="IDR (Indonesian Rupiah)"
                className="w-full p-2.5 border rounded-xl bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Zona Waktu</label>
              <input
                type="text"
                disabled
                value="Asia/Jakarta (WIB)"
                className="w-full p-2.5 border rounded-xl bg-gray-100 text-gray-600"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                Tarif Pajak PPN (Desimal)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                disabled={!isOwner}
                className="w-full p-2.5 border rounded-xl tabular-nums disabled:bg-gray-100"
                placeholder="0.0 (Bebas pajak sembako)"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                0 = Bebas Pajak, 0.11 = 11% PPN
              </span>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan profil berhasil disimpan ke database.</span>
            </div>
          )}

          {isOwner && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-bold shadow-md transition disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* PWA APPLICATION INSTALLATION */}
      <PWAInstallButton variant="full" />

      {/* DEVELOPER DEMO SEED RESET SECTION */}
      <div className="bg-white rounded-2xl border border-red-200 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">
              Reset & Muat Ulang Dataset Percontohan (Demo Seed Data)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Fitur khusus pengujian untuk memulihkan katalog 25 produk sembako Indonesia, 12 akun pelanggan dengan berbagai status jatuh tempo piutang, dan riwayat faktur demo.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetSeedData}
          disabled={isResetting}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>{isResetting ? 'Mereset Database...' : 'Reset ke Demo Dataset Awal'}</span>
        </button>
      </div>
    </div>
  );
};
