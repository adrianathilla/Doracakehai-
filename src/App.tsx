import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AdminUserPublic,
  AppNotification,
  CartItem,
  Category,
  ClubConfig,
  CustomerAccount,
  DeliveryMethod,
  FirebaseRuntimeStatus,
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
  WebsiteContentConfig,
} from './types';
import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_WEBSITE_CONTENT,
} from './constants/defaultWebsiteContent';
import {
  FIREBASE_PROJECT_ID,
  auth,
  testConnection,
} from './firebase';
import { DEFAULT_CLUB_CONFIG } from './services/clubStore';
import {
  changeCustomerOwnPassword,
  claimGuestOrderFirebase,
  completeCustomerFirstPassword,
  createOrderFirebase,
  loginCustomerWithUsername,
  markAllNotificationsReadFirebase,
  markNotificationReadFirebase,
  recordProductShareClickFirebase,
  recordReferralClickFirebase,
  redeemPointRewardFirebase,
  redeemStampRewardFirebase,
  resolveAuthenticatedUser,
  signOutAll,
  subscribeCustomerClubData,
  subscribeCustomerNotifications,
  subscribeStorefront,
} from './services/firebaseService';
import { initPWAServiceWorker, showDeviceNotification } from './utils/webNotifications';
import { PrototypeModeBanner } from './components/PrototypeModeBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotificationBellModal } from './components/NotificationBellModal';
import { CustomerEntryGate } from './components/CustomerEntryGate';
import {
  CustomerDashboardView,
  CustomerNavTab,
} from './components/CustomerDashboardView';
import { StorefrontView } from './components/StorefrontView';
import { CatalogSortOption } from './components/CatalogSection';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductShareModal } from './components/ProductShareModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';

const CART_STORAGE_KEY = 'doracake_cart_v1';
const RECENT_ORDERS_KEY = 'doracake_recent_orders_v1';
const getReadBroadcastsKey = (customerId: string) => `doracake_read_broadcasts_${customerId}`;

type AppMode = 'entry' | 'guest' | 'customer' | 'admin';

