export type FirebaseConnectionState = 'unconfigured' | 'connecting' | 'connected' | 'error';

export type OrderStatus =
  | 'Menunggu Konfirmasi'
  | 'Dikonfirmasi'
  | 'Sedang Diproses'
  | 'Siap Diambil'
  | 'Dalam Pengiriman'
  | 'Selesai'
  | 'Dibatalkan';

export type PaymentStatus =
  | 'Belum Dibayar'
  | 'Menunggu Verifikasi'
  | 'Lunas'
  | 'Dibatalkan';

export type DeliveryMethod = 'Antar' | 'Ambil';

export type AdminRole = 'SUPERADMIN' | 'ADMIN';

export interface VariantOption {
  id: string;
  name: string;
  additionalPrice: number;
  isActive: boolean;
}

export interface ProductVariants {
  flavors: VariantOption[];
  toppings: VariantOption[];
  glazes: VariantOption[];
}

export interface Product {
  id: string;
  productCode?: string;
  isStampEligible?: boolean;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  promoPrice: number | null;
  stock: number;
  isAvailable: boolean;
  imageUrl: string;
  isActive: boolean;
  isFavorite: boolean;
  isNewest: boolean;
  isBestSeller: boolean;
  variants: ProductVariants;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SelectedVariants {
  flavor?: VariantOption | null;
  topping?: VariantOption | null;
  glaze?: VariantOption | null;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  productCode?: string;
  productName: string;
  productImage: string;
  baseUnitPrice: number;
  selectedVariants: SelectedVariants;
  unitPrice: number;
  quantity: number;
  notes: string;
}

export interface OrderItem {
  productId: string;
  productCode?: string;
  productName: string;
  productImage: string;
  baseUnitPrice: number;
  selectedVariants: SelectedVariants;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  authUid?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryMethod: DeliveryMethod;
  orderDate: string;
  pickupDeliveryTime: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  voucherCode?: string;
  voucherDiscount?: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  isGuestOrder?: boolean;
  rewardsGranted?: boolean;
  stampGranted?: boolean;
  sharedByCode?: string;
  sharedProductCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicOrderTrackingView {
  orderNumber: string;
  customerName: string;
  deliveryMethod: DeliveryMethod;
  orderDate: string;
  pickupDeliveryTime: string;
  items: OrderItem[];
  subtotal: number;
  voucherCode?: string;
  voucherDiscount?: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExtraInfoSection {
  id: string;
  type: 'banner' | 'testimonial' | 'store_info' | 'announcement' | 'promo_image' | 'text';
  title: string;
  content: string;
  authorOrLabel: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export type HeaderNavKey = 'search' | 'tracking' | 'cart' | 'admin';
export type HeroElementKey = 'promoLabel' | 'title' | 'description' | 'badges' | 'cta';

export interface WebsiteContentConfig {
  // 1. Identitas Toko
  storeName: string;
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: 'Playfair Display' | 'Cormorant Garamond' | 'Fraunces';

  // 2. Header Website
  logoSize: 'sm' | 'md' | 'lg';
  headerBgColor: string;
  headerTextColor: string;
  navOrder: HeaderNavKey[];
  showSearch: boolean;
  searchPlaceholder: string;
  showTracking: boolean;
  trackingLabel: string;
  showCart: boolean;
  cartLabel: string;
  showAdminButton: boolean;
  adminButtonLabel: string;

  // 3. Hero Section
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroBgColor: string;
  heroBgImageUrl: string;
  heroPromoLabel: string;
  heroCtaText: string;
  heroCtaEnabled: boolean;
  heroCardKicker: string;
  heroCardTitle: string;
  heroCardSubtitle: string;
  heroCardCtaText: string;
  heroElements: {
    showPromoLabel: boolean;
    showDescription: boolean;
    showBadges: boolean;
    showCta: boolean;
    showBannerCard: boolean;
  };
  heroElementOrder: HeroElementKey[];

  // 4. Informasi Promosi
  freeShippingBadgeText: string;
  orderSpeedBadgeText: string;
  qualityBadgeText: string;
  promoBannerEnabled: boolean;
  promoBannerText: string;
  promoPeriodText: string;

  // 5. Katalog Produk
  catalogKicker: string;
  catalogTitle: string;
  catalogDescription: string;
  tabAllLabel: string;
  tabFavoriteLabel: string;
  showFavoriteTab: boolean;
  cardColumns: 2 | 3 | 4;
  defaultSort: 'recommended' | 'newest' | 'bestseller' | 'price_asc' | 'price_desc';
  showProductCategory: boolean;
  showProductDescription: boolean;
  showProductAvailability: boolean;
  showPromoStrikePrice: boolean;

  // 6. Bagian Informasi Tambahan
  extraSections: ExtraInfoSection[];

  // 7. Footer
  footerStoreName: string;
  footerAddress: string;
  footerHours: string;
  footerWhatsapp: string;
  footerServiceTitle: string;
  footerPaymentTitle: string;
  footerPaymentText: string;
  footerCopyright: string;
  socialLinks: {
    instagram: string;
    tiktok: string;
    facebook: string;
  };

  // 8. Pengaturan Tampilan
  pageBgColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  textColor: string;
  cardRadius: 'md' | 'lg' | 'xl';
  fontSizeScale: 'sm' | 'md' | 'lg';
  sectionSpacing: 'compact' | 'normal' | 'relaxed';

  updatedAt: string;
}

export interface WebsiteSnapshot {
  id: string;
  savedAt: string;
  savedBy: string;
  note: string;
  content: WebsiteContentConfig;
}

export interface StoreSettings {
  storeName: string;
  fullName: string;
  address: string;
  operationalHours: string;
  whatsappNumber: string;
  contactInfo: string;
  minFreeShipping: number;
  defaultShippingCost: number;
  shippingRules: string;
  pickupDeliveryStartHour: string;
  pickupDeliveryEndHour: string;
  cancellationPolicy: string;
  paymentInfoText: string;
  updatedAt: string;
}

export interface AdminUserPublic {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminInvite {
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  invitedBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminActivityLog {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface StoreDatabaseState {
  products: Product[];
  categories: Category[];
  orders: Order[];
  settings: StoreSettings;
  websiteDraft: WebsiteContentConfig;
  websitePublished: WebsiteContentConfig;
  websiteHistory: WebsiteSnapshot[];
  activityLogs: AdminActivityLog[];
  lastSyncedAt: string;
}

export interface FirebaseRuntimeStatus {
  state: FirebaseConnectionState;
  mode: 'local-store' | 'firebase';
  projectId: string | null;
  lastCheckedAt: string;
  message: string;
}

// ==========================================================
// DORACAKE CUSTOMER CLUB PROTOTYPE TYPES
// ==========================================================

export type CustomerAccountStatus = 'Aktif' | 'Dibekukan' | 'Dinonaktifkan';
export type CustomerMemberTier = 'Cakeers Member' | 'Cakeers Silver' | 'Cakeers Gold' | 'Cakeers Loyal';
export type FraudStatus = 'Normal' | 'Perlu Ditinjau' | 'Dibatasi' | 'Dinonaktifkan';

export interface CustomerAccount {
  id: string; // e.g. DC-000001
  authUid?: string;
  authEmail?: string;
  email?: string;
  name: string;
  phone: string;
  username: string;
  mustChangePassword: boolean;
  status: CustomerAccountStatus;
  tier: CustomerMemberTier;
  points: number;
  stamps: number;
  totalTransactions: number;
  totalSpent: number;
  referralCode: string;
  referredByCode?: string;
  referralRewardClaimed?: boolean;
  birthday?: string; // YYYY-MM-DD
  fraudStatus: FraudStatus;
  fraudReason?: string;
  simulatedDeviceId: string;
  failedLoginAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface PointHistoryItem {
  id: string;
  customerId: string;
  authUid?: string;
  type: 'Masuk' | 'Keluar';
  points: number;
  orderNumber?: string;
  description: string;
  createdAt: string;
}

export interface PointRewardItem {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  rewardType: 'discount_fixed' | 'free_product' | 'voucher';
  discountValue: number;
  voucherName: string;
  isActive: boolean;
}

export interface StampHistoryItem {
  id: string;
  customerId: string;
  authUid?: string;
  type: 'Masuk' | 'Tukar';
  stampsDelta: number;
  orderNumber?: string;
  rewardTitle?: string;
  description: string;
  createdAt: string;
}

export interface StampRewardItem {
  id: string;
  title: string;
  description: string;
  stampsRequired: number;
  rewardType: 'free_product' | 'discount_fixed';
  discountValue: number;
  productCode?: string;
  isActive: boolean;
}

export type VoucherType =
  | 'Voucher Pelanggan Baru'
  | 'Voucher Referral'
  | 'Voucher Ulang Tahun'
  | 'Voucher Pembelian Kedua'
  | 'Voucher Pelanggan Loyal'
  | 'Voucher Produk Tertentu'
  | 'Voucher Kampanye Promosi';

export interface Voucher {
  id: string;
  name: string;
  code: string;
  type: VoucherType;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minPurchase: number;
  applicableProductCodes: string[]; // empty = all products
  quota: number;
  usedCount: number;
  perUserLimit: number;
  validUntil: string; // YYYY-MM-DD
  isActive: boolean;
  assignedCustomerId?: string; // if personal voucher
  assignedAuthUid?: string;
  usedByCustomerIds: Record<string, number>;
  createdAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerCustomerId: string;
  referrerAuthUid?: string;
  referrerCode: string;
  clicks: number;
  registeredCustomerId?: string;
  registeredCustomerName?: string;
  firstOrderNumber?: string;
  status: 'Klik Tercatat' | 'Terdaftar' | 'Berhasil' | 'Ditinjau';
  referrerRewardPoints: number;
  refereeRewardVoucherValue: number;
  createdAt: string;
  completedAt?: string;
}

export interface ProductShareRecord {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  senderCustomerId: string; // DC-XXXXXX or 'TAMU'
  senderAuthUid?: string;
  senderName: string;
  referralCode: string;
  clicks: number;
  purchases: number;
  totalSales: number;
  lastSharedAt: string;
}

export interface PromoCampaign {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  promoCode?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  targetAudience: 'Semua Pelanggan' | 'Member Club' | 'Pelanggan Baru';
}

export type FraudIndicatorType =
  | 'Banyak Akun Perangkat Sama'
  | 'Referral Tidak Wajar'
  | 'Klaim Transaksi Ganda'
  | 'Penggunaan Voucher Berulang'
  | 'Login Mencurigakan'
  | 'Percobaan Reward Tidak Wajar';

export interface FraudAlert {
  id: string;
  customerId: string;
  customerName: string;
  indicator: FraudIndicatorType;
  reason: string;
  severity: 'Rendah' | 'Sedang' | 'Tinggi';
  status: FraudStatus;
  simulatedDeviceNote: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: 'Admin' | 'Pelanggan' | 'Sistem';
  activityType:
    | 'Pembuatan Akun'
    | 'Reset Password'
    | 'Perubahan Profil'
    | 'Penambahan Poin'
    | 'Pengurangan Poin'
    | 'Penambahan Stempel'
    | 'Penukaran Hadiah'
    | 'Penggunaan Voucher'
    | 'Perubahan Status Akun'
    | 'Perubahan Pesanan'
    | 'Aktivitas Referral'
    | 'Klaim Pesanan Tamu'
    | 'Anti-Fraud Review'
    | 'Pengaturan Sistem';
  description: string;
  createdAt: string;
}

export interface ClubConfig {
  rupiahPerPoint: number; // default 1000
  stampMinSubtotal: number; // default 15000
  stampTarget: number; // default 10
  referralReferrerPoints: number; // default 100
  referralNewCustomerVoucherValue: number; // default 3000
}

export interface ClubSimulationState {
  version: number;
  customers: CustomerAccount[];
  demoCategories: Category[];
  demoProducts: Product[];
  orders: Order[];
  pointHistory: PointHistoryItem[];
  pointRewards: PointRewardItem[];
  stampHistory: StampHistoryItem[];
  stampRewards: StampRewardItem[];
  vouchers: Voucher[];
  referrals: ReferralRecord[];
  productShares: ProductShareRecord[];
  campaigns: PromoCampaign[];
  fraudAlerts: FraudAlert[];
  auditLogs: AuditLogEntry[];
  config: ClubConfig;
  currentDeviceId: string;
}
