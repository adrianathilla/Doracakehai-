import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  ChefHat,
  ClipboardList,
  Clock,
  Coins,
  Database,
  FolderTree,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Palette,
  Plus,
  QrCode,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Stamp,
  Store,
  TicketPercent,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AdminUserPublic,
  AppNotification,
  FirebaseRuntimeStatus,
} from '../../types';
import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_WEBSITE_CONTENT,
} from '../../constants/defaultWebsiteContent';
import { DEFAULT_CLUB_CONFIG } from '../../services/clubStore';
import {
  AdminFullSyncState,
  markAllNotificationsReadFirebase,
  markNotificationReadFirebase,
  signOutAll,
  subscribeAdminData,
} from '../../services/firebaseService';
import { formatRupiah, getOrderStatusBadge } from '../../utils/format';
import { showDeviceNotification } from '../../utils/webNotifications';
import { NotificationBellModal } from '../NotificationBellModal';
import { ResilientImage } from '../ResilientImage';
import { AdminOrdersTab } from './AdminOrdersTab';
import { AdminProductsTab } from './AdminProductsTab';
import { AdminCategoriesTab } from './AdminCategoriesTab';
import { AdminWebsiteEditorTab } from './AdminWebsiteEditorTab';
import { AdminStoreSettingsTab } from './AdminStoreSettingsTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminDatabaseTab } from './AdminDatabaseTab';
import { AdminCustomersTab } from './AdminCustomersTab';
import { AdminClubRewardsTab } from './AdminClubRewardsTab';
import { AdminMarketingAndReportsTab } from './AdminMarketingAndReportsTab';
import { AdminSecurityAndAuditTab } from './AdminSecurityAndAuditTab';
import { AdminNotificationsTab } from './AdminNotificationsTab';

export type AdminNavTab =
  | 'overview'
  | 'products'
  | 'orders'
  | 'notifications'
  | 'customers'
  | 'add_customer'
  | 'points'
  | 'stamps'
  | 'referral'
  | 'product_codes'
  | 'vouchers'
  | 'campaigns'
  | 'reports'
  | 'antifraud'
  | 'audit'
  | 'settings';

type SettingsSubTab =
  | 'categories'
  | 'store_settings'
  | 'editor'
  | 'admin_users'
  | 'database';

interface AdminDashboardProps {
  currentAdmin: AdminUserPublic;
  firebaseStatus: FirebaseRuntimeStatus;
  onRefreshFirebaseStatus: () => void;
  onExitToStorefront: () => void;
  onAdminUpdated: (admin: AdminUserPublic) => void;
  onLoggedOut: () => Promise<void> | void;
}

