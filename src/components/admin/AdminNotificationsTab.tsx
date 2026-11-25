import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckSquare,
  Megaphone,
  Search,
  Send,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AppNotification,
  CustomerAccount,
  CustomerMemberTier,
  NotificationCategory,
} from '../../types';
import {
  deleteNotificationFirebase,
  markAllNotificationsReadFirebase,
  markNotificationReadFirebase,
  sendAdminManualNotificationFirebase,
} from '../../services/firebaseService';
import { formatDateTimeId } from '../../utils/format';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../../utils/webNotifications';

interface AdminNotificationsTabProps {
  actorName: string;
  notifications: AppNotification[];
  customers: CustomerAccount[];
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  actorName,
  notifications,
  customers,
}) => {
  const [subTab, setSubTab] = useState<'compose' | 'inbox' | 'sent'>('compose');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('Promo');
  const [targetMode, setTargetMode] = useState<'broadcast' | 'selected'>('broadcast');

  // Target multi-select filters
  const [searchCust, setSearchCust] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | CustomerMemberTier>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [perm, setPerm] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission(),
  );

  const adminInbox = useMemo(
    () => notifications.filter((n) => n.targetType === 'admin'),
    [notifications],
  );
  const unreadInboxCount = useMemo(
    () => adminInbox.filter((n) => !n.isRead).length,
    [adminInbox],
  );
  const sentHistory = useMemo(
    () => notifications.filter((n) => n.targetType === 'broadcast' || n.targetType === 'customer'),
    [notifications],
  );

  const eligibleCustomers = useMemo(() => {
    const q = searchCust.trim().toLowerCase();
    return customers.filter((c) => {
      if (c.status !== 'Aktif' || !c.authUid) return false;
      if (tierFilter !== 'ALL' && c.tier !== tierFilter) return false;
      if (q) {
        return (
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, searchCust, tierFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllFiltered = () => {
    const ids = eligibleCustomers.map((c) => c.id);
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const targetCustomers =
      targetMode === 'selected'
        ? customers.filter((c) => selectedIds.includes(c.id))
        : [];

    setBusy(true);
    try {
      const sentCount = await sendAdminManualNotificationFirebase({
        actorName,
        title,
        message,
        category,
        targetMode,
        targetCustomers,
      });
      setFeedback({
        type: 'success',
        text:
          targetMode === 'broadcast'
            ? 'Notifikasi broadcast berhasil di-up ke semua akun pelanggan!'
            : `Notifikasi berhasil dikirim ke ${sentCount} pelanggan terpilih!`,
      });
      setTitle('');
      setMessage('');
      setSelectedIds([]);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim notifikasi.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEnableDeviceNotif = async () => {
    const res = await requestBrowserNotificationPermission();
    setPerm(res);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Pusat Notifikasi &amp; Up Notifikasi Pelanggan
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Kirim pengumuman atau promo langsung ke akun pelanggan, dan pantau notifikasi pesanan
            masuk secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {perm !== 'granted' && perm !== 'unsupported' ? (
            <button
              type="button"
              onClick={handleEnableDeviceNotif}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3.5 py-2 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE6EC]"
            >
              <BellRing className="h-4 w-4" />
              <span>Aktifkan Pop-Up Notifikasi HP/Browser</span>
            </button>
          ) : perm === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <BellRing className="h-3.5 w-3.5" />
              <span>Notifikasi Perangkat Aktif</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#E6D8C5] pb-3">
        <button
          type="button"
          onClick={() => setSubTab('compose')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            subTab === 'compose'
              ? 'bg-[#3B2316] text-[#FBF6EE]'
              : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Up Notifikasi Pelanggan</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('inbox')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            subTab === 'inbox'
              ? 'bg-[#3B2316] text-[#FBF6EE]'
              : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          <span>Notifikasi Masuk Admin</span>
          {unreadInboxCount > 0 && (
            <span className="rounded bg-[#8E2E49] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
              {unreadInboxCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('sent')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            subTab === 'sent'
              ? 'bg-[#3B2316] text-[#FBF6EE]'
              : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
          }`}
        >
          <Megaphone className="h-3.5 w-3.5" />
          <span>Riwayat Terkirim ({sentHistory.length})</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {subTab === 'compose' && (
        <form
          onSubmit={handleSend}
          className="grid gap-6 lg:grid-cols-12 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm"
        >
          <div className="space-y-4 lg:col-span-6">
            <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
              Buat &amp; Up Notifikasi Baru
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[#3B2316]">Kategori</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['Promo', 'Info Toko', 'Hadiah', 'Pesanan'] as NotificationCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        category === cat
                          ? 'border-[#8E2E49] bg-[#FDF2F5] text-[#8E2E49]'
                          : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#5C4435] hover:bg-[#F6EFE4]'
                      }`}
                    >
                      {cat}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3B2316]">
                Judul Notifikasi *
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Flash Sale Cheesekuit Sore Ini!"
                className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3B2316]">
                Isi Pesan Notifikasi *
              </label>
              <textarea
                rows={4}
                required
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis informasi promo, menu baru, atau pesan personal untuk pelanggan..."
                className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3B2316]">Target Penerima</label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTargetMode('broadcast')}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-left ${
                    targetMode === 'broadcast'
                      ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                      : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316]'
                  }`}
                >
                  <Megaphone className="h-4 w-4 shrink-0" />
                  <span>Semua Pelanggan (Broadcast)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('selected')}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-left ${
                    targetMode === 'selected'
                      ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                      : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316]'
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Pilih Pelanggan ({selectedIds.length})</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || (targetMode === 'selected' && selectedIds.length === 0)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8E2E49] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#75233A] disabled:opacity-55"
            >
              <Send className="h-4 w-4" />
              <span>
                {busy
                  ? 'Mengirim Notifikasi...'
                  : targetMode === 'broadcast'
                    ? 'Up Notifikasi ke Semua Pelanggan'
                    : `Up Notifikasi ke ${selectedIds.length} Pelanggan`}
              </span>
            </button>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {targetMode === 'broadcast' ? (
              <div className="rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-5 text-xs text-[#6B2137] space-y-3">
                <p className="font-bold text-[#8E2E49] text-sm">Mode Broadcast Semua Pelanggan</p>
                <p className="leading-relaxed">
                  Notifikasi akan langsung muncul di ikon lonceng setiap akun member DoraCake
                  Customer Club secara real-time, serta muncul sebagai notifikasi HP/browser bagi
                  pelanggan yang sudah menginstal aplikasi dan mengaktifkan izin notifikasi.
                </p>
                <div className="rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E2E49]">
                    Pratinjau Tampilan di HP Pelanggan
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[#2C1810]">
                    {title.trim() || 'Judul Notifikasi Anda'}
                  </p>
                  <p className="mt-1 text-xs text-[#5C4435]">
                    {message.trim() || 'Isi pesan promo atau pengumuman dari toko akan tampil di sini.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#2C1810]">
                    Pilih Penerima ({selectedIds.length} dipilih)
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="font-semibold text-[#8E2E49] hover:underline"
                    >
                      Pilih Semua Tampak
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="font-semibold text-[#6E5849] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7362]" />
                    <input
                      type="search"
                      value={searchCust}
                      onChange={(e) => setSearchCust(e.target.value)}
                      placeholder="Cari nama, ID, HP..."
                      className="w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] py-2 pl-8 pr-3 text-xs text-[#2C1810]"
                    />
                  </div>
                  <select
                    value={tierFilter}
                    onChange={(e) =>
                      setTierFilter(e.target.value as 'ALL' | CustomerMemberTier)
                    }
                    className="rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs text-[#2C1810]"
                  >
                    <option value="ALL">Semua Tier Member</option>
                    <option value="Cakeers Member">Cakeers Member</option>
                    <option value="Cakeers Silver">Cakeers Silver</option>
                    <option value="Cakeers Gold">Cakeers Gold</option>
                    <option value="Cakeers Loyal">Cakeers Loyal</option>
                  </select>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {eligibleCustomers.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#6E5849]">
                      Tidak ada akun pelanggan aktif yang cocok.
                    </p>
                  ) : (
                    eligibleCustomers.map((cust) => {
                      const checked = selectedIds.includes(cust.id);
                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => toggleSelect(cust.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                            checked
                              ? 'border-[#8E2E49] bg-[#FDF2F5]'
                              : 'border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#F6EFE4]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {checked ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-[#8E2E49]" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-[#8C7362]" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#2C1810]">{cust.name}</p>
                              <p className="font-mono-tabular truncate text-[11px] text-[#6E5849]">
                                {cust.id} · @{cust.username} · {cust.tier}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {subTab === 'inbox' && (
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
              Notifikasi Masuk Admin ({adminInbox.length})
            </h3>
            {unreadInboxCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsReadFirebase(adminInbox)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs font-semibold text-[#3B2316] hover:bg-[#FDF2F5]"
              >
                <CheckCheck className="h-3.5 w-3.5 text-[#8E2E49]" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          {adminInbox.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#6E5849]">
              Belum ada notifikasi masuk untuk Admin. Pesanan baru dan penukaran hadiah akan muncul otomatis di sini.
            </p>
          ) : (
            <div className="space-y-2.5">
              {adminInbox.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) void markNotificationReadFirebase(notif.id, true);
                  }}
                  className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 cursor-pointer ${
                    notif.isRead
                      ? 'border-[#E6D8C5] bg-[#FBF6EE]/60'
                      : 'border-[#EAB8C6] bg-[#FDF2F5]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[#E6D8C5] bg-[#FFFDF9] px-2 py-0.5 text-[10px] font-bold text-[#8E2E49]">
                        {notif.category}
                      </span>
                      {!notif.isRead && (
                        <span className="rounded bg-[#8E2E49] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          BARU
                        </span>
                      )}
                      <span className="font-mono-tabular text-[11px] text-[#6E5849]">
                        {formatDateTimeId(notif.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-[#2C1810]">{notif.title}</p>
                    <p className="mt-0.5 text-xs text-[#5C4435]">{notif.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteNotificationFirebase(notif.id);
                    }}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                    title="Hapus notifikasi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'sent' && (
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm space-y-4">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Riwayat Notifikasi ke Pelanggan ({sentHistory.length})
          </h3>
          {sentHistory.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#6E5849]">
              Belum ada notifikasi yang dikirim ke pelanggan.
            </p>
          ) : (
            <div className="space-y-2.5">
              {sentHistory.map((notif) => (
                <div
                  key={notif.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-md border border-[#EAB8C6] bg-[#FDF2F5] px-2 py-0.5 font-bold text-[#8E2E49]">
                        {notif.category}
                      </span>
                      <span className="font-semibold text-[#3B2316]">
                        {notif.targetType === 'broadcast'
                          ? 'Broadcast Semua Pelanggan'
                          : `Penerima: ${notif.recipientCustomerId}`}
                      </span>
                      <span className="font-mono-tabular text-[#6E5849]">
                        · {formatDateTimeId(notif.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-[#2C1810]">{notif.title}</p>
                    <p className="mt-0.5 text-xs text-[#5C4435]">{notif.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteNotificationFirebase(notif.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                    title="Hapus notifikasi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