export default function App() {
  // Real-time Storefront Firestore State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [website, setWebsite] = useState<WebsiteContentConfig>(DEFAULT_WEBSITE_CONTENT);
  const [clubConfig, setClubConfig] = useState<ClubConfig>(DEFAULT_CLUB_CONFIG);
  const [pointRewards, setPointRewards] = useState<PointRewardItem[]>([]);
  const [stampRewards, setStampRewards] = useState<StampRewardItem[]>([]);
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [publicVouchers, setPublicVouchers] = useState<Voucher[]>([]);

  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseRuntimeStatus>({
    state: 'connecting',
    mode: 'firebase',
    projectId: FIREBASE_PROJECT_ID,
    lastCheckedAt: new Date().toISOString(),
    message: `Menghubungkan ke Cloud Firestore (${FIREBASE_PROJECT_ID})...`,
  });

  // Real-time Customer Session & Club State
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<CustomerAccount | null>(null);
  const [custOrders, setCustOrders] = useState<Order[]>([]);
  const [custPointHistory, setCustPointHistory] = useState<PointHistoryItem[]>([]);
  const [custStampHistory, setCustStampHistory] = useState<StampHistoryItem[]>([]);
  const [custPersonalVouchers, setCustPersonalVouchers] = useState<Voucher[]>([]);
  const [custReferrals, setCustReferrals] = useState<ReferralRecord[]>([]);
  const [rawCustomerNotifs, setRawCustomerNotifs] = useState<AppNotification[]>([]);
  const [readBroadcastIds, setReadBroadcastIds] = useState<string[]>([]);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [custToastNotif, setCustToastNotif] = useState<AppNotification | null>(null);

  // Admin Session State
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminUserPublic | null>(null);

  // Navigation Mode
  const [appMode, setAppMode] = useState<AppMode>('entry');
  const [customerTab, setCustomerTab] = useState<CustomerNavTab>('beranda');

  // Storefront Filters & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<CatalogSortOption>('recommended');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [shareModalProduct, setShareModalProduct] = useState<Product | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  // Shared Link / Referral Attribution from URL (?product=...&ref=...)
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [sharedAttribution, setSharedAttribution] = useState<{
    refCode?: string;
    productCode?: string;
  } | null>(null);
  const urlProductHandledRef = useRef(false);

  // Cart & Recent Orders Persistence (device convenience only)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [recentOrderNumbers, setRecentOrderNumbers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_ORDERS_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  const refreshFirebaseStatus = useCallback(async () => {
    const res = await testConnection();
    setFirebaseStatus({
      state: res.ok ? 'connected' : 'error',
      mode: 'firebase',
      projectId: FIREBASE_PROJECT_ID,
      lastCheckedAt: new Date().toISOString(),
      message: res.message,
    });
  }, []);

  useEffect(() => {
    void refreshFirebaseStatus();
    initPWAServiceWorker();
  }, [refreshFirebaseStatus]);

  // Subscribe to Public Storefront Collections
  useEffect(() => {
    let defaultSortApplied = false;
    const unsub = subscribeStorefront(
      (partial) => {
        if (partial.categories !== undefined) setCategories(partial.categories);
        if (partial.products !== undefined) setProducts(partial.products);
        if (partial.settings !== undefined) setSettings(partial.settings);
        if (partial.website !== undefined) {
          setWebsite(partial.website);
          if (!defaultSortApplied && partial.website.defaultSort) {
            setSortBy(partial.website.defaultSort);
            defaultSortApplied = true;
          }
        }
        if (partial.clubConfig !== undefined) setClubConfig(partial.clubConfig);
        if (partial.pointRewards !== undefined) setPointRewards(partial.pointRewards);
        if (partial.stampRewards !== undefined) setStampRewards(partial.stampRewards);
        if (partial.campaigns !== undefined) setCampaigns(partial.campaigns);
        if (partial.publicVouchers !== undefined) setPublicVouchers(partial.publicVouchers);
        setLoadingStore(false);
        setStoreError(null);
      },
      (err) => {
        setStoreError(err.message || 'Gagal memuat katalog dari Firestore.');
        setLoadingStore(false);
      },
    );
    return () => unsub();
  }, []);

  // Subscribe to Firebase Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUid(null);
        setActiveCustomer(null);
        setAdminSession(null);
        setCustOrders([]);
        setCustPointHistory([]);
        setCustStampHistory([]);
        setCustPersonalVouchers([]);
        setCustReferrals([]);
        setRawCustomerNotifs([]);
        setReadBroadcastIds([]);
        setAppMode((prev) => (prev === 'admin' || prev === 'customer' ? 'entry' : prev));
        return;
      }

      setAuthUid(user.uid);
      try {
        const resolved = await resolveAuthenticatedUser(user);
        if (resolved.admin) {
          setAdminSession(resolved.admin);
          setActiveCustomer(null);
          setAppMode('admin');
        } else if (resolved.customer) {
          setActiveCustomer(resolved.customer);
          setAdminSession(null);
          if (!resolved.customer.mustChangePassword) {
            setAppMode('customer');
          } else {
            setAppMode('entry');
          }
        }
      } catch {
        // Biarkan handler login menangani error eksplisit
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Logged-in Customer's Real-Time Club Data
  useEffect(() => {
    if (!authUid || !activeCustomer?.id) return;
    const unsub = subscribeCustomerClubData(authUid, activeCustomer.id, (partial) => {
      if (partial.customer !== undefined && partial.customer) {
        setActiveCustomer(partial.customer);
      }
      if (partial.orders !== undefined) setCustOrders(partial.orders);
      if (partial.pointHistory !== undefined) setCustPointHistory(partial.pointHistory);
      if (partial.stampHistory !== undefined) setCustStampHistory(partial.stampHistory);
      if (partial.personalVouchers !== undefined) setCustPersonalVouchers(partial.personalVouchers);
      if (partial.referrals !== undefined) setCustReferrals(partial.referrals);
    });
    return () => unsub();
  }, [authUid, activeCustomer?.id]);

  // Load Read Broadcast IDs & Subscribe to Customer Real-Time Notifications
  useEffect(() => {
    if (!authUid || !activeCustomer?.id) {
      setRawCustomerNotifs([]);
      setReadBroadcastIds([]);
      return;
    }

    const storageKey = getReadBroadcastsKey(activeCustomer.id);
    let initialReadBroadcasts: string[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      initialReadBroadcasts = saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      initialReadBroadcasts = [];
    }
    setReadBroadcastIds(initialReadBroadcasts);

    const subscriptionStartedAt = Date.now();
    const seenIds = new Set<string>();

    const unsub = subscribeCustomerNotifications(authUid, (notifs) => {
      setRawCustomerNotifs(notifs);
      let latestReadIds = initialReadBroadcasts;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) latestReadIds = JSON.parse(raw) as string[];
      } catch {
        // ignore storage read error
      }

      const newlyArrived = notifs.filter((n) => {
        if (seenIds.has(n.id)) return false;
        const createdMs = new Date(n.createdAt).getTime();
        const isFresh = createdMs >= subscriptionStartedAt - 5_000;
        const alreadyRead =
          n.targetType === 'broadcast' ? latestReadIds.includes(n.id) : n.isRead;
        return isFresh && !alreadyRead;
      });

      notifs.forEach((n) => seenIds.add(n.id));

      if (newlyArrived.length > 0) {
        const latest = newlyArrived[0];
        setCustToastNotif(latest);
        void showDeviceNotification({
          title: latest.title,
          body: latest.message,
          tag: `cust-${latest.id}`,
        });
      }
    });

    return () => unsub();
  }, [authUid, activeCustomer?.id]);

  // Parse ?ref= once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref')?.trim().toUpperCase() || '';
    const prodParam = params.get('product')?.trim().toUpperCase() || '';
    if (!refParam && !prodParam) return;

    setSharedAttribution({
      refCode: refParam || undefined,
      productCode: prodParam || undefined,
    });

    if (refParam) {
      setReferralNotice(
        `Kamu membuka DoraCake dari tautan teman (Kode Referral: ${refParam}).`,
      );
      void recordReferralClickFirebase(refParam);
    }
  }, []);

  // Parse ?product= once products are loaded from Firestore
  useEffect(() => {
    if (urlProductHandledRef.current || products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref')?.trim().toUpperCase() || '';
    const prodParam = params.get('product')?.trim().toUpperCase() || '';
    if (!prodParam) {
      urlProductHandledRef.current = true;
      return;
    }

    const targetProd = products.find(
      (p) =>
        p.productCode?.toUpperCase() === prodParam || p.id.toUpperCase() === prodParam,
    );
    if (targetProd) {
      urlProductHandledRef.current = true;
      void recordProductShareClickFirebase(targetProd, activeCustomer, refParam || undefined);
      setSelectedProduct(targetProd);
      setAppMode((prev) => (prev === 'entry' ? 'guest' : prev));
    }
  }, [products, activeCustomer]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota issues
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrderNumbers));
    } catch {
      // Ignore storage quota issues
    }
  }, [recentOrderNumbers]);

  // Merged Vouchers (Personal + Public, dedup by id)
  const allAvailableVouchers = useMemo(() => {
    const map = new Map<string, Voucher>();
    for (const v of custPersonalVouchers) map.set(v.id, v);
    for (const v of publicVouchers) {
      if (!map.has(v.id)) map.set(v.id, v);
    }
    return [...map.values()];
  }, [custPersonalVouchers, publicVouchers]);

  // Customer Notification View Models
  const mergedCustomerNotifications = useMemo(
    () =>
      rawCustomerNotifs.map((n) => ({
        ...n,
        effectiveRead:
          n.targetType === 'broadcast' ? readBroadcastIds.includes(n.id) : n.isRead,
      })),
    [rawCustomerNotifs, readBroadcastIds],
  );

  const unreadCustomerNotifCount = useMemo(
    () => mergedCustomerNotifications.filter((n) => !n.effectiveRead).length,
    [mergedCustomerNotifications],
  );

  const handleMarkCustomerNotifRead = (notif: AppNotification) => {
    if (!activeCustomer) return;
    if (notif.targetType === 'broadcast') {
      setReadBroadcastIds((prev) => {
        if (prev.includes(notif.id)) return prev;
        const next = [...prev, notif.id];
        try {
          localStorage.setItem(getReadBroadcastsKey(activeCustomer.id), JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
        return next;
      });
    } else {
      void markNotificationReadFirebase(notif.id, true);
    }
  };

  const handleMarkAllCustomerNotifsRead = () => {
    if (!activeCustomer) return;
    const broadcastIds = rawCustomerNotifs
      .filter((n) => n.targetType === 'broadcast')
      .map((n) => n.id);
    if (broadcastIds.length > 0) {
      setReadBroadcastIds((prev) => {
        const next = [...new Set([...prev, ...broadcastIds])];
        try {
          localStorage.setItem(getReadBroadcastsKey(activeCustomer.id), JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
        return next;
      });
    }
    const personalNotifs = rawCustomerNotifs.filter(
      (n) => n.targetType === 'customer' && !n.isRead,
    );
    if (personalNotifs.length > 0) {
      void markAllNotificationsReadFirebase(personalNotifs);
    }
  };

  const filteredProducts = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (!p.isActive) return false;
      if (activeTab === 'favorite' && !p.isFavorite) return false;
      if (activeTab !== 'all' && activeTab !== 'favorite' && p.categoryId !== activeTab) {
        return false;
      }
      if (queryStr) {
        const matchName = p.name.toLowerCase().includes(queryStr);
        const matchDesc = p.description.toLowerCase().includes(queryStr);
        const matchCode = (p.productCode || '').toLowerCase().includes(queryStr);
        if (!matchName && !matchDesc && !matchCode) return false;
      }
      return true;
    });

    const getEffectivePrice = (p: Product) =>
      p.promoPrice !== null && p.promoPrice > 0 && p.promoPrice < p.price ? p.promoPrice : p.price;

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return getEffectivePrice(a) - getEffectivePrice(b);
      if (sortBy === 'price_desc') return getEffectivePrice(b) - getEffectivePrice(a);
      if (sortBy === 'newest') return b.createdAt.localeCompare(a.createdAt);
      if (sortBy === 'bestseller') {
        return (
          Number(b.isBestSeller) - Number(a.isBestSeller) ||
          (b.soldCount ?? 0) - (a.soldCount ?? 0)
        );
      }
      const scoreA = (a.isFavorite ? 2 : 0) + (a.isBestSeller ? 1 : 0);
      const scoreB = (b.isFavorite ? 2 : 0) + (b.isBestSeller ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [products, activeTab, searchQuery, sortBy]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const effectiveSettings = useMemo<StoreSettings>(
    () => ({
      ...settings,
      whatsappNumber: website.footerWhatsapp || settings.whatsappNumber,
    }),
    [settings, website.footerWhatsapp],
  );

  // Cart Handlers
  const handleSubmitToCart = (newItem: CartItem, replaceCartItemId?: string) => {
    setCart((prev) => {
      if (replaceCartItemId) {
        return prev.map((it) => (it.cartItemId === replaceCartItemId ? newItem : it));
      }
      const existingIdx = prev.findIndex(
        (it) =>
          it.productId === newItem.productId &&
          it.notes === newItem.notes &&
          it.selectedVariants.flavor?.id === newItem.selectedVariants.flavor?.id &&
          it.selectedVariants.topping?.id === newItem.selectedVariants.topping?.id &&
          it.selectedVariants.glaze?.id === newItem.selectedVariants.glaze?.id,
      );
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx ? { ...it, quantity: it.quantity + newItem.quantity } : it,
        );
      }
      return [...prev, newItem];
    });
    setSelectedProduct(null);
    setEditingCartItem(null);
    setCartOpen(true);
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          return nextQty <= 0 ? null : { ...item, quantity: nextQty };
        })
        .filter((x): x is CartItem => x !== null),
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handleEditCartVariant = (item: CartItem) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    setCartOpen(false);
    setEditingCartItem(item);
    setSelectedProduct(product);
  };

  // Live Firestore Checkout Handler
  const handleSubmitOrder = async (payload: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    deliveryMethod: DeliveryMethod;
    orderDate: string;
    pickupDeliveryTime: string;
    notes: string;
    voucherCode?: string;
  }) => {
    try {
      const order = await createOrderFirebase({
        customer: activeCustomer,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerAddress: payload.customerAddress,
        deliveryMethod: payload.deliveryMethod,
        orderDate: payload.orderDate,
        pickupDeliveryTime: payload.pickupDeliveryTime,
        notes: payload.notes,
        cartItems: cart,
        products,
        vouchers: allAvailableVouchers,
        settings: effectiveSettings,
        voucherCode: payload.voucherCode,
        sharedByCode: sharedAttribution?.refCode,
        sharedProductCode: sharedAttribution?.productCode,
      });
      setCart([]);
      setRecentOrderNumbers((prev) => [order.orderNumber, ...prev.slice(0, 4)]);
      return { ok: true as const, order };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Gagal membuat pesanan. Coba lagi.',
      };
    }
  };

  // Entry & Customer Auth Handlers (Firebase Auth)
  const handleCustomerLogin = async (username: string, password: string) => {
    try {
      const customer = await loginCustomerWithUsername(username, password);
      setActiveCustomer(customer);
      if (!customer.mustChangePassword) {
        setCustomerTab('beranda');
        setAppMode('customer');
      }
      return { ok: true as const, customer };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Gagal login ke Customer Club.',
      };
    }
  };

  const handleFirstPasswordChange = async (_customerId: string, newPassword: string) => {
    if (!activeCustomer) {
      return { ok: false as const, error: 'Sesi pelanggan tidak ditemukan.' };
    }
    try {
      await completeCustomerFirstPassword(activeCustomer, newPassword);
      const updated = { ...activeCustomer, mustChangePassword: false };
      setActiveCustomer(updated);
      setCustomerTab('beranda');
      setAppMode('customer');
      return { ok: true as const, customer: updated };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Gagal memperbarui password pertama.',
      };
    }
  };

  const handleOpenAdminButton = () => {
    if (adminSession) {
      setAppMode('admin');
    } else {
      setAdminLoginOpen(true);
    }
  };

  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const renderStorefront = (customActiveCustomer = activeCustomer) => (
    <StorefrontView
      website={website}
      settings={effectiveSettings}
      products={filteredProducts}
      categories={categories}
      searchQuery={searchQuery}
      onSearchChange={(q) => {
        setSearchQuery(q);
        if (q.trim().length > 0 && appMode === 'guest') {
          const el = document.getElementById('katalog');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sortBy={sortBy}
      onSortChange={setSortBy}
      onResetFilters={() => {
        setSearchQuery('');
        setActiveTab('all');
        setSortBy(website.defaultSort || 'recommended');
      }}
      onSelectProduct={(product) => {
        setEditingCartItem(null);
        setSelectedProduct(product);
      }}
      onShareProduct={(product) => setShareModalProduct(product)}
      cartCount={cartCount}
      onOpenTracking={() => setTrackingOpen(true)}
      onOpenCart={() => setCartOpen(true)}
      onOpenAdmin={handleOpenAdminButton}
      activeCustomer={customActiveCustomer}
      activeCampaigns={campaigns}
      unreadNotifCount={customActiveCustomer ? unreadCustomerNotifCount : 0}
      onOpenNotifications={
        customActiveCustomer ? () => setNotifModalOpen(true) : undefined
      }
      onOpenMemberClub={() => {
        if (customActiveCustomer && !customActiveCustomer.mustChangePassword) {
          setCustomerTab('beranda');
          setAppMode('customer');
        } else {
          setAppMode('entry');
        }
      }}
      isLoading={loadingStore}
      errorMsg={storeError}
    />
  );

  return (
    <div className="min-h-screen bg-[#F6EFE4] text-[#2C1810]">
      <OfflineIndicator />
      <PrototypeModeBanner
        mode={appMode}
        activeCustomer={activeCustomer}
        onOpenEntry={() => setAppMode('entry')}
        onOpenCustomerDashboard={() => {
          if (activeCustomer && !activeCustomer.mustChangePassword) {
            setCustomerTab('beranda');
            setAppMode('customer');
          } else {
            setAppMode('entry');
          }
        }}
        onOpenAdminLogin={handleOpenAdminButton}
      />

      {appMode === 'admin' && adminSession ? (
        <AdminDashboard
          currentAdmin={adminSession}
          firebaseStatus={firebaseStatus}
          onRefreshFirebaseStatus={() => {
            void refreshFirebaseStatus();
          }}
          onExitToStorefront={() =>
            setAppMode(
              activeCustomer && !activeCustomer.mustChangePassword ? 'customer' : 'guest',
            )
          }
          onAdminUpdated={(updated) => setAdminSession(updated)}
          onLoggedOut={async () => {
            await signOutAll();
            setAdminSession(null);
            setAppMode('entry');
          }}
        />
      ) : appMode === 'entry' ? (
        <CustomerEntryGate
          logoUrl={website.logoUrl}
          referralNotice={referralNotice}
          forcedChangeCustomer={
            activeCustomer?.mustChangePassword ? activeCustomer : null
          }
          onLoginSubmit={handleCustomerLogin}
          onCompleteFirstPasswordChange={handleFirstPasswordChange}
          onContinueAsGuest={() => setAppMode('guest')}
          onOpenAdminLogin={handleOpenAdminButton}
        />
      ) : appMode === 'customer' && activeCustomer ? (
        <CustomerDashboardView
          activeTab={customerTab}
          onTabChange={setCustomerTab}
          customer={activeCustomer}
          orders={custOrders}
          pointHistory={custPointHistory}
          stampHistory={custStampHistory}
          vouchers={allAvailableVouchers}
          referrals={custReferrals}
          pointRewards={pointRewards}
          stampRewards={stampRewards}
          campaigns={campaigns}
          clubConfig={clubConfig}
          allProducts={products}
          settings={effectiveSettings}
          logoUrl={website.logoUrl}
          cartCount={cartCount}
          unreadNotifCount={unreadCustomerNotifCount}
          onOpenNotifications={() => setNotifModalOpen(true)}
          onOpenCart={() => setCartOpen(true)}
          onOpenTracking={() => setTrackingOpen(true)}
          onLogout={async () => {
            await signOutAll();
            setActiveCustomer(null);
            setAppMode('entry');
          }}
          onRedeemPointReward={async (rewardId) => {
            const reward = pointRewards.find((r) => r.id === rewardId);
            if (!reward) return { ok: false, message: 'Hadiah poin tidak ditemukan.' };
            try {
              const voucher = await redeemPointRewardFirebase(activeCustomer, reward);
              return {
                ok: true,
                message: `Berhasil ditukar! Kode voucher ${voucher.code} sudah masuk ke Voucher Saya.`,
              };
            } catch (err) {
              return {
                ok: false,
                message: err instanceof Error ? err.message : 'Gagal menukar poin.',
              };
            }
          }}
          onRedeemStampReward={async (rewardId) => {
            const reward = stampRewards.find((r) => r.id === rewardId);
            if (!reward) return { ok: false, message: 'Hadiah stempel tidak ditemukan.' };
            try {
              const voucher = await redeemStampRewardFirebase(
                activeCustomer,
                reward,
                clubConfig.stampTarget,
              );
              return {
                ok: true,
                message: `Selamat! Hadiah ${clubConfig.stampTarget} stempel ditukar menjadi Voucher ${voucher.code}. Kartu stempel dimulai ulang dari 0.`,
              };
            } catch (err) {
              return {
                ok: false,
                message: err instanceof Error ? err.message : 'Gagal menukar stempel.',
              };
            }
          }}
          onChangePassword={async (oldPass, newPass) => {
            try {
              await changeCustomerOwnPassword(activeCustomer, oldPass, newPass);
              return { ok: true, message: 'Password akun Anda berhasil diperbarui.' };
            } catch (err) {
              return {
                ok: false,
                message: err instanceof Error ? err.message : 'Gagal mengganti password.',
              };
            }
          }}
          onClaimGuestOrder={async (orderNum, verifiedPhone) => {
            try {
              const msg = await claimGuestOrderFirebase({
                customer: activeCustomer,
                orderNumberInput: orderNum,
                verifiedPhoneInput: verifiedPhone,
              });
              return { ok: true, message: msg };
            } catch (err) {
              return {
                ok: false,
                message: err instanceof Error ? err.message : 'Gagal mengklaim pesanan.',
              };
            }
          }}
          onApplyVoucherToCheckout={() => {
            setCustomerTab('belanja');
            if (cart.length > 0) {
              setCheckoutOpen(true);
            } else {
              setCartOpen(true);
            }
          }}
          renderBelanjaStorefront={() => renderStorefront(activeCustomer)}
        />
      ) : (
        renderStorefront(activeCustomer)
      )}

      {/* Product Detail & Variant Selector Modal */}
      <ProductDetailModal
        product={selectedProduct}
        categoryName={selectedProduct ? categoryNameMap.get(selectedProduct.categoryId) : undefined}
        editingCartItem={editingCartItem}
        onClose={() => {
          setSelectedProduct(null);
          setEditingCartItem(null);
        }}
        onSubmitToCart={handleSubmitToCart}
        onShareProduct={(p) => {
          setSelectedProduct(null);
          setShareModalProduct(p);
        }}
      />

      {/* Product Share Modal */}
      <ProductShareModal
        product={shareModalProduct}
        activeCustomer={activeCustomer}
        onClose={() => setShareModalProduct(null)}
        onRecordShareClick={(product, refUsed) => {
          void recordProductShareClickFirebase(product, activeCustomer, refUsed);
          setSharedAttribution({
            productCode: product.productCode,
            refCode: refUsed || activeCustomer?.referralCode,
          });
        }}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        items={cart}
        settings={effectiveSettings}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onEditVariant={handleEditCartVariant}
        onProceedToCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={checkoutOpen}
        items={cart}
        allProducts={products}
        settings={effectiveSettings}
        activeCustomer={activeCustomer}
        vouchers={allAvailableVouchers}
        clubConfig={clubConfig}
        sharedAttribution={sharedAttribution}
        onClose={() => setCheckoutOpen(false)}
        onSubmitOrder={handleSubmitOrder}
      />

      {/* Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={trackingOpen}
        recentOrderNumbers={recentOrderNumbers}
        localOrders={custOrders}
        settings={effectiveSettings}
        onClose={() => setTrackingOpen(false)}
      />

      {/* Admin Login Modal (Google Sign-In) */}
      <AdminLoginModal
        isOpen={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        onAuthenticated={(admin) => {
          setAdminSession(admin);
          setAdminLoginOpen(false);
          setAppMode('admin');
        }}
      />

      {/* Live In-App Customer Toast Notification */}
      {custToastNotif && appMode !== 'admin' && activeCustomer && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-[#EAB8C6] bg-[#FFFDF9] p-4 shadow-xl no-print">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F5] text-[#8E2E49]">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E2E49]">
                  {custToastNotif.category} DoraCake
                </span>
                <p className="text-sm font-bold text-[#2C1810]">{custToastNotif.title}</p>
                <p className="mt-0.5 text-xs text-[#5C4435] line-clamp-2">
                  {custToastNotif.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCustToastNotif(null)}
              className="rounded-lg p-1 text-[#6E5849] hover:bg-[#FBF6EE]"
              aria-label="Tutup peringatan notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setCustToastNotif(null);
                setNotifModalOpen(true);
              }}
              className="rounded-lg bg-[#8E2E49] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#75233A]"
            >
              Buka Notifikasi
            </button>
          </div>
        </div>
      )}

      {/* Customer Notification Center Modal */}
      {activeCustomer && (
        <NotificationBellModal
          isOpen={notifModalOpen}
          title="Notifikasi DoraCake"
          notifications={mergedCustomerNotifications}
          unreadCount={unreadCustomerNotifCount}
          onClose={() => setNotifModalOpen(false)}
          onMarkRead={handleMarkCustomerNotifRead}
          onMarkAllRead={handleMarkAllCustomerNotifsRead}
        />
      )}
    </div>
  );
}
