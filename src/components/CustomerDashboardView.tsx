import React, { useMemo, useState } from 'react';
import {
  Award,
  Bell,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Gift,
  Home,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Share2,
  ShoppingBag,
  Sparkles,
  Stamp,
  Ticket,
  User,
  Users,
} from 'lucide-react';
import {
  ClubConfig,
  CustomerAccount,
  Order,
  PointHistoryItem,
  PointRewardItem,
  Product,
  PromoCampaign,
  ReferralRecord,
  StampHistoryItem,
  StampRewardItem,
  StoreSettings,
  Voucher,
} from '../types';
import {
  buildWhatsAppLink,
  formatDateOnlyId,
  formatDateTimeId,
  formatRupiah,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAInstallButton';

export type CustomerNavTab =
  | 'beranda'
  | 'belanja'
  | 'pesanan'
  | 'points'
  | 'stamp'
  | 'voucher'
  | 'hadiah'
  | 'referral'
  | 'profil';

interface CustomerDashboardViewProps {
  activeTab: CustomerNavTab;
  onTabChange: (tab: CustomerNavTab) => void;
  customer: CustomerAccount;
  orders: Order[];
  pointHistory: PointHistoryItem[];
  stampHistory: StampHistoryItem[];
  vouchers: Voucher[];
  referrals: ReferralRecord[];
  pointRewards: PointRewardItem[];
  stampRewards: StampRewardItem[];
  campaigns: PromoCampaign[];
  clubConfig: ClubConfig;
  allProducts: Product[];
  settings: StoreSettings;
  logoUrl: string;
  cartCount: number;
  unreadNotifCount: number;
  onOpenNotifications: () => void;
  onOpenCart: () => void;
  onOpenTracking: () => void;
  onLogout: () => void;
  onRedeemPointReward: (rewardId: string) => Promise<{ ok: boolean; message: string }>;
  onRedeemStampReward: (rewardId: string) => Promise<{ ok: boolean; message: string }>;
  onChangePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onClaimGuestOrder: (
    orderNumber: string,
    verifiedPhone: string,
  ) => Promise<{ ok: boolean; message: string }>;
  onApplyVoucherToCheckout: (voucherCode: string) => void;
  renderBelanjaStorefront: () => React.ReactNode;
}

export const CustomerDashboardView: React.FC<CustomerDashboardViewProps> = ({
  activeTab,
  onTabChange,
  customer,
  orders,
  pointHistory,
  stampHistory,
  vouchers,
  referrals,
  pointRewards,
  stampRewards,
  campaigns,
  clubConfig,
  settings,
  logoUrl,
  cartCount,
  unreadNotifCount,
  onOpenNotifications,
  onOpenCart,
  onLogout,
  onRedeemPointReward,
  onRedeemStampReward,
  onChangePassword,
  onClaimGuestOrder,
  onApplyVoucherToCheckout,
  renderBelanjaStorefront,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Guest order claim state
  const [claimOrderNo, setClaimOrderNo] = useState('');
  const [claimPhone, setClaimPhone] = useState(customer.phone);

  // Change password state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const myOrders = useMemo<Order[]>(
    () => orders.filter((o) => o.customerId === customer.id),
    [orders, customer.id],
  );

  const myPointHistory = useMemo(
    () => pointHistory.filter((p) => p.customerId === customer.id),
    [pointHistory, customer.id],
  );

  const myStampHistory = useMemo(
    () => stampHistory.filter((s) => s.customerId === customer.id),
    [stampHistory, customer.id],
  );

  const myVouchers = useMemo<Voucher[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return vouchers.filter((v) => {
      if (!v.isActive) return false;
      if (v.validUntil && v.validUntil < today) return false;
      if (v.assignedCustomerId && v.assignedCustomerId !== customer.id) return false;
      return true;
    });
  }, [vouchers, customer.id]);

  const availableVouchersCount = useMemo(
    () =>
      myVouchers.filter((v) => {
        const usedByMe = v.usedByCustomerIds[customer.id] || 0;
        return v.usedCount < v.quota && usedByMe < v.perUserLimit;
      }).length,
    [myVouchers, customer.id],
  );

  const myReferrals = useMemo(
    () => referrals.filter((r) => r.referrerCustomerId === customer.id),
    [referrals, customer.id],
  );

  const referralStats = useMemo(() => {
    const clicks = myReferrals.reduce((s, r) => s + r.clicks, 0);
    const registered = myReferrals.filter((r) => Boolean(r.registeredCustomerId)).length;
    const buyers = myReferrals.filter((r) => Boolean(r.firstOrderNumber)).length;
    const successful = myReferrals.filter((r) => r.status === 'Berhasil').length;
    const totalPoints = myReferrals.reduce((s, r) => s + r.referrerRewardPoints, 0);
    return { clicks, registered, buyers, successful, totalPoints };
  }, [myReferrals]);

  const stampTarget = clubConfig.stampTarget || 10;
  const filledStamps = Math.min(stampTarget, customer.stamps);
  const canRedeemStamp = customer.stamps >= stampTarget;

  const navItems: { id: CustomerNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'beranda', label: 'Beranda', icon: <Home className="h-4 w-4" /> },
    { id: 'belanja', label: 'Belanja', icon: <ShoppingBag className="h-4 w-4" /> },
    { id: 'pesanan', label: 'Pesanan Saya', icon: <Package className="h-4 w-4" /> },
    { id: 'points', label: 'DoraCake Points', icon: <Coins className="h-4 w-4" /> },
    { id: 'stamp', label: 'Stamp Card', icon: <Stamp className="h-4 w-4" /> },
    { id: 'voucher', label: 'Voucher Saya', icon: <Ticket className="h-4 w-4" /> },
    { id: 'hadiah', label: 'Tukar Hadiah', icon: <Gift className="h-4 w-4" /> },
    { id: 'referral', label: 'Ajak Teman', icon: <Users className="h-4 w-4" /> },
    { id: 'profil', label: 'Profil', icon: <User className="h-4 w-4" /> },
  ];

  const handleCopy = async (text: string, labelKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    setCopiedCode(labelKey);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClaimGuestOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!claimOrderNo.trim()) {
      setFeedback({ type: 'error', text: 'Masukkan nomor pesanan yang ingin diklaim.' });
      return;
    }
    setBusyAction(true);
    try {
      const res = await onClaimGuestOrder(claimOrderNo, claimPhone);
      setFeedback({ type: res.ok ? 'success' : 'error', text: res.message });
      if (res.ok) {
        setClaimOrderNo('');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPass !== confirmPass) {
      setFeedback({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    setBusyAction(true);
    try {
      const res = await onChangePassword(oldPass, newPass);
      setFeedback({ type: res.ok ? 'success' : 'error', text: res.message });
      if (res.ok) {
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const referralShareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${encodeURIComponent(customer.referralCode)}`
      : `https://doracake.id/?ref=${customer.referralCode}`;

  const referralWaText = [
    `Hai! Yuk gabung DoraCake Customer Club 🍰`,
    `Gunakan kode referral aku: *${customer.referralCode}* saat daftar ke Admin DoraCake.`,
    `Setelah pesanan pertamamu selesai, kamu dapat Voucher Rp${clubConfig.referralNewCustomerVoucherValue.toLocaleString('id-ID')}!`,
    `Buka di sini: ${referralShareUrl}`,
  ].join('\n');

  // If user selects Belanja tab, render the integrated StorefrontView with a sleek sticky Member Bar!
  if (activeTab === 'belanja') {
    return (
      <div className="min-h-screen bg-[#F6EFE4]">
        <div className="border-b border-[#EAB8C6] bg-[#FFFDF9] px-4 py-2.5 no-print">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    item.id === 'belanja'
                      ? 'bg-[#3B2316] text-[#FBF6EE]'
                      : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:bg-[#FDF2F5]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative inline-flex items-center gap-1 rounded-lg border border-[#EAB8C6] bg-[#FDF2F5] px-2.5 py-1 font-semibold text-[#8E2E49] hover:bg-[#FCE6EC]"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Notif</span>
                {unreadNotifCount > 0 && (
                  <span className="rounded-full bg-[#8E2E49] px-1.5 py-0.2 text-[10px] font-bold text-white tabular-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              <span className="font-mono-tabular rounded-lg border border-[#EAB8C6] bg-[#FDF2F5] px-2.5 py-1 font-semibold text-[#8E2E49]">
                {customer.points} Poin · {customer.stamps}/{stampTarget} Stempel
              </span>
            </div>
          </div>
        </div>
        {renderBelanjaStorefront()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6EFE4] text-[#2C1810]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E6D8C5] bg-[#FFFDF9]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#E6D8C5] bg-[#FBF6EE]">
              <ResilientImage src={logoUrl} alt="DoraCake" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-serif-display truncate text-base font-bold text-[#2C1810]">
                DoraCake Customer Club
              </p>
              <p className="truncate text-[11px] text-[#6E5849]">
                {customer.id} · {customer.tier}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3 py-2 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE6EC] whitespace-nowrap"
              aria-label="Pusat Notifikasi"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Notifikasi</span>
              {unreadNotifCount > 0 && (
                <span className="rounded-full bg-[#8E2E49] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange('belanja')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3.5 py-2 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE6EC] whitespace-nowrap"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Katalog Belanja</span>
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-3.5 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] whitespace-nowrap"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[#F4B8C6]" />
              <span>Keranjang</span>
              <span className="rounded-md bg-[#F4B8C6] px-1.5 py-0.5 text-[11px] font-bold text-[#2C1810] tabular-nums">
                {cartCount}
              </span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs font-medium text-[#5C4435] hover:bg-[#FBF6EE] whitespace-nowrap"
              title="Keluar dari akun pelanggan"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Horizontal Scrollable 9-Menu Nav */}
        <div className="border-t border-[#F0E4D2] bg-[#FBF6EE] px-4 py-2 lg:hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    onTabChange(item.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#3B2316] text-[#FBF6EE]'
                      : 'bg-[#FFFDF9] text-[#3B2316] border border-[#E6D8C5]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-8">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-3 shadow-sm">
            <div className="mb-3 rounded-xl bg-[#FDF2F5] border border-[#F2CFD8] p-3.5">
              <p className="text-[11px] font-semibold text-[#8E2E49]">Hai, Cakeers!</p>
              <p className="mt-0.5 truncate font-serif-display text-base font-bold text-[#2C1810]">
                {customer.name}
              </p>
              <p className="font-mono-tabular mt-0.5 text-xs text-[#6B2137]">
                {customer.id} · {customer.tier}
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFeedback(null);
                      onTabChange(item.id);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#3B2316] font-semibold text-[#FBF6EE]'
                        : 'text-[#3B2316] hover:bg-[#FBF6EE]'
                    }`}
                  >
                    <span className={active ? 'text-[#F4B8C6]' : 'text-[#8E2E49]'}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="min-w-0 flex-1 space-y-6">
          {feedback && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Global 10-Stamp Celebration Banner when >= 10 */}
          {canRedeemStamp && (activeTab === 'beranda' || activeTab === 'stamp') && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8E2E49] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#8E2E49]">
                    SELAMAT! Kamu sudah mengumpulkan 10 stempel DoraCake!
                  </p>
                  <p className="mt-0.5 text-xs text-[#6B2137]">
                    Pilih hadiah gratis Cheesekuit, Gabin Ice, Diskon Rp10.000, atau produk pilihan sekarang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTabChange('hadiah')}
                className="rounded-xl bg-[#8E2E49] px-4 py-2 text-xs font-semibold text-white hover:bg-[#75233A] whitespace-nowrap"
              >
                Pilih Hadiah Stempel
              </button>
            </div>
          )}

          {/* TAB 1: BERANDA */}
          {activeTab === 'beranda' && (
            <div className="space-y-6">
              <PWAInstallButton variant="card" />
              {/* Member Welcome Card */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#8E2E49] uppercase">
                      Hai, Cakeers! Selamat Datang Kembali
                    </p>
                    <h1 className="font-serif-display mt-1 text-2xl font-bold text-[#2C1810] sm:text-3xl">
                      {customer.name}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#5C4435]">
                      <span className="font-mono-tabular font-semibold text-[#2C1810]">
                        ID: {customer.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#8E2E49]">{customer.tier}</span>
                      <span aria-hidden="true">·</span>
                      <span>Status Akun: {customer.status}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onTabChange('belanja')}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                    >
                      <ShoppingBag className="h-4 w-4 text-[#F4B8C6]" />
                      <span>Belanja Sekarang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTabChange('hadiah')}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-4 py-2.5 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE6EC]"
                    >
                      <Gift className="h-4 w-4" />
                      <span>Tukar Hadiah</span>
                    </button>
                  </div>
                </div>

                {/* 5 Summary Metrics */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] font-semibold text-[#6E5849] uppercase">Total Poin</p>
                    <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2C1810]">
                      {customer.points}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6E5849]">DoraCake Points</p>
                  </div>

                  <div className="rounded-xl border border-[#F2CFD8] bg-[#FDF2F5] p-4">
                    <p className="text-[11px] font-semibold text-[#8E2E49] uppercase">Jumlah Stempel</p>
                    <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2C1810]">
                      {customer.stamps} / {stampTarget}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B2137]">
                      {canRedeemStamp ? 'Siap ditukar!' : `${stampTarget - filledStamps} lagi dapat hadiah`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] font-semibold text-[#6E5849] uppercase">Voucher Tersedia</p>
                    <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2C1810]">
                      {availableVouchersCount}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6E5849]">Siap dipakai checkout</p>
                  </div>

                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] font-semibold text-[#6E5849] uppercase">Total Transaksi</p>
                    <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2C1810]">
                      {customer.totalTransactions}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6E5849]">Pesanan tuntas</p>
                  </div>

                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] font-semibold text-[#6E5849] uppercase">Total Belanja</p>
                    <p className="font-mono-tabular mt-1.5 text-xl font-bold text-[#2C1810]">
                      {formatRupiah(customer.totalSpent)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6E5849]">Akumulasi belanja</p>
                  </div>
                </div>
              </div>

              {/* Active Campaigns */}
              {campaigns.some((c) => c.isActive) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {campaigns
                    .filter((c) => c.isActive)
                    .map((cmp) => (
                      <div
                        key={cmp.id}
                        className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 shadow-sm"
                      >
                        <p className="text-[11px] font-semibold tracking-wider text-[#8E2E49] uppercase">
                          {cmp.badgeText} · {cmp.targetAudience}
                        </p>
                        <h3 className="font-serif-display mt-1 text-lg font-bold text-[#2C1810]">
                          {cmp.title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#5C4435]">
                          {cmp.subtitle}
                        </p>
                        {cmp.promoCode && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="font-mono-tabular rounded-lg border border-[#EAB8C6] bg-[#FDF2F5] px-2.5 py-1 text-xs font-bold text-[#8E2E49]">
                              {cmp.promoCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => onApplyVoucherToCheckout(cmp.promoCode!)}
                              className="text-xs font-semibold text-[#3B2316] underline hover:text-[#8E2E49]"
                            >
                              Pakai di Belanja
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Recent Orders Preview */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Aktivitas Pesanan Terbaru
                  </h2>
                  <button
                    type="button"
                    onClick={() => onTabChange('pesanan')}
                    className="text-xs font-semibold text-[#8E2E49] hover:underline"
                  >
                    Lihat Semua
                  </button>
                </div>

                {myOrders.length === 0 ? (
                  <p className="mt-4 text-xs text-[#6E5849]">
                    Belum ada transaksi pada akun ini. Yuk mulai belanja!
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[#F0E4D2]">
                    {myOrders.slice(0, 3).map((ord) => {
                      const badge = getOrderStatusBadge(ord.orderStatus);
                      return (
                        <div
                          key={ord.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                        >
                          <div>
                            <p className="font-mono-tabular font-bold text-[#2C1810]">
                              {ord.orderNumber}
                            </p>
                            <p className="mt-0.5 text-[#6E5849]">
                              {formatDateOnlyId(ord.orderDate)} · {ord.items.length} item ·{' '}
                              {ord.deliveryMethod}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular font-bold text-[#2C1810]">
                              {formatRupiah(ord.total)}
                            </span>
                            <span
                              className={`rounded-lg border px-2.5 py-0.5 font-semibold ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {ord.orderStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PESANAN SAYA + KLAIM PESANAN TAMU */}
          {activeTab === 'pesanan' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <h1 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                  Pesanan Saya
                </h1>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Menampilkan seluruh riwayat transaksi dan status pesanan milik akun {customer.id}.
                </p>

                {myOrders.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-8 text-center">
                    <p className="text-sm font-semibold text-[#2C1810]">Belum Ada Pesanan</p>
                    <p className="mt-1 text-xs text-[#6E5849]">
                      Mulai pesan cake homemade favoritmu atau hubungkan pesanan tamu di bawah.
                    </p>
                    <button
                      type="button"
                      onClick={() => onTabChange('belanja')}
                      className="mt-4 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE]"
                    >
                      Belanja Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {myOrders.map((ord) => {
                      const ost = getOrderStatusBadge(ord.orderStatus);
                      const pst = getPaymentStatusBadge(ord.paymentStatus);
                      return (
                        <div
                          key={ord.id}
                          className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6D8C5] pb-3">
                            <div>
                              <p className="font-mono-tabular text-sm font-bold text-[#2C1810]">
                                {ord.orderNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-[#6E5849]">
                                {formatDateOnlyId(ord.orderDate)} · {ord.pickupDeliveryTime} WIB ·{' '}
                                {ord.deliveryMethod}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-lg border px-2.5 py-0.5 text-xs font-medium ${pst.bg} ${pst.text} ${pst.border}`}
                              >
                                {ord.paymentStatus}
                              </span>
                              <span
                                className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${ost.bg} ${ost.text} ${ost.border}`}
                              >
                                {ord.orderStatus}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-[#2C1810]">
                                  {it.productName} × {it.quantity}
                                </span>
                                <span className="font-mono-tabular font-semibold text-[#2C1810]">
                                  {formatRupiah(it.subtotal)}
                                </span>
                              </div>
                            ))}
                            {ord.voucherDiscount ? (
                              <div className="flex justify-between text-[#8E2E49]">
                                <span>Voucher ({ord.voucherCode})</span>
                                <span className="font-mono-tabular">
                                  -{formatRupiah(ord.voucherDiscount)}
                                </span>
                              </div>
                            ) : null}
                            <div className="flex justify-between border-t border-[#E6D8C5] pt-2 text-sm font-bold text-[#2C1810]">
                              <span>Total</span>
                              <span className="font-mono-tabular">{formatRupiah(ord.total)}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C4435]">
                            <span>
                              {ord.rewardsGranted
                                ? 'Poin & stempel sudah diberikan untuk pesanan ini.'
                                : ord.orderStatus === 'Dibatalkan'
                                  ? 'Pesanan dibatalkan (tidak mendapat poin/stempel).'
                                  : 'Poin & stempel diberikan otomatis setelah status Selesai & Lunas.'}
                            </span>
                            <a
                              href={buildWhatsAppLink(
                                settings.whatsappNumber,
                                `Halo Admin DoraCake, saya ${customer.name} (${customer.id}) ingin menanyakan pesanan ${ord.orderNumber}.`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#3B2316] hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>Tanya Admin</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Claim Guest Order */}
              <div className="rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-6 shadow-sm">
                <div className="flex items-center gap-2 text-[#8E2E49]">
                  <Link2 className="h-5 w-5" />
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Hubungkan Pesanan Mode Tamu
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#6B2137]">
                  Pernah memesan sebagai Tamu sebelum login? Masukkan nomor pesanan tamu dan nomor HP pemesan yang sama dengan akun{' '}
                  <span className="font-mono-tabular font-semibold">{customer.id}</span> ({customer.phone}) untuk menghubungkannya ke akun Anda.
                </p>

                <form onSubmit={handleClaimGuestOrderSubmit} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={claimOrderNo}
                    onChange={(e) => setClaimOrderNo(e.target.value.toUpperCase())}
                    placeholder="No. Pesanan Tamu (mis. DC-...)"
                    className="font-mono-tabular rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-3.5 py-2 text-xs text-[#2C1810]"
                  />
                  <input
                    type="tel"
                    required
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    placeholder="Nomor HP Pemesan"
                    className="rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-3.5 py-2 text-xs text-[#2C1810]"
                  />
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="rounded-xl bg-[#8E2E49] px-4 py-2 text-xs font-semibold text-white hover:bg-[#75233A] disabled:opacity-60"
                  >
                    {busyAction ? 'Memproses...' : 'Hubungkan ke Akun'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: DORACAKE POINTS */}
          {activeTab === 'points' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#8E2E49] uppercase">
                      Saldo DoraCake Points
                    </p>
                    <p className="font-mono-tabular mt-1 text-4xl font-bold text-[#2C1810]">
                      {customer.points} <span className="text-base font-normal">Poin</span>
                    </p>
                    <p className="mt-1.5 text-xs text-[#5C4435]">
                      Aturan: Setiap belanja produk Rp{clubConfig.rupiahPerPoint.toLocaleString('id-ID')} = 1 poin (ongkos kirim tidak dihitung). Poin masuk setelah pesanan Selesai &amp; pembayaran Lunas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTabChange('hadiah')}
                    className="rounded-xl bg-[#3B2316] px-5 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                  >
                    Tukar Poin Jadi Hadiah
                  </button>
                </div>
              </div>

              {/* Point History */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                  Riwayat Poin Masuk &amp; Keluar
                </h2>
                {myPointHistory.length === 0 ? (
                  <p className="mt-4 text-xs text-[#6E5849]">Belum ada riwayat poin.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] font-semibold text-[#6E5849] uppercase">
                        <tr>
                          <th className="px-4 py-3">Tanggal</th>
                          <th className="px-4 py-3">Jenis</th>
                          <th className="px-4 py-3">ID Pesanan</th>
                          <th className="px-4 py-3">Keterangan</th>
                          <th className="px-4 py-3 text-right">Poin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E4D2]">
                        {myPointHistory.map((ph) => (
                          <tr key={ph.id}>
                            <td className="font-mono-tabular px-4 py-3 text-[#5C4435] whitespace-nowrap">
                              {formatDateTimeId(ph.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-md border px-2 py-0.5 font-semibold ${
                                  ph.type === 'Masuk'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800'
                                }`}
                              >
                                {ph.type}
                              </span>
                            </td>
                            <td className="font-mono-tabular px-4 py-3 text-[#2C1810]">
                              {ph.orderNumber || '-'}
                            </td>
                            <td className="px-4 py-3 text-[#2C1810]">{ph.description}</td>
                            <td
                              className={`font-mono-tabular px-4 py-3 text-right font-bold ${
                                ph.type === 'Masuk' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {ph.type === 'Masuk' ? '+' : '-'}
                              {ph.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DIGITAL STAMP CARD */}
          {activeTab === 'stamp' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#8E2E49] uppercase">
                      Digital Stamp Card
                    </p>
                    <h1 className="font-serif-display mt-1 text-2xl font-bold text-[#2C1810]">
                      Kartu Stempel Cakeers ({filledStamps} / {stampTarget})
                    </h1>
                    <p className="mt-1 text-xs text-[#5C4435]">
                      Subtotal produk minimal {formatRupiah(clubConfig.stampMinSubtotal)} pada produk bertanda stempel mendapatkan 1 stempel per transaksi selesai (maks. 1 stempel/transaksi).
                    </p>
                  </div>
                </div>

                {/* 10 Stamp Slots Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {Array.from({ length: stampTarget }).map((_, idx) => {
                    const filled = idx < filledStamps;
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all ${
                          filled
                            ? 'border-[#E592A8] bg-[#FDF2F5] text-[#8E2E49] shadow-sm'
                            : 'border-dashed border-[#D8C6B0] bg-[#FBF6EE] text-[#A28B79]'
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full ${
                            filled ? 'bg-[#8E2E49] text-white' : 'bg-[#EFE5D6] text-[#9E8876]'
                          }`}
                        >
                          {filled ? <Award className="h-5 w-5" /> : <Stamp className="h-5 w-5" />}
                        </div>
                        <span className="font-mono-tabular mt-2 text-xs font-bold">
                          Stempel #{idx + 1}
                        </span>
                        <span className="text-[11px]">
                          {filled ? 'Terisi' : 'Kosong'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stamp Reward Options */}
                <div className="mt-8 border-t border-[#E6D8C5] pt-6">
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Pilihan Hadiah {stampTarget} Stempel
                  </h2>
                  {stampRewards.filter((r) => r.isActive).length === 0 ? (
                    <p className="mt-3 text-xs text-[#6E5849]">
                      Hadiah stempel sedang disiapkan oleh Admin DoraCake.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {stampRewards
                        .filter((r) => r.isActive)
                        .map((reward) => (
                          <div
                            key={reward.id}
                            className="flex flex-col justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4"
                          >
                            <div>
                              <h3 className="font-serif-display text-base font-bold text-[#2C1810]">
                                {reward.title}
                              </h3>
                              <p className="mt-1 text-xs text-[#5C4435]">{reward.description}</p>
                            </div>
                            <button
                              type="button"
                              disabled={!canRedeemStamp || busyAction}
                              onClick={async () => {
                                setBusyAction(true);
                                try {
                                  const res = await onRedeemStampReward(reward.id);
                                  setFeedback({
                                    type: res.ok ? 'success' : 'error',
                                    text: res.message,
                                  });
                                } finally {
                                  setBusyAction(false);
                                }
                              }}
                              className="mt-4 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:cursor-not-allowed disabled:bg-[#C6B6A6]"
                            >
                              {canRedeemStamp
                                ? `Tukar ${stampTarget} Stempel Sekarang`
                                : `Butuh ${stampTarget - filledStamps} Stempel Lagi`}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stamp History */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                  Riwayat Stempel &amp; Penukaran Hadiah
                </h2>
                {myStampHistory.length === 0 ? (
                  <p className="mt-4 text-xs text-[#6E5849]">Belum ada riwayat stempel.</p>
                ) : (
                  <div className="mt-4 divide-y divide-[#F0E4D2]">
                    {myStampHistory.map((sh) => (
                      <div
                        key={sh.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#2C1810]">{sh.description}</p>
                          <p className="mt-0.5 text-[#6E5849]">
                            {formatDateTimeId(sh.createdAt)}
                            {sh.orderNumber ? ` · ${sh.orderNumber}` : ''}
                          </p>
                        </div>
                        <span
                          className={`font-mono-tabular font-bold ${
                            sh.stampsDelta >= 0 ? 'text-emerald-700' : 'text-[#8E2E49]'
                          }`}
                        >
                          {sh.stampsDelta >= 0 ? `+${sh.stampsDelta}` : sh.stampsDelta} Stempel
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: VOUCHER SAYA */}
          {activeTab === 'voucher' && (
            <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
              <h1 className="font-serif-display text-2xl font-bold text-[#2C1810]">Voucher Saya</h1>
              <p className="mt-1 text-xs text-[#5C4435]">
                Salin kode voucher atau klik pakai langsung saat checkout pesanan Anda.
              </p>

              {myVouchers.length === 0 ? (
                <p className="mt-6 text-sm text-[#6E5849]">Belum ada voucher yang tersedia saat ini.</p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {myVouchers.map((vc) => {
                    const usedByMe = vc.usedByCustomerIds[customer.id] || 0;
                    const exhausted = vc.usedCount >= vc.quota || usedByMe >= vc.perUserLimit;
                    const discountText =
                      vc.discountType === 'percentage'
                        ? `Diskon ${vc.discountValue}%`
                        : `Potongan ${formatRupiah(vc.discountValue)}`;

                    return (
                      <div
                        key={vc.id}
                        className={`flex flex-col justify-between rounded-2xl border p-5 ${
                          exhausted
                            ? 'border-[#E6D8C5] bg-[#F6EFE4]/70 opacity-70'
                            : 'border-[#EAB8C6] bg-[#FDF2F5]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-[#8E2E49] uppercase">{vc.type}</span>
                            <span className="font-mono-tabular text-[#6E5849]">
                              Berlaku s/d {vc.validUntil}
                            </span>
                          </div>
                          <h3 className="font-serif-display mt-1.5 text-lg font-bold text-[#2C1810]">
                            {vc.name}
                          </h3>
                          <p className="mt-1 text-sm font-bold text-[#3B2316]">{discountText}</p>
                          <p className="mt-1 text-xs text-[#5C4435]">
                            Min. belanja {formatRupiah(vc.minPurchase)}
                            {vc.applicableProductCodes.length > 0
                              ? ` · Khusus produk: ${vc.applicableProductCodes.join(', ')}`
                              : ' · Semua menu'}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EAB8C6]/60 pt-3">
                          <span className="font-mono-tabular rounded-lg border border-[#EAB8C6] bg-[#FFFDF9] px-3 py-1 text-xs font-bold text-[#2C1810]">
                            {vc.code}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(vc.code, vc.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1.5 text-xs font-semibold text-[#3B2316]"
                            >
                              {copiedCode === vc.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>{copiedCode === vc.id ? 'Disalin' : 'Salin'}</span>
                            </button>
                            {!exhausted && (
                              <button
                                type="button"
                                onClick={() => onApplyVoucherToCheckout(vc.code)}
                                className="rounded-lg bg-[#3B2316] px-3 py-1.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                              >
                                Pakai
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: TUKAR HADIAH */}
          {activeTab === 'hadiah' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <h1 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                  Tukar Hadiah DoraCake
                </h1>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Tukarkan DoraCake Points atau Stempel penuh Anda menjadi voucher hadiah yang langsung aktif di menu Voucher Saya.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs">
                    Saldo Poin Anda:{' '}
                    <strong className="font-mono-tabular text-sm text-[#2C1810]">
                      {customer.points} Poin
                    </strong>
                  </div>
                  <div className="rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-4 py-2.5 text-xs">
                    Saldo Stempel Anda:{' '}
                    <strong className="font-mono-tabular text-sm text-[#8E2E49]">
                      {customer.stamps} / {stampTarget} Stempel
                    </strong>
                  </div>
                </div>

                {/* Point Rewards */}
                <h2 className="font-serif-display mt-7 text-lg font-bold text-[#2C1810]">
                  Penukaran DoraCake Points
                </h2>
                {pointRewards.filter((r) => r.isActive).length === 0 ? (
                  <p className="mt-3 text-xs text-[#6E5849]">
                    Katalog hadiah poin belum tersedia saat ini.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {pointRewards
                      .filter((r) => r.isActive)
                      .map((rw) => {
                        const enough = customer.points >= rw.pointsCost;
                        return (
                          <div
                            key={rw.id}
                            className="flex flex-col justify-between rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-5"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono-tabular text-xs font-bold text-[#8E2E49]">
                                  {rw.pointsCost} Poin
                                </span>
                              </div>
                              <h3 className="font-serif-display mt-1 text-lg font-bold text-[#2C1810]">
                                {rw.title}
                              </h3>
                              <p className="mt-1 text-xs text-[#5C4435]">{rw.description}</p>
                            </div>
                            <button
                              type="button"
                              disabled={!enough || busyAction}
                              onClick={async () => {
                                setBusyAction(true);
                                try {
                                  const res = await onRedeemPointReward(rw.id);
                                  setFeedback({
                                    type: res.ok ? 'success' : 'error',
                                    text: res.message,
                                  });
                                } finally {
                                  setBusyAction(false);
                                }
                              }}
                              className="mt-4 rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:cursor-not-allowed disabled:bg-[#C6B6A6]"
                            >
                              {enough
                                ? `Tukar ${rw.pointsCost} Poin`
                                : `Kurang ${rw.pointsCost - customer.points} Poin`}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Stamp Rewards */}
                <h2 className="font-serif-display mt-8 text-lg font-bold text-[#2C1810]">
                  Penukaran {stampTarget} Stempel DoraCake
                </h2>
                {stampRewards.filter((r) => r.isActive).length === 0 ? (
                  <p className="mt-3 text-xs text-[#6E5849]">
                    Katalog hadiah stempel belum tersedia saat ini.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {stampRewards
                      .filter((r) => r.isActive)
                      .map((rw) => (
                        <div
                          key={rw.id}
                          className="flex flex-col justify-between rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-5"
                        >
                          <div>
                            <span className="font-mono-tabular text-xs font-bold text-[#8E2E49]">
                              {rw.stampsRequired} Stempel
                            </span>
                            <h3 className="font-serif-display mt-1 text-lg font-bold text-[#2C1810]">
                              {rw.title}
                            </h3>
                            <p className="mt-1 text-xs text-[#6B2137]">{rw.description}</p>
                          </div>
                          <button
                            type="button"
                            disabled={!canRedeemStamp || busyAction}
                            onClick={async () => {
                              setBusyAction(true);
                              try {
                                const res = await onRedeemStampReward(rw.id);
                                setFeedback({
                                  type: res.ok ? 'success' : 'error',
                                  text: res.message,
                                });
                              } finally {
                                setBusyAction(false);
                              }
                            }}
                            className="mt-4 rounded-xl bg-[#8E2E49] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#75233A] disabled:cursor-not-allowed disabled:bg-[#C6B6A6]"
                          >
                            {canRedeemStamp
                              ? `Klaim Hadiah ${stampTarget} Stempel`
                              : `Stempel ${customer.stamps}/${stampTarget}`}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: AJAK TEMAN (REFERRAL) */}
          {activeTab === 'referral' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
                <p className="text-xs font-semibold tracking-wider text-[#8E2E49] uppercase">
                  DoraCake Referral Program
                </p>
                <h1 className="font-serif-display mt-1 text-2xl font-bold text-[#2C1810]">
                  Ajak Teman &amp; Dapatkan Hadiah
                </h1>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5C4435]">
                  Bagikan kode referral unikmu. Pengajak mendapatkan{' '}
                  <strong>+{clubConfig.referralReferrerPoints} DoraCake Points</strong> dan teman baru mendapatkan{' '}
                  <strong>Voucher {formatRupiah(clubConfig.referralNewCustomerVoucherValue)}</strong> setelah pembelian pertama mereka selesai &amp; lunas.
                </p>

                <div className="mt-5 rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-5">
                  <p className="text-xs font-semibold text-[#8E2E49]">Kode Referral Unik Anda</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="font-mono-tabular rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-4 py-2 text-xl font-bold tracking-wider text-[#2C1810]">
                      {customer.referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(customer.referralCode, 'ref_code')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#3B2316]"
                    >
                      {copiedCode === 'ref_code' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedCode === 'ref_code' ? 'Kode Disalin' : 'Salin Kode'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(referralShareUrl, 'ref_link')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#3B2316]"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{copiedCode === 'ref_link' ? 'Tautan Disalin' : 'Salin Tautan'}</span>
                    </button>
                    <a
                      href={buildWhatsAppLink('', referralWaText).replace(
                        'https://wa.me/62?',
                        'https://wa.me/?',
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#F4B8C6]" />
                      <span>Bagikan via WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Referral Statistics */}
                <div className="mt-6 grid gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] text-[#6E5849]">Jumlah Klik</p>
                    <p className="font-mono-tabular mt-1 text-2xl font-bold text-[#2C1810]">
                      {referralStats.clicks}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] text-[#6E5849]">Jumlah Pendaftar</p>
                    <p className="font-mono-tabular mt-1 text-2xl font-bold text-[#2C1810]">
                      {referralStats.registered}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] text-[#6E5849]">Jumlah Pembeli</p>
                    <p className="font-mono-tabular mt-1 text-2xl font-bold text-[#2C1810]">
                      {referralStats.buyers}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] text-[#6E5849]">Referral Berhasil</p>
                    <p className="font-mono-tabular mt-1 text-2xl font-bold text-emerald-700">
                      {referralStats.successful}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                    <p className="text-[11px] text-[#6E5849]">Total Hadiah</p>
                    <p className="font-mono-tabular mt-1 text-2xl font-bold text-[#8E2E49]">
                      {referralStats.totalPoints} Poin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PROFIL & HAK AKSES + UBAH PASSWORD */}
          {activeTab === 'profil' && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Read-Only Protected Customer Profile */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm lg:col-span-7">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                    Profil Anggota
                  </h1>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6E5849]">
                    <Lock className="h-3.5 w-3.5 text-[#8E2E49]" />
                    <span>Data Terkunci oleh Sistem</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Untuk menjaga keamanan hak akses dan keakuratan poin, data identitas dan saldo reward hanya dapat diperbarui oleh Admin DoraCake.
                </p>

                <div className="mt-5 grid gap-3.5 sm:grid-cols-2 text-xs">
                  {[
                    { label: 'ID Pelanggan', value: customer.id, mono: true },
                    { label: 'Username', value: `@${customer.username}`, mono: true },
                    { label: 'Nama Lengkap', value: customer.name },
                    { label: 'Nomor HP Utama', value: customer.phone, mono: true },
                    { label: 'Status Member', value: customer.tier },
                    { label: 'Status Akun', value: customer.status },
                    { label: 'Saldo Poin', value: `${customer.points} Poin`, mono: true },
                    { label: 'Jumlah Stempel', value: `${customer.stamps} / ${stampTarget}`, mono: true },
                    { label: 'Kode Referral', value: customer.referralCode, mono: true },
                    { label: 'Diajak Oleh', value: customer.referredByCode || '-', mono: true },
                  ].map((field) => (
                    <div
                      key={field.label}
                      className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5"
                    >
                      <p className="text-[11px] text-[#6E5849]">{field.label}</p>
                      <p
                        className={`mt-0.5 font-semibold text-[#2C1810] ${
                          field.mono ? 'font-mono-tabular' : ''
                        }`}
                      >
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <PWAInstallButton variant="card" />
                </div>
              </div>

              {/* Change Password Form */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm lg:col-span-5">
                <div className="flex items-center gap-2 text-[#8E2E49]">
                  <KeyRound className="h-5 w-5" />
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Ubah Password
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Perbarui password Anda secara berkala demi keamanan akun Customer Club.
                </p>

                <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Password Lama *
                    </label>
                    <input
                      type="password"
                      required
                      value={oldPass}
                      onChange={(e) => setOldPass(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Password Baru (Min. 6 karakter) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Konfirmasi Password Baru *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B2316] px-4 py-3 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#F4B8C6]" />
                    <span>Simpan Password Baru</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
