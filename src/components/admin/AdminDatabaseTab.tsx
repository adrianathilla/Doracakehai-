import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  AdminActivityLog,
  AdminUserPublic,
  FirebaseRuntimeStatus,
  Order,
  Product,
} from '../../types';
import {
  FIREBASE_DATABASE_ID,
  FIREBASE_PROJECT_ID,
  testConnection,
} from '../../firebase';
import {
  exportFirebaseBackup,
  restoreFirebaseBackup,
} from '../../services/firebaseService';
import { formatDateTimeId } from '../../utils/format';

interface AdminDatabaseTabProps {
  currentAdmin: AdminUserPublic;
  firebaseStatus: FirebaseRuntimeStatus;
  lastSyncedAt: string;
  activityLogs: AdminActivityLog[];
  orders: Order[];
  products: Product[];
  onRefreshStatus: () => void;
  onUpdated?: () => Promise<void> | void;
}

export const AdminDatabaseTab: React.FC<AdminDatabaseTabProps> = ({
  currentAdmin,
  firebaseStatus,
  lastSyncedAt,
  activityLogs,
  orders,
  products,
  onRefreshStatus,
  onUpdated,
}) => {
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [healthText, setHealthText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheckConnection = async () => {
    setChecking(true);
    setHealthText(null);
    setErrorMsg(null);
    try {
      const res = await testConnection();
      onRefreshStatus();
      setHealthText(res.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memeriksa koneksi.');
    } finally {
      setChecking(false);
    }
  };

  const handleBackupJson = async () => {
    setExporting(true);
    setErrorMsg(null);
    try {
      const backup = await exportFirebaseBackup(currentAdmin);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doracake-firestore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setHealthText('File backup lengkap Cloud Firestore berhasil diunduh.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengekspor backup Firestore.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportOrdersCsv = () => {
    const headers = [
      'No. Pesanan',
      'Tanggal',
      'Pelanggan',
      'Metode',
      'Status Pesanan',
      'Status Pembayaran',
      'Total (Rp)',
    ];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.orderDate,
      `"${o.customerName.replace(/"/g, '""')}"`,
      o.deliveryMethod,
      o.orderStatus,
      o.paymentStatus,
      String(o.total),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doracake-pesanan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportProductsCsv = () => {
    const headers = ['Kode Produk', 'Nama Produk', 'Harga Normal', 'Harga Promo', 'Stok', 'Status Aktif'];
    const rows = products.map((p) => [
      p.productCode || '',
      `"${p.name.replace(/"/g, '""')}"`,
      String(p.price),
      String(p.promoPrice ?? ''),
      String(p.stock),
      p.isActive ? 'Aktif' : 'Nonaktif',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doracake-produk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setHealthText(null);
    const reader = new FileReader();
    reader.onload = async () => {
      setRestoring(true);
      try {
        const parsed = JSON.parse(String(reader.result)) as Record<string, unknown>;
        await restoreFirebaseBackup(currentAdmin, parsed);
        if (onUpdated) await onUpdated();
        setHealthText('Data berhasil dipulihkan ke Cloud Firestore dari file backup.');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'File backup tidak valid.');
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
          Database Cloud Firestore &amp; Keamanan
        </h2>
        <p className="mt-1 text-sm text-[#5C4435]">
          Pantau status koneksi Firebase, ekspor data, backup/pemulihan Firestore, dan riwayat
          aktivitas admin.
        </p>
      </div>

      {healthText && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{healthText}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Required Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-xs font-semibold uppercase text-[#6E5849]">Status Koneksi Database</p>
          <p className="mt-2 text-base font-bold text-emerald-800">
            {firebaseStatus.state === 'error' ? 'Koneksi Terganggu' : 'Cloud Firestore Aktif'}
          </p>
          <p className="font-mono-tabular mt-1 text-[11px] text-[#6E5849]">
            Project: {FIREBASE_PROJECT_ID}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-xs font-semibold uppercase text-[#6E5849]">Database ID</p>
          <p className="font-mono-tabular mt-2 truncate text-xs font-bold text-[#2C1810]" title={FIREBASE_DATABASE_ID}>
            {FIREBASE_DATABASE_ID}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700">Real-Time Listener Aktif</p>
        </div>

        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-xs font-semibold uppercase text-[#6E5849]">Sinkronisasi Terakhir</p>
          <p className="font-mono-tabular mt-2 text-sm font-bold text-[#2C1810]">
            {formatDateTimeId(lastSyncedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-xs font-semibold uppercase text-[#6E5849]">Status Autentikasi</p>
          <p className="mt-2 flex items-center gap-1.5 text-base font-bold text-[#2C1810]">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span>Google Admin ({currentAdmin.role})</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-[#9E7840]" />
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Pemeliharaan, Backup &amp; Pemulihan Data
          </h3>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckConnection}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>Periksa Koneksi Firestore</span>
          </button>

          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor Pesanan (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportProductsCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor Produk (CSV)</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={handleBackupJson}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5 text-[#E7CFA2]" />
            <span>{exporting ? 'Menyiapkan Backup...' : 'Backup Lengkap (JSON)'}</span>
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#3B2316] bg-[#FFFDF9] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4]">
            <Upload className="h-3.5 w-3.5" />
            <span>{restoring ? 'Memulihkan...' : 'Pulihkan Data (JSON)'}</span>
            <input
              type="file"
              accept=".json"
              disabled={restoring}
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Admin Activity History */}
      <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
        <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
          Riwayat Aktivitas Admin
        </h3>
        <div className="mt-4 max-h-72 divide-y divide-[#F0E4D2] overflow-y-auto">
          {activityLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#6E5849]">
              Belum ada aktivitas admin yang tercatat.
            </p>
          ) : (
            activityLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#2C1810]">{log.action}</span>
                  <span className="ml-1.5 text-[#5C4435]">— {log.target}</span>
                </div>
                <div className="text-[#6E5849]">
                  <span>{log.actorName}</span> ·{' '}
                  <span className="font-mono-tabular">{formatDateTimeId(log.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