const INITIAL_ADMIN_STATE: AdminFullSyncState = {
  categories: [],
  products: [],
  orders: [],
  customers: [],
  pointRewards: [],
  stampRewards: [],
  pointHistory: [],
  stampHistory: [],
  vouchers: [],
  referrals: [],
  referralClicks: [],
  productShares: [],
  productShareClicks: [],
  campaigns: [],
  fraudAlerts: [],
  auditLogs: [],
  activityLogs: [],
  settings: DEFAULT_STORE_SETTINGS,
  websiteDraft: DEFAULT_WEBSITE_CONTENT,
  websitePublished: DEFAULT_WEBSITE_CONTENT,
  websiteHistory: [],
  clubConfig: DEFAULT_CLUB_CONFIG,
  adminUsers: [],
  adminInvites: [],
  notifications: [],
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentAdmin,
  firebaseStatus,
  onRefreshFirebaseStatus,
  onExitToStorefront,
  onAdminUpdated,
  onLoggedOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminNavTab>('overview');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('store_settings');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminData, setAdminData] = useState<AdminFullSyncState>(INITIAL_ADMIN_STATE);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());
  const [openCreateProduct, setOpenCreateProduct] = useState(false);
  const [selectedOrderIdForTab, setSelectedOrderIdForTab] = useState<string | null>(null);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [toastNotif, setToastNotif] = useState<AppNotification | null>(null);
  const mountedAtRef = useRef<number>(Date.now());
  const seenAdminNotifIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAdminData(
      (partial) => {
        setAdminData((prev) => ({ ...prev, ...partial }));
        setLastSyncedAt(new Date().toISOString());
        setLoading(false);
        setSyncError(null);
      },
      (err) => {
        setSyncError(err.message || 'Gagal menyinkronkan data admin dengan Cloud Firestore.');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const adminInboxNotifications = useMemo(
    () =>
      adminData.notifications
        .filter((n) => n.targetType === 'admin')
        .map((n) => ({ ...n, effectiveRead: n.isRead })),
    [adminData.notifications],
  );

  const unreadAdminNotifCount = useMemo(
    () => adminInboxNotifications.filter((n) => !n.isRead).length,
    [adminInboxNotifications],
  );

  useEffect(() => {
    if (loading) return;
    const inbox = adminData.notifications.filter((n) => n.targetType === 'admin');
    const newlyArrived = inbox.filter((n) => {
      if (seenAdminNotifIdsRef.current.has(n.id)) return false;
      const createdMs = new Date(n.createdAt).getTime();
      return !n.isRead && createdMs >= mountedAtRef.current - 5_000;
    });
    inbox.forEach((n) => seenAdminNotifIdsRef.current.add(n.id));
    if (newlyArrived.length > 0) {
      const latest = newlyArrived[0];
      setToastNotif(latest);
      void showDeviceNotification({
        title: latest.title,
        body: latest.message,
        tag: `admin-${latest.id}`,
      });
    }
  }, [adminData.notifications, loading]);

  const handleLogout = async () => {
    await signOutAll().catch(() => {});
    await onLoggedOut();
  };

  // All 16 Admin Menu Items
  const navGroups: {
    groupLabel: string;
    items: { id: AdminNavTab; label: string; icon: React.ReactNode; badge?: number }[];
  }[] = [
    {
      groupLabel: 'UTAMA & TOKO',
      items: [
        { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: 'products', label: 'Produk', icon: <Package className="h-4 w-4" /> },
        { id: 'orders', label: 'Pesanan', icon: <ClipboardList className="h-4 w-4" /> },
        {
          id: 'notifications',
          label: 'Notifikasi & Up Promo',
          icon: <Bell className="h-4 w-4" />,
          badge: unreadAdminNotifCount,
        },
      ],
    },
    {
      groupLabel: 'CUSTOMER CLUB',
      items: [
        { id: 'customers', label: 'Pelanggan', icon: <Users className="h-4 w-4" /> },
        { id: 'add_customer', label: 'Tambah Pelanggan', icon: <UserPlus className="h-4 w-4" /> },
        { id: 'points', label: 'DoraCake Points', icon: <Coins className="h-4 w-4" /> },
        { id: 'stamps', label: 'Stamp Card', icon: <Stamp className="h-4 w-4" /> },
        { id: 'referral', label: 'Referral', icon: <Users className="h-4 w-4" /> },
        { id: 'product_codes', label: 'Kode Produk', icon: <QrCode className="h-4 w-4" /> },
      ],
    },
    {
      groupLabel: 'PROMO, KEAMANAN & SISTEM',
      items: [
        { id: 'vouchers', label: 'Voucher', icon: <TicketPercent className="h-4 w-4" /> },
        { id: 'campaigns', label: 'Kampanye Promosi', icon: <Megaphone className="h-4 w-4" /> },
        { id: 'reports', label: 'Laporan', icon: <BarChart3 className="h-4 w-4" /> },
        {
          id: 'antifraud',
          label: 'Anti-Fraud Monitoring',
          icon: <ShieldAlert className="h-4 w-4" />,
          badge: adminData.fraudAlerts.filter((f) => f.status === 'Perlu Ditinjau').length,
        },
        { id: 'audit', label: 'Audit Log', icon: <History className="h-4 w-4" /> },
        { id: 'settings', label: 'Pengaturan', icon: <Settings className="h-4 w-4" /> },
      ],
    },
  ];

  // Computed Customer Club & Operational Metrics
  const clubMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400_000;
    const totalCustomers = adminData.customers.length;
    const newCustomers = adminData.customers.filter(
      (c) => new Date(c.createdAt).getTime() >= sevenDaysAgo,
    ).length;
    const activeCustomers = adminData.customers.filter((c) => c.status === 'Aktif').length;
    const validOrders = adminData.orders.filter((o) => o.orderStatus !== 'Dibatalkan');
    const totalTransactions = validOrders.length;
    const totalSales = validOrders
      .filter((o) => o.orderStatus === 'Selesai')
      .reduce((s, o) => s + o.total, 0);
    const totalPointsCirculating = adminData.customers.reduce((s, c) => s + c.points, 0);
    const totalStampsCollected = adminData.customers.reduce((s, c) => s + c.stamps, 0);
    const successfulReferrals = adminData.referrals.filter((r) => r.status === 'Berhasil').length;
    const vouchersUsed = adminData.vouchers.reduce((s, v) => s + v.usedCount, 0);

    const todayIso = new Date().toISOString().slice(0, 10);
    const newOrdersTodayCount = adminData.orders.filter(
      (o) => o.createdAt.slice(0, 10) === todayIso,
    ).length;
    const waitingConfirmCount = adminData.orders.filter(
      (o) => o.orderStatus === 'Menunggu Konfirmasi',
    ).length;
    const processingOrdersCount = adminData.orders.filter((o) =>
      ['Dikonfirmasi', 'Sedang Diproses', 'Siap Diambil', 'Dalam Pengiriman'].includes(
        o.orderStatus,
      ),
    ).length;

    return {
      totalCustomers,
      newCustomers,
      activeCustomers,
      totalTransactions,
      totalSales,
      totalPointsCirculating,
      totalStampsCollected,
      successfulReferrals,
      vouchersUsed,
      newOrdersTodayCount,
      waitingConfirmCount,
      processingOrdersCount,
    };
  }, [adminData]);

  const recentFiveOrders = adminData.orders.slice(0, 5);
  const brandLogoUrl = adminData.websitePublished.logoUrl || DEFAULT_WEBSITE_CONTENT.logoUrl;
  const brandName =
    adminData.websitePublished.storeName || adminData.settings.storeName || 'DoraCake';

  const handleSelectNav = (tab: AdminNavTab) => {
    setOpenCreateProduct(false);
    setSelectedOrderIdForTab(null);
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#2C1810] text-[#FBF6EE]">
      <div className="overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-[#FBF6EE]/10 px-5 py-5">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#FBF6EE]/20 bg-[#3B2316]">
            <ResilientImage
              src={brandLogoUrl}
              alt={brandName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-serif-display truncate text-lg font-bold text-[#FFFDF9]">
              {brandName}
            </p>
            <p className="text-[11px] text-[#E7CFA2]">Admin Customer Club</p>
          </div>
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-[#FBF6EE]/10 bg-[#3B2316] p-3 text-xs">
          <p className="truncate font-semibold text-[#FFFDF9]">{currentAdmin.name}</p>
          <p className="mt-0.5 truncate text-[#D7C5B4]">{currentAdmin.email}</p>
          <div className="mt-1.5 flex items-center justify-between border-t border-[#FBF6EE]/10 pt-1.5 text-[11px]">
            <span className="font-semibold text-[#E7CFA2]">Role: {currentAdmin.role}</span>
            <span className="rounded bg-emerald-800/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
              LIVE
            </span>
          </div>
        </div>

        <nav className="mt-4 space-y-4 px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.groupLabel}>
              <p className="mb-1 px-3 text-[10px] font-bold tracking-widest text-[#C89D54] uppercase">
                {group.groupLabel}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                        active
                          ? 'bg-[#C89D54] font-semibold text-[#2C1810]'
                          : 'text-[#E7D8C9] hover:bg-[#3B2316] hover:text-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {Boolean(item.badge && item.badge > 0) && (
                        <span className="rounded bg-[#8E2E49] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-2 border-t border-[#FBF6EE]/10 p-4">
        <button
          type="button"
          onClick={onExitToStorefront}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FBF6EE]/20 px-3.5 py-2 text-xs font-semibold text-[#FBF6EE] transition-colors hover:bg-[#3B2316]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Lihat Website Pelanggan</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium text-[#D7C5B4] transition-colors hover:bg-[#3B2316] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Keluar Admin</span>
        </button>
      </div>
    </div>
  );

  // Tier breakdown for chart in Dashboard
  const tierCounts = useMemo(() => {
    const tiers = ['Cakeers Member', 'Cakeers Silver', 'Cakeers Gold', 'Cakeers Loyal'] as const;
    return tiers.map((t) => ({
      tier: t,
      count: adminData.customers.filter((c) => c.tier === t).length,
    }));
  }, [adminData.customers]);
  const maxTierCount = Math.max(1, ...tierCounts.map((t) => t.count));

  return (
    <div className="flex min-h-screen bg-[#F6EFE4] text-[#2C1810]">
      <aside className="hidden w-68 shrink-0 lg:block no-print">{sidebarContent}</aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div className="w-72 shrink-0 shadow-2xl">{sidebarContent}</div>
          <div
            className="flex-1 bg-[#2C1810]/60 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#E6D8C5] bg-[#FFFDF9] px-4 py-3 lg:hidden no-print">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl border border-[#E6D8C5] p-2 text-[#3B2316]"
              aria-label="Buka navigasi admin"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-serif-display text-base font-bold text-[#2C1810]">
              {brandName} Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNotifModalOpen(true)}
              className="relative rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-2 text-[#3B2316]"
              aria-label="Notifikasi Admin"
            >
              <Bell className="h-4 w-4" />
              {unreadAdminNotifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#8E2E49] px-1 text-[9px] font-bold text-white">
                  {unreadAdminNotifCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onExitToStorefront}
              className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs font-semibold text-[#3B2316]"
            >
              Lihat Website
            </button>
          </div>
        </header>

        {/* Desktop quick notification bar */}
        <div className="hidden items-center justify-between border-b border-[#E6D8C5] bg-[#FFFDF9] px-8 py-2.5 lg:flex no-print">
          <p className="text-xs text-[#6E5849]">
            Panel Operasional <strong className="text-[#2C1810]">{brandName}</strong> · Sinkronisasi real-time aktif
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3 py-1.5 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE6EC]"
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span>Up Notifikasi Pelanggan</span>
            </button>
            <button
              type="button"
              onClick={() => setNotifModalOpen(true)}
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F3E9D8]"
            >
              <Bell className="h-3.5 w-3.5 text-[#8E2E49]" />
              <span>Notifikasi</span>
              {unreadAdminNotifCount > 0 && (
                <span className="rounded bg-[#8E2E49] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {unreadAdminNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {syncError && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
              {syncError}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-12 text-center text-sm text-[#5C4435]">
              Menyinkronkan data Cloud Firestore {brandName}...
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-serif-display text-2xl font-bold text-[#2C1810] sm:text-3xl">
                    Dashboard DoraCake Customer Club
                  </h1>
                  <p className="mt-1 text-sm text-[#5C4435]">
                    Data real-time langsung dari Cloud Firestore untuk pelanggan, penjualan, poin,
                    stempel, referral, dan pesanan harian.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('notifications')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-4 py-2.5 text-xs font-semibold text-[#8E2E49] shadow-sm hover:bg-[#FCE6EC] whitespace-nowrap"
                  >
                    <Megaphone className="h-4 w-4" />
                    <span>Up Notifikasi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add_customer')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#8E2E49] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#77243C] whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Tambah Pelanggan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenCreateProduct(true);
                      setActiveTab('products');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] shadow-sm hover:bg-[#4F3020] whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 text-[#E7CFA2]" />
                    <span>Tambah Produk</span>
                  </button>
                </div>
              </div>

              {/* 9 Customer Club KPIs */}
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: 'Total Pelanggan',
                    value: clubMetrics.totalCustomers,
                    sub: 'Terdaftar di Customer Club',
                    accent: 'text-[#2C1810]',
                  },
                  {
                    label: 'Pelanggan Baru (7 Hari)',
                    value: clubMetrics.newCustomers,
                    sub: 'Pendaftaran terbaru',
                    accent: 'text-[#8E2E49]',
                  },
                  {
                    label: 'Pelanggan Aktif',
                    value: clubMetrics.activeCustomers,
                    sub: 'Status keanggotaan aktif',
                    accent: 'text-emerald-700',
                  },
                  {
                    label: 'Total Transaksi',
                    value: clubMetrics.totalTransactions,
                    sub: 'Pesanan valid tercatat',
                    accent: 'text-[#2C1810]',
                  },
                  {
                    label: 'Total Penjualan (Selesai)',
                    value: formatRupiah(clubMetrics.totalSales),
                    sub: 'Omzet pesanan tuntas',
                    accent: 'text-[#3B2316]',
                  },
                  {
                    label: 'Total Poin Beredar',
                    value: clubMetrics.totalPointsCirculating.toLocaleString('id-ID'),
                    sub: 'Saldo DoraCake Points',
                    accent: 'text-[#9E7840]',
                  },
                  {
                    label: 'Total Stempel Terkumpul',
                    value: clubMetrics.totalStampsCollected,
                    sub: 'Akumulasi stempel member',
                    accent: 'text-[#8E2E49]',
                  },
                  {
                    label: 'Referral Berhasil',
                    value: clubMetrics.successfulReferrals,
                    sub: 'Teman belanja pertama valid',
                    accent: 'text-emerald-700',
                  },
                  {
                    label: 'Voucher Digunakan',
                    value: clubMetrics.vouchersUsed,
                    sub: 'Total penukaran promo',
                    accent: 'text-[#2C1810]',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-bold tracking-wider text-[#6E5849] uppercase">
                      {kpi.label}
                    </p>
                    <p className={`font-mono-tabular mt-2 text-2xl font-bold ${kpi.accent}`}>
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6E5849]">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              {/* Operational Summary & Tier Distribution Chart */}
              <div className="grid gap-5 lg:grid-cols-12">
                <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 shadow-sm lg:col-span-6">
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Distribusi Tier Anggota Club
                  </h2>
                  <div className="space-y-3">
                    {tierCounts.map((t) => {
                      const pct = Math.max(10, Math.round((t.count / maxTierCount) * 100));
                      return (
                        <div key={t.tier} className="space-y-1 text-xs">
                          <div className="flex justify-between font-semibold text-[#2C1810]">
                            <span>{t.tier}</span>
                            <span className="font-mono-tabular">{t.count} member</span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-[#FBF6EE]">
                            <div
                              className="h-full rounded-full bg-[#8E2E49]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 shadow-sm lg:col-span-6">
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Antrean Operasional Dapur
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5 text-xs">
                      <ShoppingBag className="h-4 w-4 text-[#9E7840]" />
                      <p className="font-mono-tabular mt-2 text-xl font-bold text-[#2C1810]">
                        {clubMetrics.newOrdersTodayCount}
                      </p>
                      <p className="text-[#6E5849]">Masuk Hari Ini</p>
                    </div>
                    <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5 text-xs">
                      <Clock className="h-4 w-4 text-amber-700" />
                      <p className="font-mono-tabular mt-2 text-xl font-bold text-[#2C1810]">
                        {clubMetrics.waitingConfirmCount}
                      </p>
                      <p className="text-[#6E5849]">Menunggu Konfirmasi</p>
                    </div>
                    <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5 text-xs">
                      <ChefHat className="h-4 w-4 text-sky-700" />
                      <p className="font-mono-tabular mt-2 text-xl font-bold text-[#2C1810]">
                        {clubMetrics.processingOrdersCount}
                      </p>
                      <p className="text-[#6E5849]">Sedang Diproses</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] p-3.5 text-xs text-[#8E2E49]">
                    <span className="font-medium">
                      Tip: Ubah pesanan menjadi <strong>Selesai</strong> &amp;{' '}
                      <strong>Lunas</strong> untuk memicu poin, stempel, dan referral otomatis.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="shrink-0 font-bold underline"
                    >
                      Buka Pesanan
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D8C5] px-6 py-4">
                  <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Pesanan Terbaru (Maks. 5)
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B2316] hover:text-[#9E7840]"
                  >
                    <span>Lihat Semua Pesanan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] text-xs font-semibold tracking-wider text-[#6E5849] uppercase">
                      <tr>
                        <th className="px-6 py-3">No. Pesanan</th>
                        <th className="px-6 py-3">Pelanggan</th>
                        <th className="px-6 py-3">Metode</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0E4D2]">
                      {recentFiveOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-xs text-[#6E5849]">
                            Belum ada pesanan masuk. Pesanan baru dari pelanggan maupun tamu akan
                            muncul otomatis di sini.
                          </td>
                        </tr>
                      ) : (
                        recentFiveOrders.map((order) => {
                          const badge = getOrderStatusBadge(order.orderStatus);
                          return (
                            <tr key={order.id} className="hover:bg-[#FBF6EE]/60">
                              <td className="font-mono-tabular px-6 py-3.5 font-semibold text-[#2C1810] whitespace-nowrap">
                                {order.orderNumber}
                              </td>
                              <td className="px-6 py-3.5 font-medium text-[#2C1810]">
                                {order.customerName}{' '}
                                <span className="text-[11px] text-[#8E2E49]">
                                  ({order.isGuestOrder ? 'Tamu' : order.customerId})
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-xs text-[#5C4435]">
                                {order.deliveryMethod}
                              </td>
                              <td className="font-mono-tabular px-6 py-3.5 text-right font-bold text-[#2C1810] whitespace-nowrap">
                                {formatRupiah(order.total)}
                              </td>
                              <td className="px-6 py-3.5">
                                <span
                                  className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}
                                >
                                  {order.orderStatus}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderIdForTab(order.id);
                                    setActiveTab('orders');
                                  }}
                                  className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4]"
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'products' ? (
            <AdminProductsTab
              currentAdmin={currentAdmin}
              products={adminData.products}
              categories={adminData.categories}
              openCreateImmediately={openCreateProduct}
            />
          ) : activeTab === 'orders' ? (
            <AdminOrdersTab
              actorName={currentAdmin.name}
              orders={adminData.orders}
              customers={adminData.customers}
              products={adminData.products}
              referrals={adminData.referrals}
              productShares={adminData.productShares}
              clubConfig={adminData.clubConfig}
              settings={adminData.settings}
              initialSelectedOrderId={selectedOrderIdForTab}
            />
          ) : activeTab === 'notifications' ? (
            <AdminNotificationsTab
              actorName={currentAdmin.name}
              notifications={adminData.notifications}
              customers={adminData.customers}
            />
          ) : activeTab === 'customers' || activeTab === 'add_customer' ? (
            <AdminCustomersTab
              key={activeTab}
              customers={adminData.customers}
              orders={adminData.orders}
              pointHistory={adminData.pointHistory}
              stampHistory={adminData.stampHistory}
              referrals={adminData.referrals}
              clubConfig={adminData.clubConfig}
              actorName={currentAdmin.name}
              initialMode={activeTab === 'add_customer' ? 'create' : 'list'}
            />
          ) : activeTab === 'points' ||
            activeTab === 'stamps' ||
            activeTab === 'referral' ||
            activeTab === 'product_codes' ? (
            <AdminClubRewardsTab
              section={activeTab}
              currentAdmin={currentAdmin}
              customers={adminData.customers}
              pointRewards={adminData.pointRewards}
              stampRewards={adminData.stampRewards}
              pointHistory={adminData.pointHistory}
              stampHistory={adminData.stampHistory}
              referrals={adminData.referrals}
              referralClicks={adminData.referralClicks}
              productShares={adminData.productShares}
              productShareClicks={adminData.productShareClicks}
              clubConfig={adminData.clubConfig}
              allProducts={adminData.products}
            />
          ) : activeTab === 'vouchers' || activeTab === 'campaigns' || activeTab === 'reports' ? (
            <AdminMarketingAndReportsTab
              section={activeTab}
              vouchers={adminData.vouchers}
              campaigns={adminData.campaigns}
              orders={adminData.orders}
              pointHistory={adminData.pointHistory}
              customers={adminData.customers}
              allProducts={adminData.products}
              actorName={currentAdmin.name}
            />
          ) : activeTab === 'antifraud' || activeTab === 'audit' ? (
            <AdminSecurityAndAuditTab
              section={activeTab}
              fraudAlerts={adminData.fraudAlerts}
              auditLogs={adminData.auditLogs}
              customers={adminData.customers}
              actorName={currentAdmin.name}
            />
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                  Pengaturan Toko, Website &amp; Cloud Firestore
                </h2>
                <p className="mt-1 text-sm text-[#5C4435]">
                  Kelola pengaturan toko, kategori menu, editor website, akun admin Google, serta
                  backup database Cloud Firestore.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-[#E6D8C5] pb-3">
                {(
                  [
                    ['store_settings', 'Pengaturan Toko', <Store className="h-3.5 w-3.5" />],
                    ['categories', 'Kategori Menu', <FolderTree className="h-3.5 w-3.5" />],
                    ['editor', 'Editor Website', <Palette className="h-3.5 w-3.5" />],
                    ['admin_users', 'Pengaturan Admin', <Users className="h-3.5 w-3.5" />],
                    ['database', 'Database & Backup', <Database className="h-3.5 w-3.5" />],
                  ] as [SettingsSubTab, string, React.ReactNode][]
                ).map(([sid, slabel, sicon]) => (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => setSettingsSubTab(sid)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                      settingsSubTab === sid
                        ? 'bg-[#3B2316] text-[#FBF6EE]'
                        : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
                    }`}
                  >
                    {sicon}
                    <span>{slabel}</span>
                  </button>
                ))}
              </div>

              {settingsSubTab === 'categories' ? (
                <AdminCategoriesTab
                  currentAdmin={currentAdmin}
                  categories={adminData.categories}
                  products={adminData.products}
                />
              ) : settingsSubTab === 'editor' ? (
                <AdminWebsiteEditorTab
                  currentAdmin={currentAdmin}
                  websiteDraft={adminData.websiteDraft}
                  websitePublished={adminData.websitePublished}
                  websiteHistory={adminData.websiteHistory}
                  settings={adminData.settings}
                  products={adminData.products}
                  categories={adminData.categories}
                />
              ) : settingsSubTab === 'store_settings' ? (
                <AdminStoreSettingsTab
                  currentAdmin={currentAdmin}
                  settings={adminData.settings}
                />
              ) : settingsSubTab === 'admin_users' ? (
                <AdminUsersTab
                  currentAdmin={currentAdmin}
                  adminUsers={adminData.adminUsers}
                  adminInvites={adminData.adminInvites}
                  onProfileUpdated={onAdminUpdated}
                  onLogout={handleLogout}
                />
              ) : (
                <AdminDatabaseTab
                  currentAdmin={currentAdmin}
                  firebaseStatus={firebaseStatus}
                  lastSyncedAt={lastSyncedAt}
                  activityLogs={adminData.activityLogs}
                  orders={adminData.orders}
                  products={adminData.products}
                  onRefreshStatus={onRefreshFirebaseStatus}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Live In-App Admin Toast Notification */}
      {toastNotif && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-[#EAB8C6] bg-[#FFFDF9] p-4 shadow-xl no-print">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F5] text-[#8E2E49]">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E2E49]">
                  {toastNotif.category} Baru
                </span>
                <p className="text-sm font-bold text-[#2C1810]">{toastNotif.title}</p>
                <p className="mt-0.5 text-xs text-[#5C4435] line-clamp-2">{toastNotif.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToastNotif(null)}
              className="rounded-lg p-1 text-[#6E5849] hover:bg-[#FBF6EE]"
              aria-label="Tutup peringatan notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setToastNotif(null);
                setNotifModalOpen(true);
              }}
              className="rounded-lg bg-[#8E2E49] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#75233A]"
            >
              Lihat Notifikasi
            </button>
          </div>
        </div>
      )}

      {/* Admin Notification Drawer Modal */}
      <NotificationBellModal
        isOpen={notifModalOpen}
        title="Notifikasi Admin"
        notifications={adminInboxNotifications}
        unreadCount={unreadAdminNotifCount}
        onClose={() => setNotifModalOpen(false)}
        onMarkRead={(notif) => {
          void markNotificationReadFirebase(notif.id, true);
        }}
        onMarkAllRead={() => {
          void markAllNotificationsReadFirebase(adminInboxNotifications);
        }}
      />
    </div>
  );
};
