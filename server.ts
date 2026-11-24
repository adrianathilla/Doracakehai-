import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  AdminActivityLog,
  AdminRole,
  AdminUserPublic,
  Category,
  DeliveryMethod,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  PublicOrderTrackingView,
  StoreDatabaseState,
  StoreSettings,
  VariantOption,
  WebsiteContentConfig,
  WebsiteSnapshot,
} from './src/types';
import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_WEBSITE_CONTENT,
} from './src/constants/defaultWebsiteContent';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'doracake-db.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const revokedTokens = new Set<string>();

interface StoredAdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  salt: string;
  hash: string;
  createdAt: string;
}

interface AdminAuthStore {
  users: StoredAdminUser[];
}

interface AdminTokenPayload {
  sub: string;
  name: string;
  email: string;
  role: AdminRole;
  jti: string;
  exp: number;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function cloneDefaultWebsite(): WebsiteContentConfig {
  return JSON.parse(JSON.stringify(DEFAULT_WEBSITE_CONTENT)) as WebsiteContentConfig;
}

function readDb(): StoreDatabaseState {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial: StoreDatabaseState = {
      products: [],
      categories: [],
      orders: [],
      settings: { ...DEFAULT_STORE_SETTINGS, updatedAt: new Date().toISOString() },
      websiteDraft: cloneDefaultWebsite(),
      websitePublished: cloneDefaultWebsite(),
      websiteHistory: [],
      activityLogs: [],
      lastSyncedAt: new Date().toISOString(),
    };
    writeDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreDatabaseState>;
    const defaultSite = cloneDefaultWebsite();
    const s = (parsed.settings || {}) as Partial<StoreSettings>;
    const cleanSettings: StoreSettings = {
      storeName: typeof s.storeName === 'string' ? s.storeName : DEFAULT_STORE_SETTINGS.storeName,
      fullName: typeof s.fullName === 'string' ? s.fullName : DEFAULT_STORE_SETTINGS.fullName,
      address: typeof s.address === 'string' ? s.address : DEFAULT_STORE_SETTINGS.address,
      operationalHours:
        typeof s.operationalHours === 'string'
          ? s.operationalHours
          : DEFAULT_STORE_SETTINGS.operationalHours,
      whatsappNumber:
        typeof s.whatsappNumber === 'string'
          ? s.whatsappNumber
          : DEFAULT_STORE_SETTINGS.whatsappNumber,
      contactInfo:
        typeof s.contactInfo === 'string' ? s.contactInfo : DEFAULT_STORE_SETTINGS.contactInfo,
      minFreeShipping:
        typeof s.minFreeShipping === 'number'
          ? s.minFreeShipping
          : DEFAULT_STORE_SETTINGS.minFreeShipping,
      defaultShippingCost:
        typeof s.defaultShippingCost === 'number'
          ? s.defaultShippingCost
          : DEFAULT_STORE_SETTINGS.defaultShippingCost,
      shippingRules:
        typeof s.shippingRules === 'string'
          ? s.shippingRules
          : DEFAULT_STORE_SETTINGS.shippingRules,
      pickupDeliveryStartHour:
        typeof s.pickupDeliveryStartHour === 'string'
          ? s.pickupDeliveryStartHour
          : DEFAULT_STORE_SETTINGS.pickupDeliveryStartHour,
      pickupDeliveryEndHour:
        typeof s.pickupDeliveryEndHour === 'string'
          ? s.pickupDeliveryEndHour
          : DEFAULT_STORE_SETTINGS.pickupDeliveryEndHour,
      cancellationPolicy:
        typeof s.cancellationPolicy === 'string'
          ? s.cancellationPolicy
          : DEFAULT_STORE_SETTINGS.cancellationPolicy,
      paymentInfoText:
        typeof s.paymentInfoText === 'string'
          ? s.paymentInfoText
          : DEFAULT_STORE_SETTINGS.paymentInfoText,
      updatedAt:
        typeof s.updatedAt === 'string' ? s.updatedAt : DEFAULT_STORE_SETTINGS.updatedAt,
    };
    return {
      products: Array.isArray(parsed.products)
        ? parsed.products.map((p) => ({
            ...p,
            isAvailable: typeof p.isAvailable === 'boolean' ? p.isAvailable : p.stock > 0,
          }))
        : [],
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.map((c) => ({
            ...c,
            imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : '',
          }))
        : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      settings: cleanSettings,
      websiteDraft: { ...defaultSite, ...(parsed.websiteDraft || {}) },
      websitePublished: { ...defaultSite, ...(parsed.websitePublished || {}) },
      websiteHistory: Array.isArray(parsed.websiteHistory) ? parsed.websiteHistory : [],
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
      lastSyncedAt: parsed.lastSyncedAt || new Date().toISOString(),
    };
  } catch {
    return {
      products: [],
      categories: [],
      orders: [],
      settings: { ...DEFAULT_STORE_SETTINGS, updatedAt: new Date().toISOString() },
      websiteDraft: cloneDefaultWebsite(),
      websitePublished: cloneDefaultWebsite(),
      websiteHistory: [],
      activityLogs: [],
      lastSyncedAt: new Date().toISOString(),
    };
  }
}

