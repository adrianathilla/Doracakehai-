import React, { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Eye,
  KeyRound,
  Mail,
  MessageCircle,
  Search,
  ShieldAlert,
  Stamp,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ClubConfig,
  CustomerAccount,
  CustomerAccountStatus,
  Order,
  PointHistoryItem,
  ReferralRecord,
  StampHistoryItem,
} from '../../types';
import {
  adminAdjustCustomerRewardFirebase,
  adminCreateCustomerFirebase,
  adminSendCustomerPasswordResetEmail,
  adminUpdateCustomerProfileFirebase,
  adminUpdateCustomerStatusFirebase,
} from '../../services/firebaseService';
import {
  buildNewCustomerCredentialsMessage,
  buildWhatsAppLink,
  formatDateTimeId,
  formatRupiah,
} from '../../utils/format';

interface AdminCustomersTabProps {
  customers: CustomerAccount[];
  orders: Order[];
  pointHistory: PointHistoryItem[];
  stampHistory: StampHistoryItem[];
  referrals: ReferralRecord[];
  clubConfig: ClubConfig;
  actorName: string;
  initialMode?: 'list' | 'create';
}

interface OneTimeCredentialNotice {
  customer: CustomerAccount;
  tempPasswordPlain: string;
}

export const AdminCustomersTab: React.FC<AdminCustomersTabProps> = ({
  customers,
  orders,
  pointHistory,
  stampHistory,
  referrals,
  clubConfig,
  actorName,
  initialMode = 'list',
}) => {
  const [subMode, setSubMode] = useState<'list' | 'create'>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [referredByCode, setReferredByCode] = useState('');
  const [birthday, setBirthday] = useState('');
  const [accountStatus, setAccountStatus] = useState<CustomerAccountStatus>('Aktif');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [oneTimeNotice, setOneTimeNotice] = useState<OneTimeCredentialNotice | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Detail Drawer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'orders' | 'points' | 'stamps' | 'referral' | 'manage'>('orders');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('0');
  const [adjustStamps, setAdjustStamps] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');
  const [busyDetail, setBusyDetail] = useState(false);
  const [detailFeedback, setDetailFeedback] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.referralCode.toLowerCase().includes(q)
      );
    });
  }, [customers, searchQuery, statusFilter]);

  const handleCopy = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const generateRandomTempPass = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = 'Cake';
    for (let i = 0; i < 4; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    setTempPassword(out);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await adminCreateCustomerFirebase({
        actorName,
        existingCustomers: customers,
        name,
        phone,
        username,
        tempPassword,
        status: accountStatus,
        email: email.trim() || undefined,
        referredByCode: referredByCode.trim() || undefined,
        birthday: birthday || undefined,
      });
      setOneTimeNotice({
        customer: created,
        tempPasswordPlain: tempPassword.trim(),
      });
      setName('');
      setPhone('');
      setUsername('');
      setEmail('');
      setTempPassword('');
      setReferredByCode('');
      setBirthday('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal membuat akun pelanggan.');
    } finally {
      setCreating(false);
    }
  };

  const openCustomerDetail = (c: CustomerAccount) => {
    setSelectedCustomerId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditEmail(c.email || '');
    setEditBirthday(c.birthday || '');
    setAdjustPoints('0');
    setAdjustStamps('0');
    setAdjustReason('');
    setDetailFeedback(null);
    setDetailError(null);
    setDetailTab('orders');
  };

  const handleUpdateBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setDetailFeedback(null);
    setDetailError(null);
    setBusyDetail(true);
    try {
      await adminUpdateCustomerProfileFirebase({
        actorName,
        customer: selectedCustomer,
        name: editName,
        phone: editPhone,
        email: editEmail.trim() || undefined,
        birthday: editBirthday || undefined,
      });
      setDetailFeedback('Data profil pelanggan berhasil diperbarui di Cloud Firestore.');
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Gagal memperbarui profil.');
    } finally {
      setBusyDetail(false);
    }
  };

  const handleChangeAccountStatus = async (nextStatus: CustomerAccountStatus) => {
    if (!selectedCustomer) return;
    setDetailFeedback(null);
    setDetailError(null);
    setBusyDetail(true);
    try {
      await adminUpdateCustomerStatusFirebase(actorName, selectedCustomer, nextStatus);
      setDetailFeedback(`Status akun berhasil diubah menjadi ${nextStatus}.`);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Gagal mengubah status akun.');
    } finally {
      setBusyDetail(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!selectedCustomer) return;
    setDetailFeedback(null);
    setDetailError(null);
    setBusyDetail(true);
    try {
      const targetEmail = await adminSendCustomerPasswordResetEmail(actorName, selectedCustomer);
      setDetailFeedback(
        `Tautan reset password Firebase berhasil dikirim ke email ${targetEmail}.`,
      );
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Gagal mengirim reset password.');
    } finally {
      setBusyDetail(false);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setDetailFeedback(null);
    setDetailError(null);
    const pts = Number(adjustPoints) || 0;
    const stp = Number(adjustStamps) || 0;
    if (pts === 0 && stp === 0) {
      setDetailError('Isi perubahan poin atau stempel terlebih dahulu (contoh: 50 atau -20).');
      return;
    }
    setBusyDetail(true);
    try {
      await adminAdjustCustomerRewardFirebase(actorName, selectedCustomer, {
        pointsDelta: pts,
        stampsDelta: stp,
        reason: adjustReason,
      });
      setAdjustPoints('0');
      setAdjustStamps('0');
      setAdjustReason('');
      setDetailFeedback('Koreksi poin/stempel berhasil disimpan ke Firestore & dicatat ke Audit Log.');
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Gagal menyimpan koreksi.');
    } finally {
      setBusyDetail(false);
    }
  };

  const hasRealEmail = Boolean(
    selectedCustomer &&
      (selectedCustomer.authEmail || selectedCustomer.email) &&
      !(selectedCustomer.authEmail || selectedCustomer.email || '').endsWith('@club.doracake.local'),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            {subMode === 'create' ? 'Tambah Pelanggan Customer Club' : 'Manajemen Pelanggan'}
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Pendaftaran akun member DoraCake dikelola eksklusif oleh Admin langsung ke Firebase
            Authentication &amp; Cloud Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubMode('list');
              setOneTimeNotice(null);
            }}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subMode === 'list'
                ? 'bg-[#3B2316] text-[#FBF6EE]'
                : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
            }`}
          >
            Daftar Pelanggan ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubMode('create');
              setOneTimeNotice(null);
              setCreateError(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subMode === 'create'
                ? 'bg-[#8E2E49] text-white'
                : 'border border-[#EAB8C6] bg-[#FDF2F5] text-[#8E2E49] hover:bg-[#FCE7EE]'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Tambah Pelanggan</span>
          </button>
        </div>
      </div>

      {/* One-time Temporary Credentials Confirmation Card */}
      {oneTimeNotice && (
        <div className="space-y-4 rounded-2xl border-2 border-[#8E2E49]/40 bg-[#FFFDF9] p-6 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-block rounded-md bg-[#FDF2F5] px-2.5 py-0.5 text-[11px] font-bold text-[#8E2E49] uppercase">
                Tampilan Sekali Saja
              </span>
              <h3 className="font-serif-display mt-1 text-xl font-bold text-[#2C1810]">
                Akun Pelanggan Berhasil Dibuat di Firebase!
              </h3>
              <p className="mt-1 text-xs text-[#5C4435]">
                Segera salin atau kirimkan melalui WhatsApp sekarang. Password dienkripsi oleh
                Firebase Auth dan tidak akan dapat dilihat kembali setelah ditutup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOneTimeNotice(null)}
              className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
              aria-label="Tutup konfirmasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[#6E5849]">ID Pelanggan</p>
              <p className="font-mono-tabular mt-0.5 text-sm font-bold text-[#2C1810]">
                {oneTimeNotice.customer.id}
              </p>
            </div>
            <div>
              <p className="text-[#6E5849]">Nama Lengkap</p>
              <p className="mt-0.5 text-sm font-bold text-[#2C1810]">{oneTimeNotice.customer.name}</p>
            </div>
            <div>
              <p className="text-[#6E5849]">Username</p>
              <p className="font-mono-tabular mt-0.5 text-sm font-bold text-[#8E2E49]">
                {oneTimeNotice.customer.username}
              </p>
            </div>
            <div>
              <p className="text-[#6E5849]">Password Sementara</p>
              <p className="font-mono-tabular mt-0.5 text-sm font-bold text-[#8E2E49]">
                {oneTimeNotice.tempPasswordPlain}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => handleCopy('username', oneTimeNotice.customer.username)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
            >
              {copiedField === 'username' ? (
                <Check className="h-3.5 w-3.5 text-emerald-700" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedField === 'username' ? 'Username Disalin' : 'Salin Username'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopy('password', oneTimeNotice.tempPasswordPlain)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
            >
              {copiedField === 'password' ? (
                <Check className="h-3.5 w-3.5 text-emerald-700" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>
                {copiedField === 'password'
                  ? 'Password Disalin'
                  : 'Salin Password Sementara'}
              </span>
            </button>

            <a
              href={buildWhatsAppLink(
                oneTimeNotice.customer.phone,
                buildNewCustomerCredentialsMessage(
                  oneTimeNotice.customer.name,
                  oneTimeNotice.customer.username,
                  oneTimeNotice.tempPasswordPlain,
                ),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Kirim melalui WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => {
                const target = oneTimeNotice.customer;
                setOneTimeNotice(null);
                setSubMode('list');
                openCustomerDetail(target);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Lihat Detail Akun</span>
            </button>
          </div>
        </div>
      )}

      {subMode === 'create' ? (
        <div className="space-y-5 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
          {createError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Nama Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ayu Lestari"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Nomor HP / WhatsApp (Unik) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 085712345678"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Username (Unik) *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="Contoh: ayu_cake"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Password Sementara *
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="font-mono-tabular min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                  <button
                    type="button"
                    onClick={generateRandomTempPass}
                    className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6] whitespace-nowrap"
                  >
                    Acak
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Email Pelanggan (Opsional — untuk link reset password otomatis)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pelanggan@gmail.com (opsional)"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Kode Referral Pengajak (Opsional)
                </label>
                <input
                  type="text"
                  value={referredByCode}
                  onChange={(e) => setReferredByCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: RANIACAKE25"
                  className="font-mono-tabular mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">Status Akun</label>
                <select
                  value={accountStatus}
                  onChange={(e) => setAccountStatus(e.target.value as CustomerAccountStatus)}
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2.5 text-sm text-[#2C1810]"
                >
                  <option value="Aktif">Aktif Langsung</option>
                  <option value="Dibekukan">Dibekukan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Tanggal Lahir (Opsional)
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2.5 text-sm text-[#2C1810]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E6D8C5] pt-4">
              <button
                type="button"
                onClick={() => setSubMode('list')}
                className="rounded-xl border border-[#E6D8C5] px-4 py-2.5 text-sm font-medium text-[#3B2316] hover:bg-[#F6EFE4]"
              >
                Kembali ke Daftar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-6 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4 text-[#E7CFA2]" />
                <span>{creating ? 'Mendaftarkan...' : 'Buat Akun Pelanggan'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Search & Filter */}
          <div className="grid gap-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ID (DC-000001), username, nama, nomor HP, atau kode referral..."
                className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2 pl-10 pr-3.5 text-sm text-[#2C1810]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm text-[#2C1810]"
            >
              <option value="ALL">Semua Status Akun</option>
              <option value="Aktif">Aktif</option>
              <option value="Dibekukan">Dibekukan</option>
              <option value="Dinonaktifkan">Dinonaktifkan</option>
            </select>
          </div>

          {/* Customers Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] text-xs font-semibold tracking-wider text-[#6E5849] uppercase">
                  <tr>
                    <th className="px-4 py-3.5">ID / Username</th>
                    <th className="px-4 py-3.5">Pelanggan</th>
                    <th className="px-4 py-3.5">Tier &amp; Status</th>
                    <th className="px-4 py-3.5 text-right">Poin</th>
                    <th className="px-4 py-3.5 text-right">Stempel</th>
                    <th className="px-4 py-3.5 text-right">Belanja</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E4D2]">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#6E5849]">
                        {customers.length === 0
                          ? 'Belum ada akun pelanggan terdaftar. Klik "Tambah Pelanggan" untuk mendaftarkan member pertama.'
                          : 'Tidak ada pelanggan yang cocok dengan pencarian.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FBF6EE]/60">
                        <td className="px-4 py-3.5">
                          <span className="font-mono-tabular font-bold text-[#2C1810]">
                            {c.id}
                          </span>
                          <div className="text-xs text-[#6E5849]">@{c.username}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#2C1810]">{c.name}</div>
                          <div className="text-xs text-[#6E5849]">{c.phone}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          <div className="font-semibold text-[#3B2316]">{c.tier}</div>
                          <span
                            className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                              c.status === 'Aktif'
                                ? 'bg-emerald-50 text-emerald-700'
                                : c.status === 'Dibekukan'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="font-mono-tabular px-4 py-3.5 text-right font-bold text-[#2C1810]">
                          {c.points.toLocaleString('id-ID')}
                        </td>
                        <td className="font-mono-tabular px-4 py-3.5 text-right font-bold text-[#8E2E49]">
                          {c.stamps} / {clubConfig.stampTarget}
                        </td>
                        <td className="font-mono-tabular px-4 py-3.5 text-right font-semibold text-[#2C1810]">
                          {formatRupiah(c.totalSpent)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openCustomerDetail(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4] whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-xs font-bold text-[#8E2E49]">
                    {selectedCustomer.id}
                  </span>
                  <span className="text-xs text-[#6E5849]">@{selectedCustomer.username}</span>
                  {selectedCustomer.mustChangePassword && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      Wajib Ganti Password
                    </span>
                  )}
                </div>
                <h3 className="font-serif-display text-xl font-bold text-[#2C1810]">
                  {selectedCustomer.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 gap-3 border-b border-[#E6D8C5] bg-[#FBF6EE] px-6 py-4 text-xs sm:grid-cols-4">
              <div>
                <p className="text-[#6E5849]">DoraCake Points</p>
                <p className="font-mono-tabular text-lg font-bold text-[#2C1810]">
                  {selectedCustomer.points.toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-[#6E5849]">Stempel Digital</p>
                <p className="font-mono-tabular text-lg font-bold text-[#8E2E49]">
                  {selectedCustomer.stamps} / {clubConfig.stampTarget}
                </p>
              </div>
              <div>
                <p className="text-[#6E5849]">Total Transaksi</p>
                <p className="font-mono-tabular text-lg font-bold text-[#2C1810]">
                  {selectedCustomer.totalTransactions}x
                </p>
              </div>
              <div>
                <p className="text-[#6E5849]">Kode Referral</p>
                <p className="font-mono-tabular text-base font-bold text-[#3B2316]">
                  {selectedCustomer.referralCode}
                </p>
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-[#E6D8C5] bg-[#FFFDF9] px-6 py-3">
              {(
                [
                  ['orders', 'Transaksi'],
                  ['points', 'Riwayat Poin'],
                  ['stamps', 'Riwayat Stempel'],
                  ['referral', 'Referral'],
                  ['manage', 'Kelola, Reset & Koreksi'],
                ] as const
              ).map(([tid, tlabel]) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => setDetailTab(tid)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    detailTab === tid
                      ? 'bg-[#3B2316] text-[#FBF6EE]'
                      : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:bg-[#F2E7D6]'
                  }`}
                >
                  {tlabel}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {detailFeedback && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  {detailFeedback}
                </div>
              )}
              {detailError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                  {detailError}
                </div>
              )}

              {detailTab === 'orders' && (
                <div className="space-y-2.5">
                  {orders.filter((o) => o.customerId === selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-[#6E5849]">Belum ada transaksi atas akun ini.</p>
                  ) : (
                    orders
                      .filter((o) => o.customerId === selectedCustomer.id)
                      .map((o) => (
                        <div
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-3 text-xs"
                        >
                          <div>
                            <p className="font-mono-tabular font-bold text-[#2C1810]">
                              {o.orderNumber}
                            </p>
                            <p className="text-[#6E5849]">
                              {o.orderDate} · {o.deliveryMethod} · {o.orderStatus} ({o.paymentStatus})
                            </p>
                          </div>
                          <span className="font-mono-tabular font-bold text-[#2C1810]">
                            {formatRupiah(o.total)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}

              {detailTab === 'points' && (
                <div className="space-y-2">
                  {pointHistory.filter((p) => p.customerId === selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-[#6E5849]">Belum ada mutasi poin.</p>
                  ) : (
                    pointHistory
                      .filter((p) => p.customerId === selectedCustomer.id)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs"
                        >
                          <div>
                            <p className="font-medium text-[#2C1810]">{p.description}</p>
                            <p className="text-[11px] text-[#6E5849]">
                              {formatDateTimeId(p.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`font-mono-tabular font-bold ${
                              p.type === 'Masuk' ? 'text-emerald-700' : 'text-[#8E2E49]'
                            }`}
                          >
                            {p.type === 'Masuk' ? '+' : '-'}
                            {p.points}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}

              {detailTab === 'stamps' && (
                <div className="space-y-2">
                  {stampHistory.filter((s) => s.customerId === selectedCustomer.id).length === 0 ? (
                    <p className="text-xs text-[#6E5849]">Belum ada aktivitas stempel.</p>
                  ) : (
                    stampHistory
                      .filter((s) => s.customerId === selectedCustomer.id)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs"
                        >
                          <div>
                            <p className="font-medium text-[#2C1810]">{s.description}</p>
                            <p className="text-[11px] text-[#6E5849]">
                              {formatDateTimeId(s.createdAt)}
                            </p>
                          </div>
                          <span className="font-mono-tabular font-bold text-[#8E2E49]">
                            {s.stampsDelta > 0 ? `+${s.stampsDelta}` : s.stampsDelta}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}

              {detailTab === 'referral' && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p>
                      Diundang oleh:{' '}
                      <strong>{selectedCustomer.referredByCode || 'Langsung / Tanpa Kode'}</strong>
                    </p>
                    <p className="mt-1">
                      Jumlah teman yang diajak:{' '}
                      <strong>
                        {
                          referrals.filter(
                            (r) =>
                              r.referrerCustomerId === selectedCustomer.id &&
                              r.registeredCustomerId,
                          ).length
                        }{' '}
                        orang
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {detailTab === 'manage' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Edit Profile & Status */}
                  <div className="space-y-4 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <h4 className="font-serif-display text-sm font-bold text-[#2C1810]">
                      Edit Data &amp; Status Akun
                    </h4>
                    <form onSubmit={handleUpdateBasicInfo} className="space-y-3 text-xs">
                      <div>
                        <label className="block font-semibold text-[#3B2316]">Nama</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2C1810]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#3B2316]">Nomor HP</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2C1810]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#3B2316]">Email (Opsional)</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="pelanggan@gmail.com"
                          className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2C1810]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#3B2316]">Tanggal Lahir</label>
                        <input
                          type="date"
                          value={editBirthday}
                          onChange={(e) => setEditBirthday(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2C1810]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busyDetail}
                        className="rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
                      >
                        Simpan Profil
                      </button>
                    </form>

                    <div className="border-t border-[#E6D8C5] pt-3">
                      <p className="text-xs font-semibold text-[#3B2316]">Status Keanggotaan</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(['Aktif', 'Dibekukan', 'Dinonaktifkan'] as CustomerAccountStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={busyDetail}
                              onClick={() => handleChangeAccountStatus(st)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                selectedCustomer.status === st
                                  ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                                  : 'border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316]'
                              }`}
                            >
                              {st}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reset Password & Koreksi Reward */}
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] p-4 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#8E2E49]">
                        <KeyRound className="h-4 w-4" />
                        <span>Reset Password Pelanggan</span>
                      </div>
                      {hasRealEmail ? (
                        <>
                          <p className="text-[11px] text-[#5C4435]">
                            Kirim tautan reset password aman langsung ke email terdaftar:{' '}
                            <strong>{selectedCustomer.authEmail || selectedCustomer.email}</strong>.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyDetail}
                              onClick={handleSendPasswordReset}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#8E2E49] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#77243C] disabled:opacity-60"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              <span>Kirim Link Reset Password ke Email</span>
                            </button>
                            <a
                              href={buildWhatsAppLink(
                                selectedCustomer.phone,
                                `Halo Kak ${selectedCustomer.name}, kami sudah mengirimkan tautan reset password untuk akun DoraCake Customer Club (@${selectedCustomer.username}) ke email ${selectedCustomer.authEmail || selectedCustomer.email}. Silakan cek kotak masuk/spam Anda.`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#8E2E49]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>Kabari via WA</span>
                            </a>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] leading-relaxed text-[#5C4435]">
                            Akun ini terdaftar dengan username internal tanpa email aktif (
                            <span className="font-mono-tabular">
                              {selectedCustomer.authEmail || `${selectedCustomer.username}@club.doracake.local`}
                            </span>
                            ). Untuk mengganti password akun ini secara langsung, ubah password
                            pengguna di{' '}
                            <strong>Firebase Console → Authentication → Users</strong>.
                          </p>
                          <a
                            href={buildWhatsAppLink(
                              selectedCustomer.phone,
                              `Halo Kak ${selectedCustomer.name}, admin sedang membantu pemulihan password akun DoraCake Customer Club (@${selectedCustomer.username}).`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#8E2E49]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Hubungi Pelanggan via WA</span>
                          </a>
                        </>
                      )}
                    </div>

                    <form
                      onSubmit={handleManualAdjustment}
                      className="space-y-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[#3B2316]">
                        <ShieldAlert className="h-4 w-4 text-[#9E7840]" />
                        <span>Koreksi Poin / Stempel (Wajib Alasan)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="flex items-center gap-1 font-semibold text-[#3B2316]">
                            <Coins className="h-3 w-3" /> Poin (+/-)
                          </label>
                          <input
                            type="number"
                            value={adjustPoints}
                            onChange={(e) => setAdjustPoints(e.target.value)}
                            className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1 font-semibold text-[#3B2316]">
                            <Stamp className="h-3 w-3" /> Stempel (+/-)
                          </label>
                          <input
                            type="number"
                            value={adjustStamps}
                            onChange={(e) => setAdjustStamps(e.target.value)}
                            className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#3B2316]">
                          Alasan Koreksi (Tercatat di Audit Log) *
                        </label>
                        <input
                          type="text"
                          required
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          placeholder="Contoh: Kompensasi keterlambatan kurir"
                          className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs text-[#2C1810]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busyDetail}
                        className="rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
                      >
                        Simpan Koreksi
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