function writeDb(state: StoreDatabaseState): void {
  ensureDataDir();
  state.lastSyncedAt = new Date().toISOString();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function appendActivityLog(
  db: StoreDatabaseState,
  actor: { name: string; email: string },
  action: string,
  target: string,
): void {
  const entry: AdminActivityLog = {
    id: `log_${crypto.randomBytes(6).toString('hex')}`,
    actorName: actor.name,
    actorEmail: actor.email,
    action,
    target,
    createdAt: new Date().toISOString(),
  };
  db.activityLogs.unshift(entry);
  db.activityLogs = db.activityLogs.slice(0, 100);
}

function readAuthStore(): AdminAuthStore {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) {
    return { users: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')) as Record<string, unknown>;
    if (Array.isArray(raw.users)) {
      return { users: raw.users as StoredAdminUser[] };
    }
    // Migrate legacy single-admin record seamlessly
    if (typeof raw.hash === 'string' && typeof raw.salt === 'string') {
      const migrated: StoredAdminUser = {
        id: 'adm_owner',
        name: 'Owner SuperAdmin',
        email: typeof raw.adminEmail === 'string' ? raw.adminEmail : 'adrianathillah@gmail.com',
        role: 'SUPERADMIN',
        isActive: true,
        salt: raw.salt,
        hash: raw.hash,
        createdAt: typeof raw.claimedAt === 'string' ? raw.claimedAt : new Date().toISOString(),
      };
      const store = { users: [migrated] };
      writeAuthStore(store);
      return store;
    }
    return { users: [] };
  } catch {
    return { users: [] };
  }
}

function writeAuthStore(store: AdminAuthStore): void {
  ensureDataDir();
  const tmpFile = `${AUTH_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpFile, AUTH_FILE);
}

function toPublicAdminUser(u: StoredAdminUser): AdminUserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeNumber(value: unknown, min: number, max: number, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function isSafeImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 2_500_000;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeSocialUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim().slice(0, 300);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
    return '';
  } catch {
    return '';
  }
}

function sanitizeVariantList(raw: unknown): VariantOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 30)
    .map((item) => {
      const obj = item as Partial<VariantOption>;
      const name = clampString(obj?.name, 80);
      if (!name) return null;
      return {
        id: isValidId(obj?.id) ? obj.id : `var_${crypto.randomBytes(6).toString('hex')}`,
        name,
        additionalPrice: sanitizeNumber(obj?.additionalPrice, 0, 50_000_000, 0),
        isActive: obj?.isActive !== false,
      };
    })
    .filter((v): v is VariantOption => v !== null);
}

function sanitizeWebsiteContent(
  raw: unknown,
  current: WebsiteContentConfig,
): WebsiteContentConfig {
  const b = (raw || {}) as Partial<WebsiteContentConfig>;
  const validFonts = ['Playfair Display', 'Cormorant Garamond', 'Fraunces'] as const;
  const validSorts = ['recommended', 'newest', 'bestseller', 'price_asc', 'price_desc'] as const;

  const extraSections = Array.isArray(b.extraSections)
    ? b.extraSections.slice(0, 20).map((sec, i) => ({
        id: isValidId(sec?.id) ? sec.id : `sec_${crypto.randomBytes(6).toString('hex')}`,
        type: ['banner', 'testimonial', 'store_info', 'announcement', 'promo_image', 'text'].includes(
          String(sec?.type),
        )
          ? sec.type
          : 'text',
        title: clampString(sec?.title, 160),
        content: clampString(sec?.content, 1000),
        authorOrLabel: clampString(sec?.authorOrLabel, 120),
        imageUrl: isSafeImageUrl(sec?.imageUrl) ? String(sec?.imageUrl || '').trim() : '',
        isActive: sec?.isActive !== false,
        sortOrder: sanitizeNumber(sec?.sortOrder, 0, 999, i + 1),
      }))
    : current.extraSections;

  return {
    ...current,
    storeName: clampString(b.storeName ?? current.storeName, 80) || current.storeName,
    brandName: clampString(b.brandName ?? current.brandName, 140) || current.brandName,
    tagline: clampString(b.tagline ?? current.tagline, 160),
    logoUrl: isSafeImageUrl(b.logoUrl) ? String(b.logoUrl).trim() : current.logoUrl,
    primaryColor: sanitizeColor(b.primaryColor, current.primaryColor),
    secondaryColor: sanitizeColor(b.secondaryColor, current.secondaryColor),
    accentColor: sanitizeColor(b.accentColor, current.accentColor),
    fontFamily: validFonts.includes(b.fontFamily as (typeof validFonts)[number])
      ? (b.fontFamily as WebsiteContentConfig['fontFamily'])
      : current.fontFamily,

    logoSize: ['sm', 'md', 'lg'].includes(String(b.logoSize))
      ? (b.logoSize as WebsiteContentConfig['logoSize'])
      : current.logoSize,
    headerBgColor: sanitizeColor(b.headerBgColor, current.headerBgColor),
    headerTextColor: sanitizeColor(b.headerTextColor, current.headerTextColor),
    navOrder: Array.isArray(b.navOrder)
      ? b.navOrder.filter((k) => ['search', 'tracking', 'cart', 'admin'].includes(k))
      : current.navOrder,
    showSearch: typeof b.showSearch === 'boolean' ? b.showSearch : current.showSearch,
    searchPlaceholder:
      clampString(b.searchPlaceholder ?? current.searchPlaceholder, 120) ||
      current.searchPlaceholder,
    showTracking: typeof b.showTracking === 'boolean' ? b.showTracking : current.showTracking,
    trackingLabel:
      clampString(b.trackingLabel ?? current.trackingLabel, 40) || current.trackingLabel,
    showCart: typeof b.showCart === 'boolean' ? b.showCart : current.showCart,
    cartLabel: clampString(b.cartLabel ?? current.cartLabel, 40) || current.cartLabel,
    showAdminButton:
      typeof b.showAdminButton === 'boolean' ? b.showAdminButton : current.showAdminButton,
    adminButtonLabel:
      clampString(b.adminButtonLabel ?? current.adminButtonLabel, 40) || current.adminButtonLabel,

    heroTitle: clampString(b.heroTitle ?? current.heroTitle, 140) || current.heroTitle,
    heroDescription: clampString(b.heroDescription ?? current.heroDescription, 2000),
    heroImageUrl: isSafeImageUrl(b.heroImageUrl)
      ? String(b.heroImageUrl).trim()
      : current.heroImageUrl,
    heroBgColor: sanitizeColor(b.heroBgColor, current.heroBgColor),
    heroBgImageUrl: isSafeImageUrl(b.heroBgImageUrl)
      ? String(b.heroBgImageUrl).trim()
      : current.heroBgImageUrl,
    heroPromoLabel: clampString(b.heroPromoLabel ?? current.heroPromoLabel, 120),
    heroCtaText: clampString(b.heroCtaText ?? current.heroCtaText, 60) || current.heroCtaText,
    heroCtaEnabled:
      typeof b.heroCtaEnabled === 'boolean' ? b.heroCtaEnabled : current.heroCtaEnabled,
    heroCardKicker: clampString(b.heroCardKicker ?? current.heroCardKicker, 60),
    heroCardTitle: clampString(b.heroCardTitle ?? current.heroCardTitle, 200),
    heroCardSubtitle: clampString(b.heroCardSubtitle ?? current.heroCardSubtitle, 400),
    heroCardCtaText: clampString(b.heroCardCtaText ?? current.heroCardCtaText, 60),
    heroElements: {
      showPromoLabel:
        typeof b.heroElements?.showPromoLabel === 'boolean'
          ? b.heroElements.showPromoLabel
          : current.heroElements.showPromoLabel,
      showDescription:
        typeof b.heroElements?.showDescription === 'boolean'
          ? b.heroElements.showDescription
          : current.heroElements.showDescription,
      showBadges:
        typeof b.heroElements?.showBadges === 'boolean'
          ? b.heroElements.showBadges
          : current.heroElements.showBadges,
      showCta:
        typeof b.heroElements?.showCta === 'boolean'
          ? b.heroElements.showCta
          : current.heroElements.showCta,
      showBannerCard:
        typeof b.heroElements?.showBannerCard === 'boolean'
          ? b.heroElements.showBannerCard
          : current.heroElements.showBannerCard,
    },
    heroElementOrder: Array.isArray(b.heroElementOrder)
      ? b.heroElementOrder.filter((k) =>
          ['promoLabel', 'title', 'description', 'badges', 'cta'].includes(k),
        )
      : current.heroElementOrder,

    freeShippingBadgeText: clampString(
      b.freeShippingBadgeText ?? current.freeShippingBadgeText,
      100,
    ),
    orderSpeedBadgeText: clampString(b.orderSpeedBadgeText ?? current.orderSpeedBadgeText, 100),
    qualityBadgeText: clampString(b.qualityBadgeText ?? current.qualityBadgeText, 100),
    promoBannerEnabled:
      typeof b.promoBannerEnabled === 'boolean'
        ? b.promoBannerEnabled
        : current.promoBannerEnabled,
    promoBannerText: clampString(b.promoBannerText ?? current.promoBannerText, 240),
    promoPeriodText: clampString(b.promoPeriodText ?? current.promoPeriodText, 120),

    catalogKicker: clampString(b.catalogKicker ?? current.catalogKicker, 80),
    catalogTitle:
      clampString(b.catalogTitle ?? current.catalogTitle, 140) || current.catalogTitle,
    catalogDescription: clampString(b.catalogDescription ?? current.catalogDescription, 300),
    tabAllLabel: clampString(b.tabAllLabel ?? current.tabAllLabel, 40) || current.tabAllLabel,
    tabFavoriteLabel:
      clampString(b.tabFavoriteLabel ?? current.tabFavoriteLabel, 40) || current.tabFavoriteLabel,
    showFavoriteTab:
      typeof b.showFavoriteTab === 'boolean' ? b.showFavoriteTab : current.showFavoriteTab,
    cardColumns: [2, 3, 4].includes(Number(b.cardColumns))
      ? (Number(b.cardColumns) as 2 | 3 | 4)
      : current.cardColumns,
    defaultSort: validSorts.includes(b.defaultSort as (typeof validSorts)[number])
      ? (b.defaultSort as WebsiteContentConfig['defaultSort'])
      : current.defaultSort,
    showProductCategory:
      typeof b.showProductCategory === 'boolean'
        ? b.showProductCategory
        : current.showProductCategory,
    showProductDescription:
      typeof b.showProductDescription === 'boolean'
        ? b.showProductDescription
        : current.showProductDescription,
    showProductAvailability:
      typeof b.showProductAvailability === 'boolean'
        ? b.showProductAvailability
        : current.showProductAvailability,
    showPromoStrikePrice:
      typeof b.showPromoStrikePrice === 'boolean'
        ? b.showPromoStrikePrice
        : current.showPromoStrikePrice,

    extraSections,

    footerStoreName:
      clampString(b.footerStoreName ?? current.footerStoreName, 140) || current.footerStoreName,
    footerAddress: clampString(b.footerAddress ?? current.footerAddress, 300),
    footerHours: clampString(b.footerHours ?? current.footerHours, 120),
    footerWhatsapp: clampString(b.footerWhatsapp ?? current.footerWhatsapp, 32),
    footerServiceTitle:
      clampString(b.footerServiceTitle ?? current.footerServiceTitle, 80) ||
      current.footerServiceTitle,
    footerPaymentTitle:
      clampString(b.footerPaymentTitle ?? current.footerPaymentTitle, 80) ||
      current.footerPaymentTitle,
    footerPaymentText: clampString(b.footerPaymentText ?? current.footerPaymentText, 400),
    footerCopyright: clampString(b.footerCopyright ?? current.footerCopyright, 160),
    socialLinks: {
      instagram: isSafeSocialUrl(b.socialLinks?.instagram ?? current.socialLinks.instagram),
      tiktok: isSafeSocialUrl(b.socialLinks?.tiktok ?? current.socialLinks.tiktok),
      facebook: isSafeSocialUrl(b.socialLinks?.facebook ?? current.socialLinks.facebook),
    },

    pageBgColor: sanitizeColor(b.pageBgColor, current.pageBgColor),
    buttonBgColor: sanitizeColor(b.buttonBgColor, current.buttonBgColor),
    buttonTextColor: sanitizeColor(b.buttonTextColor, current.buttonTextColor),
    textColor: sanitizeColor(b.textColor, current.textColor),
    cardRadius: ['md', 'lg', 'xl'].includes(String(b.cardRadius))
      ? (b.cardRadius as WebsiteContentConfig['cardRadius'])
      : current.cardRadius,
    fontSizeScale: ['sm', 'md', 'lg'].includes(String(b.fontSizeScale))
      ? (b.fontSizeScale as WebsiteContentConfig['fontSizeScale'])
      : current.fontSizeScale,
    sectionSpacing: ['compact', 'normal', 'relaxed'].includes(String(b.sectionSpacing))
      ? (b.sectionSpacing as WebsiteContentConfig['sectionSpacing'])
      : current.sectionSpacing,

    updatedAt: new Date().toISOString(),
  };
}

function hashPasscode(passcode: string, salt: string): Buffer {
  return crypto.scryptSync(passcode, salt, 64);
}

function verifySecretConstantTime(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function signAdminToken(user: { id: string; name: string; email: string; role: AdminRole }): string {
  const payload: AdminTokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminToken(token: string): AdminTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  if (!verifySecretConstantTime(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as AdminTokenPayload;
    if (
      (payload.role !== 'SUPERADMIN' && payload.role !== 'ADMIN') ||
      payload.exp < Date.now() ||
      revokedTokens.has(payload.jti)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  admin?: AdminTokenPayload;
}

function requireAdminAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Akses ditolak. Silakan masuk sebagai Admin.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau telah berakhir.' });
    return;
  }
  req.admin = payload;
  next();
}

function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'SUPERADMIN') {
    res.status(403).json({ error: 'Hanya SUPERADMIN yang berwenang melakukan perubahan ini.' });
    return;
  }
  next();
}

function generateOrderNumber(existingOrders: Order[]): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  const used = new Set(existingOrders.map((o) => o.orderNumber));
  for (let attempt = 0; attempt < 30; attempt++) {
    const suffix = String(crypto.randomInt(1000, 10000));
    const candidate = `DC-${datePart}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `DC-${datePart}-${String(Date.now()).slice(-4)}`;
}

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Menunggu Konfirmasi',
  'Dikonfirmasi',
  'Sedang Diproses',
  'Siap Diambil',
  'Dalam Pengiriman',
  'Selesai',
  'Dibatalkan',
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'Belum Dibayar',
  'Menunggu Verifikasi',
  'Lunas',
  'Dibatalkan',
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    const db = readDb();
    res.json({
      ok: true,
      mode: 'firebase',
      firebaseConfigured: true,
      lastSyncedAt: db.lastSyncedAt,
    });
  });

  // --- ADMIN AUTH ---
  app.get('/api/admin/auth/status', (_req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const authStore = readAuthStore();
    const hasUsers = authStore.users.length > 0;
    const primaryUser = authStore.users[0];
    res.json({
      isClaimed: Boolean(envPasscode) || hasUsers,
      usesEnvPasscode: Boolean(envPasscode),
      adminName: primaryUser?.name || 'Owner SuperAdmin',
      adminEmail: primaryUser?.email || 'adrianathillah@gmail.com',
    });
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode) {
      res.status(409).json({ error: 'Passcode admin telah dikonfigurasi di server.' });
      return;
    }
    const authStore = readAuthStore();
    if (authStore.users.length > 0) {
      res.status(409).json({ error: 'Akun SuperAdmin sudah diaktifkan. Silakan login.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const email = clampString(req.body?.email, 160) || 'adrianathillah@gmail.com';
    const name = clampString(req.body?.name, 100) || 'Owner SuperAdmin';
    if (passcode.length < 6 || passcode.length > 128) {
      res.status(400).json({ error: 'Passcode minimal 6 karakter.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPasscode(passcode, salt).toString('hex');
    const owner: StoredAdminUser = {
      id: 'adm_owner',
      name,
      email: email.toLowerCase(),
      role: 'SUPERADMIN',
      isActive: true,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    writeAuthStore({ users: [owner] });
    const db = readDb();
    appendActivityLog(db, { name: owner.name, email: owner.email }, 'Aktivasi Akun', 'SUPERADMIN');
    writeDb(db);

    const token = signAdminToken(owner);
    res.status(201).json({
      token,
      admin: toPublicAdminUser(owner),
    });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const emailInput = clampString(req.body?.email, 160).toLowerCase();
    if (!passcode) {
      res.status(400).json({ error: 'Passcode wajib diisi.' });
      return;
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode && verifySecretConstantTime(passcode, envPasscode)) {
      const user = {
        id: 'adm_env',
        name: 'Owner SuperAdmin',
        email: emailInput || 'adrianathillah@gmail.com',
        role: 'SUPERADMIN' as AdminRole,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const token = signAdminToken(user);
      res.json({ token, admin: user });
      return;
    }

    const authStore = readAuthStore();
    if (authStore.users.length === 0) {
      res.status(400).json({ error: 'Akun SuperAdmin belum diaktifkan.' });
      return;
    }

    const targetUser = emailInput
      ? authStore.users.find((u) => u.email.toLowerCase() === emailInput)
      : authStore.users[0];

    if (!targetUser || !targetUser.isActive) {
      res.status(401).json({ error: 'Akun admin tidak ditemukan atau dinonaktifkan.' });
      return;
    }

    const derived = hashPasscode(passcode, targetUser.salt);
    const stored = Buffer.from(targetUser.hash, 'hex');
    if (derived.length !== stored.length || !crypto.timingSafeEqual(derived, stored)) {
      res.status(401).json({ error: 'Email atau passcode admin salah.' });
      return;
    }

    const token = signAdminToken(targetUser);
    res.json({ token, admin: toPublicAdminUser(targetUser) });
  });

  app.get('/api/admin/auth/me', requireAdminAuth, (req: AuthedRequest, res) => {
    res.json({
      admin: {
        id: req.admin!.sub,
        name: req.admin!.name,
        email: req.admin!.email,
        role: req.admin!.role,
        isActive: true,
        createdAt: '',
      },
    });
  });

  app.post('/api/admin/auth/logout', requireAdminAuth, (req: AuthedRequest, res) => {
    if (req.admin?.jti) {
      revokedTokens.add(req.admin.jti);
    }
    res.json({ ok: true });
  });

  // --- PUBLIC STOREFRONT (NO admin email, NO internal stock counts, NO logs, NO draft) ---
  app.get('/api/storefront', (_req, res) => {
    const db = readDb();
    const activeCategories = db.categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Strip sensitive internal stock counts from customer-facing product payload
    const publicProducts = db.products
      .filter((p) => p.isActive)
      .map((p) => ({
        ...p,
        isAvailable: p.isAvailable && p.stock > 0,
        stock: p.isAvailable && p.stock > 0 ? 1 : 0, // Customer only knows available (1) or out (0)
      }));

    res.json({
      categories: activeCategories,
      products: publicProducts,
      settings: db.settings,
      website: db.websitePublished,
    });
  });

  app.post('/api/orders', (req, res) => {
    const body = req.body || {};
    const customerName = clampString(body.customerName, 120);
    const customerPhone = clampString(body.customerPhone, 25);
    const deliveryMethod: DeliveryMethod = body.deliveryMethod === 'Ambil' ? 'Ambil' : 'Antar';
    const customerAddress = clampString(body.customerAddress, 400);
    const orderDate = clampString(body.orderDate, 20);
    const pickupDeliveryTime = clampString(body.pickupDeliveryTime, 10);
    const notes = clampString(body.notes, 500);
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Nama pelanggan minimal 2 karakter.' });
      return;
    }
    if (!/^[+0-9\s-]{8,20}$/.test(customerPhone)) {
      res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
      return;
    }
    if (deliveryMethod === 'Antar' && customerAddress.length < 5) {
      res.status(400).json({ error: 'Alamat lengkap wajib diisi untuk metode Antar.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
      res.status(400).json({ error: 'Format tanggal pemesanan tidak valid.' });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(pickupDeliveryTime)) {
      res.status(400).json({ error: 'Format jam pengambilan/pengiriman tidak valid.' });
      return;
    }

    const db = readDb();
    const startHour = db.settings.pickupDeliveryStartHour || '08:00';
    const endHour = db.settings.pickupDeliveryEndHour || '18:00';
    if (pickupDeliveryTime < startHour || pickupDeliveryTime > endHour) {
      res.status(400).json({
        error: `Jam pengambilan/pengiriman hanya tersedia pukul ${startHour}–${endHour} WIB.`,
      });
      return;
    }

    if (rawItems.length === 0 || rawItems.length > 50) {
      res.status(400).json({ error: 'Keranjang belanja kosong atau melebihi batas item.' });
      return;
    }

    const orderItems: OrderItem[] = [];
    for (const rawItem of rawItems) {
      const productId = clampString(rawItem?.productId, 128);
      const quantity = sanitizeNumber(rawItem?.quantity, 1, 100, 0);
      const itemNotes = clampString(rawItem?.notes, 250);
      if (!productId || quantity < 1) {
        res.status(400).json({ error: 'Item pesanan tidak valid.' });
        return;
      }

      const product = db.products.find((p) => p.id === productId && p.isActive);
      if (!product || !product.isAvailable || product.stock <= 0) {
        res.status(400).json({ error: 'Produk tidak tersedia atau stok sedang habis.' });
        return;
      }
      if (product.stock < quantity) {
        res.status(400).json({
          error: `Jumlah pesanan untuk "${product.name}" melebihi ketersediaan hari ini.`,
        });
        return;
      }

      const baseUnitPrice =
        product.promoPrice !== null && product.promoPrice > 0 && product.promoPrice < product.price
          ? product.promoPrice
          : product.price;

      const selectedFlavorId = rawItem?.selectedVariants?.flavor?.id;
      const selectedToppingId = rawItem?.selectedVariants?.topping?.id;
      const selectedGlazeId = rawItem?.selectedVariants?.glaze?.id;

      const flavor = selectedFlavorId
        ? product.variants.flavors.find((f) => f.id === selectedFlavorId && f.isActive) || null
        : null;
      const topping = selectedToppingId
        ? product.variants.toppings.find((t) => t.id === selectedToppingId && t.isActive) || null
        : null;
      const glaze = selectedGlazeId
        ? product.variants.glazes.find((g) => g.id === selectedGlazeId && g.isActive) || null
        : null;

      const extraPrice =
        (flavor?.additionalPrice || 0) +
        (topping?.additionalPrice || 0) +
        (glaze?.additionalPrice || 0);
      const unitPrice = baseUnitPrice + extraPrice;
      const subtotal = unitPrice * quantity;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        baseUnitPrice,
        selectedVariants: { flavor, topping, glaze },
        unitPrice,
        quantity,
        subtotal,
        notes: itemNotes,
      });
    }

    for (const item of orderItems) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
        if (prod.stock === 0) prod.isAvailable = false;
        prod.updatedAt = new Date().toISOString();
      }
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const shippingCost =
      deliveryMethod === 'Ambil'
        ? 0
        : subtotal >= db.settings.minFreeShipping
          ? 0
          : db.settings.defaultShippingCost;
    const total = subtotal + shippingCost;
    const nowIso = new Date().toISOString();

    const orderNumber = generateOrderNumber(db.orders);
    const newOrder: Order = {
      id: `ord_${crypto.randomBytes(8).toString('hex')}`,
      orderNumber,
      customerId: `cust_${crypto.randomBytes(6).toString('hex')}`,
      customerName,
      customerPhone,
      customerAddress:
        deliveryMethod === 'Ambil' ? `Ambil di Toko (${db.settings.address})` : customerAddress,
      deliveryMethod,
      orderDate,
      pickupDeliveryTime,
      notes,
      items: orderItems,
      subtotal,
      shippingCost,
      total,
      paymentMethod: db.settings.paymentInfoText,
      paymentStatus: 'Belum Dibayar',
      orderStatus: 'Menunggu Konfirmasi',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.orders.unshift(newOrder);
    writeDb(db);
    res.status(201).json({ order: newOrder });
  });

  app.get('/api/orders/track/:orderNumber', (req, res) => {
    const rawCode = clampString(req.params.orderNumber, 32).toUpperCase();
    if (!/^DC-\d{8}-\d{4}$/.test(rawCode)) {
      res.status(400).json({ error: 'Format nomor pesanan harus DC-YYYYMMDD-XXXX.' });
      return;
    }
    const db = readDb();
    const found = db.orders.find((o) => o.orderNumber.toUpperCase() === rawCode);
    if (!found) {
      res.status(404).json({ error: 'Pesanan dengan nomor tersebut tidak ditemukan.' });
      return;
    }
    const publicView: PublicOrderTrackingView = {
      orderNumber: found.orderNumber,
      customerName: found.customerName,
      deliveryMethod: found.deliveryMethod,
      orderDate: found.orderDate,
      pickupDeliveryTime: found.pickupDeliveryTime,
      items: found.items,
      subtotal: found.subtotal,
      shippingCost: found.shippingCost,
      total: found.total,
      paymentMethod: found.paymentMethod,
      paymentStatus: found.paymentStatus,
      orderStatus: found.orderStatus,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };
    res.json({ tracking: publicView });
  });

  // --- ADMIN PROTECTED ENDPOINTS ---
  app.get('/api/admin/dashboard-data', requireAdminAuth, (_req, res) => {
    const db = readDb();
    res.json(db);
  });

  // Categories CRUD
  app.post('/api/admin/categories', requireAdminAuth, (req: AuthedRequest, res) => {
    const name = clampString(req.body?.name, 100);
    const description = clampString(req.body?.description, 400);
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const sortOrder = sanitizeNumber(req.body?.sortOrder, 0, 9999, 0);
    const isActive = req.body?.isActive !== false;
    if (name.length < 2) {
      res.status(400).json({ error: 'Nama kategori minimal 2 karakter.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'URL gambar kategori tidak valid.' });
      return;
    }
    const db = readDb();
    const now = new Date().toISOString();
    const category: Category = {
      id: `cat_${crypto.randomBytes(6).toString('hex')}`,
      name,
      description,
      imageUrl,
      sortOrder: sortOrder || db.categories.length + 1,
      isActive,
      createdAt: now,
      updatedAt: now,
    };
    db.categories.push(category);
    appendActivityLog(db, req.admin!, 'Tambah Kategori', name);
    writeDb(db);
    res.status(201).json({ category });
  });

  app.put('/api/admin/categories/:id', requireAdminAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID kategori tidak valid.' });
      return;
    }
    const db = readDb();
    const idx = db.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Kategori tidak ditemukan.' });
      return;
    }
    const current = db.categories[idx];
    const name = clampString(req.body?.name ?? current.name, 100);
    const imageUrl =
      req.body?.imageUrl !== undefined ? String(req.body.imageUrl).trim() : current.imageUrl;
    if (name.length < 2 || !isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Nama atau URL gambar kategori tidak valid.' });
      return;
    }
    db.categories[idx] = {
      ...current,
      name,
      description: clampString(req.body?.description ?? current.description, 400),
      imageUrl,
      sortOrder: sanitizeNumber(
        req.body?.sortOrder ?? current.sortOrder,
        0,
        9999,
        current.sortOrder,
      ),
      isActive: typeof req.body?.isActive === 'boolean' ? req.body.isActive : current.isActive,
      updatedAt: new Date().toISOString(),
    };
    appendActivityLog(db, req.admin!, 'Perbarui Kategori', name);
    writeDb(db);
    res.json({ category: db.categories[idx] });
  });

  app.delete('/api/admin/categories/:id', requireAdminAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID kategori tidak valid.' });
      return;
    }
    const db = readDb();
    const found = db.categories.find((c) => c.id === id);
    db.categories = db.categories.filter((c) => c.id !== id);
    if (found) appendActivityLog(db, req.admin!, 'Hapus Kategori', found.name);
    writeDb(db);
    res.json({ ok: true });
  });

  // Products CRUD
  app.post('/api/admin/products', requireAdminAuth, (req: AuthedRequest, res) => {
    const body = req.body || {};
    const name = clampString(body.name, 160);
    const description = clampString(body.description, 2000);
    const categoryId = clampString(body.categoryId, 128);
    const price = sanitizeNumber(body.price, 0, 100_000_000, -1);
    const promoRaw = body.promoPrice;
    const promoPrice =
      promoRaw === null || promoRaw === '' || promoRaw === undefined
        ? null
        : sanitizeNumber(promoRaw, 0, 100_000_000, 0);
    const stock = sanitizeNumber(body.stock, 0, 100_000, 0);
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';

    if (name.length < 2) {
      res.status(400).json({ error: 'Nama produk minimal 2 karakter.' });
      return;
    }
    if (price <= 0) {
      res.status(400).json({ error: 'Harga produk harus lebih dari 0.' });
      return;
    }
    if (promoPrice !== null && promoPrice >= price) {
      res.status(400).json({ error: 'Harga promo harus lebih rendah dari harga normal.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'URL gambar tidak valid atau format tidak didukung.' });
      return;
    }

    const db = readDb();
    const now = new Date().toISOString();
    const product: Product = {
      id: `prd_${crypto.randomBytes(6).toString('hex')}`,
      productCode: clampString(body.productCode || '', 24).toUpperCase() || undefined,
      isStampEligible: body.isStampEligible !== false,
      name,
      description,
      categoryId,
      price,
      promoPrice,
      stock,
      isAvailable: typeof body.isAvailable === 'boolean' ? body.isAvailable : stock > 0,
      imageUrl,
      isActive: body.isActive !== false,
      isFavorite: Boolean(body.isFavorite),
      isNewest: Boolean(body.isNewest),
      isBestSeller: Boolean(body.isBestSeller),
      variants: {
        flavors: sanitizeVariantList(body.variants?.flavors),
        toppings: sanitizeVariantList(body.variants?.toppings),
        glazes: sanitizeVariantList(body.variants?.glazes),
      },
      createdAt: now,
      updatedAt: now,
    };
    db.products.unshift(product);
    appendActivityLog(db, req.admin!, 'Tambah Produk', name);
    writeDb(db);
    res.status(201).json({ product });
  });

  app.put('/api/admin/products/:id', requireAdminAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID produk tidak valid.' });
      return;
    }
    const db = readDb();
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }
    const current = db.products[idx];
    const body = req.body || {};
    const name = clampString(body.name ?? current.name, 160);
    const price = sanitizeNumber(body.price ?? current.price, 0, 100_000_000, current.price);
    const promoRaw = body.promoPrice !== undefined ? body.promoPrice : current.promoPrice;
    const promoPrice =
      promoRaw === null || promoRaw === '' || promoRaw === 0
        ? null
        : sanitizeNumber(promoRaw, 0, 100_000_000, 0);
    const imageUrl =
      body.imageUrl !== undefined ? String(body.imageUrl).trim() : current.imageUrl;

    if (name.length < 2) {
      res.status(400).json({ error: 'Nama produk minimal 2 karakter.' });
      return;
    }
    if (price <= 0) {
      res.status(400).json({ error: 'Harga produk harus lebih dari 0.' });
      return;
    }
    if (promoPrice !== null && promoPrice >= price) {
      res.status(400).json({ error: 'Harga promo harus lebih rendah dari harga normal.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'URL gambar tidak valid.' });
      return;
    }

    const nextStock = sanitizeNumber(body.stock ?? current.stock, 0, 100_000, current.stock);
    db.products[idx] = {
      ...current,
      productCode:
        body.productCode !== undefined
          ? clampString(body.productCode, 24).toUpperCase() || undefined
          : current.productCode,
      isStampEligible:
        typeof body.isStampEligible === 'boolean' ? body.isStampEligible : current.isStampEligible,
      name,
      description: clampString(body.description ?? current.description, 2000),
      categoryId: clampString(body.categoryId ?? current.categoryId, 128),
      price,
      promoPrice,
      stock: nextStock,
      isAvailable:
        typeof body.isAvailable === 'boolean' ? body.isAvailable : current.isAvailable,
      imageUrl,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : current.isActive,
      isFavorite: typeof body.isFavorite === 'boolean' ? body.isFavorite : current.isFavorite,
      isNewest: typeof body.isNewest === 'boolean' ? body.isNewest : current.isNewest,
      isBestSeller: typeof body.isBestSeller === 'boolean' ? body.isBestSeller : current.isBestSeller,
      variants: body.variants
        ? {
            flavors: sanitizeVariantList(body.variants.flavors),
            toppings: sanitizeVariantList(body.variants.toppings),
            glazes: sanitizeVariantList(body.variants.glazes),
          }
        : current.variants,
      updatedAt: new Date().toISOString(),
    };
    appendActivityLog(db, req.admin!, 'Perbarui Produk', name);
    writeDb(db);
    res.json({ product: db.products[idx] });
  });

  app.delete('/api/admin/products/:id', requireAdminAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID produk tidak valid.' });
      return;
    }
    const db = readDb();
    const found = db.products.find((p) => p.id === id);
    db.products = db.products.filter((p) => p.id !== id);
    if (found) appendActivityLog(db, req.admin!, 'Hapus Produk', found.name);
    writeDb(db);
    res.json({ ok: true });
  });

  // Orders Admin Update
  app.patch('/api/admin/orders/:id', requireAdminAuth, (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID pesanan tidak valid.' });
      return;
    }
    const db = readDb();
    const idx = db.orders.findIndex((o) => o.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const order = db.orders[idx];
    const nextOrderStatus = req.body?.orderStatus as OrderStatus | undefined;
    const nextPaymentStatus = req.body?.paymentStatus as PaymentStatus | undefined;

    if (nextOrderStatus && !VALID_ORDER_STATUSES.includes(nextOrderStatus)) {
      res.status(400).json({ error: 'Status pesanan tidak valid.' });
      return;
    }
    if (nextPaymentStatus && !VALID_PAYMENT_STATUSES.includes(nextPaymentStatus)) {
      res.status(400).json({ error: 'Status pembayaran tidak valid.' });
      return;
    }

    const wasCancelled = order.orderStatus === 'Dibatalkan';
    const willCancel = nextOrderStatus === 'Dibatalkan';

    if (!wasCancelled && willCancel) {
      for (const item of order.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stock += item.quantity;
          prod.isAvailable = prod.stock > 0;
        }
      }
    }

    order.orderStatus = nextOrderStatus || order.orderStatus;
    order.paymentStatus =
      willCancel && !nextPaymentStatus ? 'Dibatalkan' : nextPaymentStatus || order.paymentStatus;
    order.updatedAt = new Date().toISOString();

    appendActivityLog(
      db,
      req.admin!,
      'Perbarui Status Pesanan',
      `${order.orderNumber} (${order.orderStatus} / ${order.paymentStatus})`,
    );
    writeDb(db);
    res.json({ order });
  });

  // --- WEBSITE EDITOR (SUPERADMIN ONLY: Draft / Publish / Discard / Restore) ---
  app.put(
    '/api/admin/website/draft',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const db = readDb();
      db.websiteDraft = sanitizeWebsiteContent(req.body, db.websiteDraft);
      appendActivityLog(db, req.admin!, 'Simpan Draft Website', 'Editor Website');
      writeDb(db);
      res.json({ websiteDraft: db.websiteDraft });
    },
  );

  app.post(
    '/api/admin/website/publish',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const db = readDb();
      if (req.body && Object.keys(req.body).length > 0) {
        db.websiteDraft = sanitizeWebsiteContent(req.body, db.websiteDraft);
      }
      const snapshot: WebsiteSnapshot = {
        id: `snap_${crypto.randomBytes(6).toString('hex')}`,
        savedAt: new Date().toISOString(),
        savedBy: req.admin!.name,
        note: clampString(req.body?.note, 160) || 'Publikasi perubahan website',
        content: JSON.parse(JSON.stringify(db.websitePublished)) as WebsiteContentConfig,
      };
      db.websiteHistory.unshift(snapshot);
      db.websiteHistory = db.websiteHistory.slice(0, 15);
      db.websitePublished = JSON.parse(JSON.stringify(db.websiteDraft)) as WebsiteContentConfig;
      db.websitePublished.updatedAt = new Date().toISOString();

      // Sync shared footer/identity fields to store settings seamlessly
      db.settings.storeName = db.websitePublished.storeName;
      db.settings.fullName = db.websitePublished.brandName;
      db.settings.address = db.websitePublished.footerAddress || db.settings.address;
      db.settings.operationalHours = db.websitePublished.footerHours || db.settings.operationalHours;
      db.settings.whatsappNumber =
        db.websitePublished.footerWhatsapp || db.settings.whatsappNumber;
      db.settings.paymentInfoText =
        db.websitePublished.footerPaymentText || db.settings.paymentInfoText;
      db.settings.updatedAt = new Date().toISOString();

      appendActivityLog(db, req.admin!, 'Publikasikan Website', 'Panel Pelanggan');
      writeDb(db);
      res.json({
        websiteDraft: db.websiteDraft,
        websitePublished: db.websitePublished,
        websiteHistory: db.websiteHistory,
        settings: db.settings,
      });
    },
  );

  app.post(
    '/api/admin/website/discard',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const db = readDb();
      db.websiteDraft = JSON.parse(JSON.stringify(db.websitePublished)) as WebsiteContentConfig;
      appendActivityLog(db, req.admin!, 'Batalkan Perubahan Draft', 'Editor Website');
      writeDb(db);
      res.json({ websiteDraft: db.websiteDraft });
    },
  );

  app.post(
    '/api/admin/website/restore/:snapshotId',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const snapshotId = req.params.snapshotId;
      if (!isValidId(snapshotId)) {
        res.status(400).json({ error: 'ID snapshot tidak valid.' });
        return;
      }
      const db = readDb();
      const snap = db.websiteHistory.find((s) => s.id === snapshotId);
      if (!snap) {
        res.status(404).json({ error: 'Versi cadangan tidak ditemukan.' });
        return;
      }
      db.websiteDraft = JSON.parse(JSON.stringify(snap.content)) as WebsiteContentConfig;
      db.websitePublished = JSON.parse(JSON.stringify(snap.content)) as WebsiteContentConfig;
      appendActivityLog(db, req.admin!, 'Pulihkan Versi Website', snap.savedAt);
      writeDb(db);
      res.json({ websiteDraft: db.websiteDraft, websitePublished: db.websitePublished });
    },
  );

  // --- PENGATURAN TOKO ---
  app.put(
    '/api/admin/settings',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const body = req.body || {};
      const db = readDb();
      const nextSettings: StoreSettings = {
        ...db.settings,
        storeName: clampString(body.storeName ?? db.settings.storeName, 100) || db.settings.storeName,
        fullName: clampString(body.fullName ?? db.settings.fullName, 160) || db.settings.fullName,
        address: clampString(body.address ?? db.settings.address, 400) || db.settings.address,
        operationalHours:
          clampString(body.operationalHours ?? db.settings.operationalHours, 120) ||
          db.settings.operationalHours,
        whatsappNumber:
          clampString(body.whatsappNumber ?? db.settings.whatsappNumber, 32) ||
          db.settings.whatsappNumber,
        contactInfo: clampString(body.contactInfo ?? db.settings.contactInfo, 300),
        minFreeShipping: sanitizeNumber(
          body.minFreeShipping ?? db.settings.minFreeShipping,
          0,
          50_000_000,
          db.settings.minFreeShipping,
        ),
        defaultShippingCost: sanitizeNumber(
          body.defaultShippingCost ?? db.settings.defaultShippingCost,
          0,
          10_000_000,
          db.settings.defaultShippingCost,
        ),
        shippingRules: clampString(body.shippingRules ?? db.settings.shippingRules, 500),
        pickupDeliveryStartHour:
          clampString(body.pickupDeliveryStartHour ?? db.settings.pickupDeliveryStartHour, 10) ||
          '08:00',
        pickupDeliveryEndHour:
          clampString(body.pickupDeliveryEndHour ?? db.settings.pickupDeliveryEndHour, 10) ||
          '18:00',
        cancellationPolicy:
          clampString(body.cancellationPolicy ?? db.settings.cancellationPolicy, 500) ||
          db.settings.cancellationPolicy,
        paymentInfoText:
          clampString(body.paymentInfoText ?? db.settings.paymentInfoText, 500) ||
          db.settings.paymentInfoText,
        updatedAt: new Date().toISOString(),
      };
      db.settings = nextSettings;
      // Keep published & draft storefront contact synced with store settings
      for (const target of [db.websitePublished, db.websiteDraft]) {
        target.storeName = nextSettings.storeName;
        target.brandName = nextSettings.fullName;
        target.footerStoreName = nextSettings.fullName;
        target.footerAddress = nextSettings.address;
        target.footerHours = nextSettings.operationalHours;
        target.footerWhatsapp = nextSettings.whatsappNumber;
        target.footerPaymentText = nextSettings.paymentInfoText;
      }

      appendActivityLog(db, req.admin!, 'Perbarui Pengaturan Toko', nextSettings.fullName);
      writeDb(db);
      res.json({ settings: db.settings });
    },
  );

  // --- PENGATURAN ADMIN (No plaintext passwords!) ---
  app.get('/api/admin/users', requireAdminAuth, requireSuperAdmin, (_req, res) => {
    const authStore = readAuthStore();
    res.json({ users: authStore.users.map(toPublicAdminUser) });
  });

  app.put('/api/admin/users/me', requireAdminAuth, (req: AuthedRequest, res) => {
    const authStore = readAuthStore();
    const idx = authStore.users.findIndex((u) => u.id === req.admin!.sub);
    if (idx === -1) {
      res.status(404).json({ error: 'Profil admin tidak ditemukan.' });
      return;
    }
    const current = authStore.users[idx];
    const name = clampString(req.body?.name ?? current.name, 100);
    const email = clampString(req.body?.email ?? current.email, 160).toLowerCase();
    const newPasscode =
      typeof req.body?.newPasscode === 'string' ? req.body.newPasscode.trim() : '';

    if (name.length < 2 || !email.includes('@')) {
      res.status(400).json({ error: 'Nama atau email tidak valid.' });
      return;
    }

    if (newPasscode) {
      if (newPasscode.length < 6 || newPasscode.length > 128) {
        res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
        return;
      }
      const salt = crypto.randomBytes(16).toString('hex');
      current.salt = salt;
      current.hash = hashPasscode(newPasscode, salt).toString('hex');
    }

    current.name = name;
    current.email = email;
    authStore.users[idx] = current;
    writeAuthStore(authStore);

    const db = readDb();
    appendActivityLog(db, { name, email }, 'Perbarui Akun Admin', email);
    writeDb(db);

    const token = signAdminToken(current);
    res.json({ token, admin: toPublicAdminUser(current) });
  });

  app.post('/api/admin/users', requireAdminAuth, requireSuperAdmin, (req: AuthedRequest, res) => {
    const name = clampString(req.body?.name, 100);
    const email = clampString(req.body?.email, 160).toLowerCase();
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const role: AdminRole = req.body?.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN';

    if (name.length < 2 || !email.includes('@') || passcode.length < 6) {
      res.status(400).json({ error: 'Nama, email valid, dan password minimal 6 karakter wajib diisi.' });
      return;
    }

    const authStore = readAuthStore();
    if (authStore.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email admin tersebut sudah terdaftar.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPasscode(passcode, salt).toString('hex');
    const newUser: StoredAdminUser = {
      id: `adm_${crypto.randomBytes(6).toString('hex')}`,
      name,
      email,
      role,
      isActive: true,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    authStore.users.push(newUser);
    writeAuthStore(authStore);

    const db = readDb();
    appendActivityLog(db, req.admin!, 'Tambah Akun Admin', `${email} (${role})`);
    writeDb(db);

    res.status(201).json({ user: toPublicAdminUser(newUser) });
  });

  app.patch(
    '/api/admin/users/:id',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const id = req.params.id;
      if (!isValidId(id)) {
        res.status(400).json({ error: 'ID admin tidak valid.' });
        return;
      }
      const authStore = readAuthStore();
      const idx = authStore.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
        return;
      }
      if (authStore.users[idx].id === req.admin!.sub && req.body?.isActive === false) {
        res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
        return;
      }
      if (req.body?.role === 'SUPERADMIN' || req.body?.role === 'ADMIN') {
        authStore.users[idx].role = req.body.role;
      }
      if (typeof req.body?.isActive === 'boolean') {
        authStore.users[idx].isActive = req.body.isActive;
      }
      writeAuthStore(authStore);

      const db = readDb();
      appendActivityLog(
        db,
        req.admin!,
        'Ubah Hak Akses Admin',
        `${authStore.users[idx].email} (${authStore.users[idx].role})`,
      );
      writeDb(db);

      res.json({ user: toPublicAdminUser(authStore.users[idx]) });
    },
  );

  app.delete(
    '/api/admin/users/:id',
    requireAdminAuth,
    requireSuperAdmin,
    (req: AuthedRequest, res) => {
      const id = req.params.id;
      if (!isValidId(id) || id === req.admin!.sub) {
        res.status(400).json({ error: 'Tidak dapat menghapus akun yang sedang aktif.' });
        return;
      }
      const authStore = readAuthStore();
      const target = authStore.users.find((u) => u.id === id);
      authStore.users = authStore.users.filter((u) => u.id !== id);
      writeAuthStore(authStore);

      const db = readDb();
      if (target) appendActivityLog(db, req.admin!, 'Hapus Akun Admin', target.email);
      writeDb(db);
      res.json({ ok: true });
    },
  );

  // --- DATABASE BACKUP & RESTORE (No secrets, no hashes) ---
  app.get('/api/admin/backup', requireAdminAuth, requireSuperAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    appendActivityLog(db, req.admin!, 'Ekspor Backup Database', 'JSON Backup');
    writeDb(db);
    res.json({
      exportedAt: new Date().toISOString(),
      version: 2,
      data: {
        products: db.products,
        categories: db.categories,
        orders: db.orders,
        settings: db.settings,
        websiteDraft: db.websiteDraft,
        websitePublished: db.websitePublished,
        websiteHistory: db.websiteHistory,
      },
    });
  });

  app.post('/api/admin/restore', requireAdminAuth, requireSuperAdmin, (req: AuthedRequest, res) => {
    const payload = req.body?.data || req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Format file backup tidak valid.' });
      return;
    }
    const current = readDb();
    const restored: StoreDatabaseState = {
      products: Array.isArray(payload.products) ? payload.products : current.products,
      categories: Array.isArray(payload.categories) ? payload.categories : current.categories,
      orders: Array.isArray(payload.orders) ? payload.orders : current.orders,
      settings: payload.settings ? { ...current.settings, ...payload.settings } : current.settings,
      websiteDraft: payload.websiteDraft
        ? sanitizeWebsiteContent(payload.websiteDraft, current.websiteDraft)
        : current.websiteDraft,
      websitePublished: payload.websitePublished
        ? sanitizeWebsiteContent(payload.websitePublished, current.websitePublished)
        : current.websitePublished,
      websiteHistory: Array.isArray(payload.websiteHistory)
        ? payload.websiteHistory
        : current.websiteHistory,
      activityLogs: current.activityLogs,
      lastSyncedAt: new Date().toISOString(),
    };
    appendActivityLog(restored, req.admin!, 'Pulihkan Backup Database', 'JSON Restore');
    writeDb(restored);
    res.json({ ok: true, db: restored });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DoraCake server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
