import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  DocumentData,
  QuerySnapshot,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_STORE_SETTINGS,
  DEFAULT_WEBSITE_CONTENT,
} from '../constants/defaultWebsiteContent';
import {
  OperationType,
  PRIMARY_OWNER_EMAIL,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  secondaryAuth,
} from '../firebase';
import {
  AdminActivityLog,
  AdminInvite,
  AdminRole,
  AdminUserPublic,
  AppNotification,
  AuditLogEntry,
  CartItem,
  Category,
  ClubConfig,
  CustomerAccount,
  CustomerAccountStatus,
  DeliveryMethod,
  FraudAlert,
  FraudStatus,
  NotificationCategory,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  PointHistoryItem,
  PointRewardItem,
  Product,
  ProductShareRecord,
  PromoCampaign,
  PublicOrderTrackingView,
  ReferralRecord,
  StampHistoryItem,
  StampRewardItem,
  StoreSettings,
  Voucher,
  WebsiteContentConfig,
  WebsiteSnapshot,
} from '../types';
import { normalizePhoneKey } from '../utils/format';
import {
  DEFAULT_CLUB_CONFIG,
  computeMemberTier,
  customerUsernameToAuthEmail,
  generateNextCustomerId,
  generateOrderNumber,
  normalizeUsername,
  validateVoucherForCart,
} from './clubStore';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return input;
}

export function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null) {
    const maybe = val as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toISOString();
    }
    if (typeof maybe.seconds === 'number') {
      return new Date(maybe.seconds * 1000).toISOString();
    }
  }
  return new Date().toISOString();
}

function snapToArray<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>;
    const normalized: Record<string, unknown> = { id: d.id, ...raw };
    if ('createdAt' in normalized) normalized.createdAt = tsToIso(normalized.createdAt);
    if ('updatedAt' in normalized) normalized.updatedAt = tsToIso(normalized.updatedAt);
    if ('savedAt' in normalized) normalized.savedAt = tsToIso(normalized.savedAt);
    if ('lastSharedAt' in normalized) normalized.lastSharedAt = tsToIso(normalized.lastSharedAt);
    if ('completedAt' in normalized && normalized.completedAt) {
      normalized.completedAt = tsToIso(normalized.completedAt);
    }
    if ('reviewedAt' in normalized && normalized.reviewedAt) {
      normalized.reviewedAt = tsToIso(normalized.reviewedAt);
    }
    return normalized as T;
  });
}

function normalizeStoreSettings(raw: Partial<StoreSettings> | undefined): StoreSettings {
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...(raw || {}),
    updatedAt: tsToIso(raw?.updatedAt),
  };
}

function normalizeWebsiteContent(raw: Partial<WebsiteContentConfig> | undefined): WebsiteContentConfig {
  const merged = {
    ...DEFAULT_WEBSITE_CONTENT,
    ...(raw || {}),
    heroElements: {
      ...DEFAULT_WEBSITE_CONTENT.heroElements,
      ...(raw?.heroElements || {}),
    },
    socialLinks: {
      ...DEFAULT_WEBSITE_CONTENT.socialLinks,
      ...(raw?.socialLinks || {}),
    },
    extraSections: Array.isArray(raw?.extraSections) ? raw.extraSections : [],
    navOrder: Array.isArray(raw?.navOrder) && raw.navOrder.length > 0
      ? raw.navOrder
      : DEFAULT_WEBSITE_CONTENT.navOrder,
    heroElementOrder:
      Array.isArray(raw?.heroElementOrder) && raw.heroElementOrder.length > 0
        ? raw.heroElementOrder
        : DEFAULT_WEBSITE_CONTENT.heroElementOrder,
    updatedAt: tsToIso(raw?.updatedAt),
  };
  return merged;
}

function normalizeClubConfig(raw: Partial<ClubConfig> | undefined): ClubConfig {
  return {
    rupiahPerPoint: Number(raw?.rupiahPerPoint) > 0 ? Number(raw?.rupiahPerPoint) : DEFAULT_CLUB_CONFIG.rupiahPerPoint,
    stampMinSubtotal: Number(raw?.stampMinSubtotal) >= 0 ? Number(raw?.stampMinSubtotal) : DEFAULT_CLUB_CONFIG.stampMinSubtotal,
    stampTarget: Number(raw?.stampTarget) > 0 ? Number(raw?.stampTarget) : DEFAULT_CLUB_CONFIG.stampTarget,
    referralReferrerPoints: Number(raw?.referralReferrerPoints) >= 0 ? Number(raw?.referralReferrerPoints) : DEFAULT_CLUB_CONFIG.referralReferrerPoints,
    referralNewCustomerVoucherValue: Number(raw?.referralNewCustomerVoucherValue) >= 0 ? Number(raw?.referralNewCustomerVoucherValue) : DEFAULT_CLUB_CONFIG.referralNewCustomerVoucherValue,
  };
}

// ==========================================================
// AUTHENTICATION: ADMIN (GOOGLE) & CUSTOMER (USERNAME+PASSWORD)
// ==========================================================

export async function signInAdminWithGoogle(): Promise<AdminUserPublic> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    await signOut(auth);
    throw new Error('Akun Google tidak memiliki alamat email yang terverifikasi.');
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data() as AdminUserPublic;
    if (!data.isActive) {
      await signOut(auth);
      throw new Error('Akun Admin ini sedang dinonaktifkan oleh SuperAdmin.');
    }
    return {
      ...data,
      id: userSnap.id,
      createdAt: tsToIso(data.createdAt),
    };
  }

  // Belum punya profil di /users: cek Primary Owner atau Admin Invite
  const isOwner = email === PRIMARY_OWNER_EMAIL.toLowerCase();
  let role: AdminRole = 'ADMIN';
  let displayName = user.displayName || 'Admin DoraCake';

  if (isOwner) {
    role = 'SUPERADMIN';
    displayName = user.displayName || 'Owner SuperAdmin';
  } else {
    const inviteSnap = await getDoc(doc(db, 'adminInvites', email));
    if (!inviteSnap.exists()) {
      await signOut(auth);
      throw new Error(
        `Email Google "${email}" belum didaftarkan di daftar Admin DoraCake. Hubungi Owner SuperAdmin.`,
      );
    }
    const invite = inviteSnap.data() as AdminInvite;
    if (!invite.isActive) {
      await signOut(auth);
      throw new Error('Undangan Admin untuk email ini sudah dinonaktifkan.');
    }
    role = invite.role;
    displayName = invite.name || displayName;
  }

  await setDoc(userRef, {
    id: user.uid,
    name: displayName,
    email,
    role,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Catat log aktivasi admin
  try {
    const logId = makeId('log');
    await setDoc(doc(db, 'activityLogs', logId), {
      id: logId,
      actorName: displayName,
      actorEmail: email,
      action: 'Aktivasi Login Admin Google',
      target: `${email} (${role})`,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }

  return {
    id: user.uid,
    name: displayName,
    email,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

export async function resolveAuthenticatedUser(user: User | null): Promise<{
  admin: AdminUserPublic | null;
  customer: CustomerAccount | null;
}> {
  if (!user) return { admin: null, customer: null };

  // Cek apakah akun Admin (Google sign-in dengan email terverifikasi)
  if (user.emailVerified && user.email) {
    const emailLower = user.email.toLowerCase();
    try {
      const adminSnap = await getDoc(doc(db, 'users', user.uid));
      if (adminSnap.exists()) {
        const data = adminSnap.data() as AdminUserPublic;
        if (data.isActive) {
          return {
            admin: { ...data, id: adminSnap.id, createdAt: tsToIso(data.createdAt) },
            customer: null,
          };
        }
      } else if (emailLower === PRIMARY_OWNER_EMAIL.toLowerCase()) {
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          name: user.displayName || 'Owner SuperAdmin',
          email: emailLower,
          role: 'SUPERADMIN',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          admin: {
            id: user.uid,
            name: user.displayName || 'Owner SuperAdmin',
            email: emailLower,
            role: 'SUPERADMIN',
            isActive: true,
            createdAt: new Date().toISOString(),
          },
          customer: null,
        };
      }
    } catch {
      // Lanjut cek sebagai pelanggan
    }
  }

  // Cek sebagai Pelanggan via customerAuthMap/{uid}
  try {
    const mapSnap = await getDoc(doc(db, 'customerAuthMap', user.uid));
    if (mapSnap.exists()) {
      const { customerId } = mapSnap.data() as { customerId: string };
      const custSnap = await getDoc(doc(db, 'customers', customerId));
      if (custSnap.exists()) {
        const raw = custSnap.data() as CustomerAccount;
        if (raw.status === 'Aktif') {
          return {
            admin: null,
            customer: {
              ...raw,
              id: custSnap.id,
              createdAt: tsToIso(raw.createdAt),
              updatedAt: tsToIso(raw.updatedAt),
            },
          };
        }
      }
    }
  } catch {
    // Abaikan jika bukan pelanggan aktif
  }

  return { admin: null, customer: null };
}

export async function signOutAll(): Promise<void> {
  await signOut(auth);
}

export async function loginCustomerWithUsername(
  usernameInput: string,
  passwordInput: string,
): Promise<CustomerAccount> {
  const username = normalizeUsername(usernameInput);
  if (!username || !passwordInput) {
    throw new Error('Username dan password wajib diisi.');
  }

  const lookupSnap = await getDoc(doc(db, 'customerLookups', username));
  if (!lookupSnap.exists()) {
    throw new Error(
      'Username tidak ditemukan. Pastikan penulisan benar atau hubungi Admin via WhatsApp.',
    );
  }

  const lookup = lookupSnap.data() as {
    authEmail: string;
    customerId: string;
    status: CustomerAccountStatus;
  };

  if (lookup.status === 'Dinonaktifkan') {
    throw new Error('Akun Anda sedang dinonaktifkan oleh Admin. Silakan hubungi Admin DoraCake.');
  }
  if (lookup.status === 'Dibekukan') {
    throw new Error(
      'Akun Anda sedang dibekukan sementara untuk peninjauan. Hubungi Admin DoraCake.',
    );
  }

  try {
    await signInWithEmailAndPassword(auth, lookup.authEmail, passwordInput);
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      throw new Error('Password yang Anda masukkan salah. Gunakan fitur Lupa Password jika diperlukan.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Terlalu banyak percobaan login. Silakan tunggu beberapa menit lalu coba lagi.');
    }
    if (code === 'auth/user-disabled') {
      throw new Error('Akun autentikasi sedang dinonaktifkan oleh Admin.');
    }
    throw new Error(err instanceof Error ? err.message : 'Gagal masuk ke akun pelanggan.');
  }

  const custSnap = await getDoc(doc(db, 'customers', lookup.customerId));
  if (!custSnap.exists()) {
    await signOut(auth);
    throw new Error('Profil pelanggan tidak ditemukan di database.');
  }

  const raw = custSnap.data() as CustomerAccount;
  if (raw.status === 'Dinonaktifkan') {
    await signOut(auth);
    throw new Error('Akun Anda sedang dinonaktifkan oleh Admin.');
  }
  if (raw.status === 'Dibekukan') {
    await signOut(auth);
    throw new Error('Akun Anda sedang dibekukan sementara oleh Admin.');
  }

  return {
    ...raw,
    id: custSnap.id,
    createdAt: tsToIso(raw.createdAt),
    updatedAt: tsToIso(raw.updatedAt),
  };
}

export async function completeCustomerFirstPassword(
  customer: CustomerAccount,
  newPassword: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login tidak aktif.');
  if (newPassword.trim().length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }

  await updatePassword(user, newPassword.trim());

  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', customer.id), {
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  });
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer.name,
    actorRole: 'Pelanggan',
    activityType: 'Perubahan Profil',
    description: `${customer.id} (@${customer.username}) menyelesaikan ganti password login pertama.`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function changeCustomerOwnPassword(
  customer: CustomerAccount,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Sesi login pelanggan tidak aktif.');
  if (newPassword.trim().length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  if (oldPassword === newPassword) {
    throw new Error('Password baru tidak boleh sama dengan password lama.');
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, credential);
  } catch {
    throw new Error('Password lama tidak sesuai.');
  }

  await updatePassword(user, newPassword.trim());

  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', customer.id), {
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  });
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer.name,
    actorRole: 'Pelanggan',
    activityType: 'Perubahan Profil',
    description: `${customer.id} (@${customer.username}) memperbarui password akun.`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

// ==========================================================
// REAL-TIME STOREFRONT & CUSTOMER SUBSCRIPTIONS
// ==========================================================

export interface StorefrontSyncState {
  categories: Category[];
  products: Product[];
  settings: StoreSettings;
  website: WebsiteContentConfig;
  clubConfig: ClubConfig;
  pointRewards: PointRewardItem[];
  stampRewards: StampRewardItem[];
  campaigns: PromoCampaign[];
  publicVouchers: Voucher[];
}

export function subscribeStorefront(
  onUpdate: (partial: Partial<StorefrontSyncState>) => void,
  onError?: (err: Error) => void,
): () => void {
  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, 'categories'), where('isActive', '==', true)),
      (snap) => {
        const list = snapToArray<Category>(snap).sort((a, b) => a.sortOrder - b.sortOrder);
        onUpdate({ categories: list });
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'products'), where('isActive', '==', true)),
      (snap) => {
        const list = snapToArray<Product>(snap);
        onUpdate({ products: list });
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'public'),
      (snap) => {
        if (snap.exists()) {
          onUpdate({ settings: normalizeStoreSettings(snap.data() as Partial<StoreSettings>) });
        } else {
          onUpdate({ settings: DEFAULT_STORE_SETTINGS });
        }
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'websitePublished'),
      (snap) => {
        if (snap.exists()) {
          onUpdate({
            website: normalizeWebsiteContent(snap.data() as Partial<WebsiteContentConfig>),
          });
        } else {
          onUpdate({ website: DEFAULT_WEBSITE_CONTENT });
        }
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'clubConfig'),
      (snap) => {
        if (snap.exists()) {
          onUpdate({ clubConfig: normalizeClubConfig(snap.data() as Partial<ClubConfig>) });
        } else {
          onUpdate({ clubConfig: DEFAULT_CLUB_CONFIG });
        }
      },
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'pointRewards'), where('isActive', '==', true)),
      (snap) => onUpdate({ pointRewards: snapToArray<PointRewardItem>(snap) }),
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'stampRewards'), where('isActive', '==', true)),
      (snap) => onUpdate({ stampRewards: snapToArray<StampRewardItem>(snap) }),
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'campaigns'), where('isActive', '==', true)),
      (snap) => onUpdate({ campaigns: snapToArray<PromoCampaign>(snap) }),
      (err) => onError?.(err),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'vouchers'),
        where('isActive', '==', true),
        where('assignedAuthUid', '==', ''),
      ),
      (snap) => onUpdate({ publicVouchers: snapToArray<Voucher>(snap) }),
      (err) => onError?.(err),
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

export interface CustomerClubSyncState {
  customer: CustomerAccount | null;
  orders: Order[];
  pointHistory: PointHistoryItem[];
  stampHistory: StampHistoryItem[];
  personalVouchers: Voucher[];
  referrals: ReferralRecord[];
  productShares: ProductShareRecord[];
}

export function subscribeCustomerClubData(
  authUid: string,
  customerId: string,
  onUpdate: (partial: Partial<CustomerClubSyncState>) => void,
): () => void {
  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(doc(db, 'customers', customerId), (snap) => {
      if (snap.exists()) {
        const raw = snap.data() as CustomerAccount;
        onUpdate({
          customer: {
            ...raw,
            id: snap.id,
            createdAt: tsToIso(raw.createdAt),
            updatedAt: tsToIso(raw.updatedAt),
          },
        });
      }
    }),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'orders'), where('authUid', '==', authUid)),
      (snap) => {
        const list = snapToArray<Order>(snap).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        onUpdate({ orders: list });
      },
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'pointHistory'), where('authUid', '==', authUid)),
      (snap) => {
        const list = snapToArray<PointHistoryItem>(snap).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        onUpdate({ pointHistory: list });
      },
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'stampHistory'), where('authUid', '==', authUid)),
      (snap) => {
        const list = snapToArray<StampHistoryItem>(snap).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        onUpdate({ stampHistory: list });
      },
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'vouchers'), where('assignedAuthUid', '==', authUid)),
      (snap) => onUpdate({ personalVouchers: snapToArray<Voucher>(snap) }),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'referrals'), where('referrerAuthUid', '==', authUid)),
      (snap) => {
        const list = snapToArray<ReferralRecord>(snap).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        onUpdate({ referrals: list });
      },
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'productShares'), where('senderAuthUid', '==', authUid)),
      (snap) => {
        const list = snapToArray<ProductShareRecord>(snap).sort((a, b) =>
          b.lastSharedAt.localeCompare(a.lastSharedAt),
        );
        onUpdate({ productShares: list });
      },
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// ==========================================================
// REAL-TIME ADMIN SUBSCRIPTIONS
// ==========================================================

export interface AdminFullSyncState {
  categories: Category[];
  products: Product[];
  orders: Order[];
  customers: CustomerAccount[];
  pointRewards: PointRewardItem[];
  stampRewards: StampRewardItem[];
  pointHistory: PointHistoryItem[];
  stampHistory: StampHistoryItem[];
  vouchers: Voucher[];
  referrals: ReferralRecord[];
  referralClicks: { code: string; clicks: number }[];
  productShares: ProductShareRecord[];
  productShareClicks: {
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    referralCode: string;
    clicks: number;
  }[];
  campaigns: PromoCampaign[];
  fraudAlerts: FraudAlert[];
  auditLogs: AuditLogEntry[];
  activityLogs: AdminActivityLog[];
  settings: StoreSettings;
  websiteDraft: WebsiteContentConfig;
  websitePublished: WebsiteContentConfig;
  websiteHistory: WebsiteSnapshot[];
  clubConfig: ClubConfig;
  adminUsers: AdminUserPublic[];
  adminInvites: AdminInvite[];
  notifications: AppNotification[];
}

export function subscribeAdminData(
  onUpdate: (partial: Partial<AdminFullSyncState>) => void,
  onError?: (err: Error) => void,
): () => void {
  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'categories'),
      (snap) => onUpdate({ categories: snapToArray<Category>(snap).sort((a, b) => a.sortOrder - b.sortOrder) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'products'),
      (snap) => onUpdate({ products: snapToArray<Product>(snap) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'orders'),
      (snap) => onUpdate({ orders: snapToArray<Order>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'customers'),
      (snap) => onUpdate({ customers: snapToArray<CustomerAccount>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'pointRewards'),
      (snap) => onUpdate({ pointRewards: snapToArray<PointRewardItem>(snap) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'stampRewards'),
      (snap) => onUpdate({ stampRewards: snapToArray<StampRewardItem>(snap) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'pointHistory'),
      (snap) => onUpdate({ pointHistory: snapToArray<PointHistoryItem>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'stampHistory'),
      (snap) => onUpdate({ stampHistory: snapToArray<StampHistoryItem>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'vouchers'),
      (snap) => onUpdate({ vouchers: snapToArray<Voucher>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'referrals'),
      (snap) => onUpdate({ referrals: snapToArray<ReferralRecord>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'referralClicks'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as { code?: string; clicks?: number };
          return {
            code: (data.code || d.id).toUpperCase(),
            clicks: Number(data.clicks || 0),
          };
        });
        onUpdate({ referralClicks: list });
      },
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'productShares'),
      (snap) => onUpdate({ productShares: snapToArray<ProductShareRecord>(snap).sort((a, b) => b.lastSharedAt.localeCompare(a.lastSharedAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'productShareClicks'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as {
            productId?: string;
            productCode?: string;
            productName?: string;
            referralCode?: string;
            clicks?: number;
          };
          return {
            id: d.id,
            productId: data.productId || '',
            productCode: (data.productCode || '').toUpperCase(),
            productName: data.productName || 'Produk DoraCake',
            referralCode: (data.referralCode || 'TAMU').toUpperCase(),
            clicks: Number(data.clicks || 0),
          };
        });
        onUpdate({ productShareClicks: list });
      },
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'campaigns'),
      (snap) => onUpdate({ campaigns: snapToArray<PromoCampaign>(snap) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'fraudAlerts'),
      (snap) => onUpdate({ fraudAlerts: snapToArray<FraudAlert>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'auditLogs'),
      (snap) => onUpdate({ auditLogs: snapToArray<AuditLogEntry>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'activityLogs'),
      (snap) => onUpdate({ activityLogs: snapToArray<AdminActivityLog>(snap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'websiteHistory'),
      (snap) => onUpdate({ websiteHistory: snapToArray<WebsiteSnapshot>(snap).sort((a, b) => b.savedAt.localeCompare(a.savedAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'public'),
      (snap) => onUpdate({ settings: normalizeStoreSettings(snap.exists() ? (snap.data() as Partial<StoreSettings>) : undefined) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'websitePublished'),
      (snap) => onUpdate({ websitePublished: normalizeWebsiteContent(snap.exists() ? (snap.data() as Partial<WebsiteContentConfig>) : undefined) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'websiteDraft'),
      (snap) => {
        if (snap.exists()) {
          onUpdate({ websiteDraft: normalizeWebsiteContent(snap.data() as Partial<WebsiteContentConfig>) });
        } else {
          onUpdate({ websiteDraft: DEFAULT_WEBSITE_CONTENT });
        }
      },
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'settings', 'clubConfig'),
      (snap) => onUpdate({ clubConfig: normalizeClubConfig(snap.exists() ? (snap.data() as Partial<ClubConfig>) : undefined) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'users'),
      (snap) => onUpdate({ adminUsers: snapToArray<AdminUserPublic>(snap).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }),
      (e) => onError?.(e),
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'adminInvites'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as AdminInvite;
          return {
            ...data,
            email: data.email || d.id,
            createdAt: tsToIso(data.createdAt),
            updatedAt: data.updatedAt ? tsToIso(data.updatedAt) : undefined,
          };
        });
        onUpdate({ adminInvites: list });
      },
      () => {
        // Non-superadmin tidak memiliki list access ke adminInvites — abaikan dengan aman
        onUpdate({ adminInvites: [] });
      },
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'notifications'),
      (snap) =>
        onUpdate({
          notifications: snapToArray<AppNotification>(snap)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 250),
        }),
      (e) => onError?.(e),
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// ==========================================================
// ORDERS, CHECKOUT, TRACKING & GUEST CLAIM
// ==========================================================

export async function createOrderFirebase(payload: {
  customer: CustomerAccount | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryMethod: DeliveryMethod;
  orderDate: string;
  pickupDeliveryTime: string;
  notes: string;
  cartItems: CartItem[];
  products: Product[];
  vouchers: Voucher[];
  settings: StoreSettings;
  voucherCode?: string;
  sharedByCode?: string;
  sharedProductCode?: string;
}): Promise<Order> {
  const { customer, cartItems, products, vouchers, settings } = payload;
  if (cartItems.length === 0) {
    throw new Error('Keranjang belanja masih kosong.');
  }

  const orderItems: OrderItem[] = cartItems.map((c) => ({
    productId: c.productId,
    productCode: c.productCode,
    productName: c.productName,
    productImage: c.productImage,
    baseUnitPrice: c.baseUnitPrice,
    selectedVariants: c.selectedVariants,
    unitPrice: c.unitPrice,
    quantity: c.quantity,
    subtotal: c.unitPrice * c.quantity,
    notes: c.notes || '',
  }));

  const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0);
  let voucherDiscount = 0;
  let appliedVoucher: Voucher | undefined;

  if (payload.voucherCode && payload.voucherCode.trim()) {
    const check = validateVoucherForCart(vouchers, payload.voucherCode, cartItems, customer);
    if (!check.ok) {
      throw new Error(check.error);
    }
    voucherDiscount = check.discountAmount;
    appliedVoucher = check.voucher;
  }

  const afterVoucher = Math.max(0, subtotal - voucherDiscount);
  const shippingCost =
    payload.deliveryMethod === 'Ambil'
      ? 0
      : afterVoucher >= settings.minFreeShipping
        ? 0
        : settings.defaultShippingCost;
  const total = afterVoucher + shippingCost;

  const orderId = makeId('ord');
  const orderNumber = generateOrderNumber([]);
  const isGuestOrder = !customer;
  const authUid = !isGuestOrder ? auth.currentUser?.uid || customer?.authUid || '' : '';
  const customerId = !isGuestOrder && customer ? customer.id : 'GUEST';
  const normalizedPhone = normalizePhoneKey(payload.customerPhone) || payload.customerPhone.trim();

  const orderDoc: Record<string, unknown> = stripUndefined({
    id: orderId,
    orderNumber,
    customerId,
    authUid,
    customerName: payload.customerName.trim(),
    customerPhone: normalizedPhone,
    customerAddress: payload.customerAddress.trim() || 'Ambil di toko DoraCake',
    deliveryMethod: payload.deliveryMethod,
    orderDate: payload.orderDate,
    pickupDeliveryTime: payload.pickupDeliveryTime,
    notes: payload.notes.trim(),
    items: orderItems,
    subtotal,
    ...(appliedVoucher ? { voucherCode: appliedVoucher.code, voucherDiscount } : {}),
    shippingCost,
    total,
    paymentMethod: settings.paymentInfoText || 'Transfer Bank / QRIS via Admin WhatsApp',
    paymentStatus: 'Belum Dibayar' as PaymentStatus,
    orderStatus: 'Menunggu Konfirmasi' as OrderStatus,
    isGuestOrder,
    rewardsGranted: false,
    stampGranted: false,
    ...(payload.sharedByCode ? { sharedByCode: payload.sharedByCode.toUpperCase() } : {}),
    ...(payload.sharedProductCode ? { sharedProductCode: payload.sharedProductCode.toUpperCase() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const trackingDoc: Record<string, unknown> = stripUndefined({
    orderId,
    orderNumber,
    customerName: payload.customerName.trim(),
    deliveryMethod: payload.deliveryMethod,
    orderDate: payload.orderDate,
    pickupDeliveryTime: payload.pickupDeliveryTime,
    items: orderItems,
    subtotal,
    ...(appliedVoucher ? { voucherCode: appliedVoucher.code, voucherDiscount } : {}),
    shippingCost,
    total,
    paymentMethod: settings.paymentInfoText || 'Transfer Bank / QRIS via Admin WhatsApp',
    paymentStatus: 'Belum Dibayar' as PaymentStatus,
    orderStatus: 'Menunggu Konfirmasi' as OrderStatus,
    isGuestOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'orderTracking', orderNumber), trackingDoc);
  batch.set(doc(db, 'orders', orderId), orderDoc);

  // Update pemakaian voucher jika ada
  if (appliedVoucher) {
    const uidKey = customer ? customer.id : 'GUEST';
    const nextUsedMap = {
      ...(appliedVoucher.usedByCustomerIds || {}),
      [uidKey]: (appliedVoucher.usedByCustomerIds?.[uidKey] || 0) + 1,
    };
    batch.update(doc(db, 'vouchers', appliedVoucher.id), {
      usedCount: appliedVoucher.usedCount + 1,
      usedByCustomerIds: nextUsedMap,
    });
  }

  // Kurangi stok produk sesuai aturan security rules (isActive && isAvailable && stock > 0)
  const qtyByProduct = new Map<string, number>();
  for (const item of orderItems) {
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity);
  }
  for (const [productId, orderedQty] of qtyByProduct.entries()) {
    const product = products.find((p) => p.id === productId);
    if (product && product.isActive && product.isAvailable && product.stock > 0 && orderedQty > 0) {
      const nextStock = Math.max(0, product.stock - orderedQty);
      if (nextStock < product.stock) {
        batch.update(doc(db, 'products', product.id), {
          stock: nextStock,
          isAvailable: nextStock > 0,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  // Catat audit log (untuk tamu wajib actorRole: 'Sistem' & activityType: 'Perubahan Pesanan')
  const audId = makeId('aud');
  const voucherNote = appliedVoucher
    ? ` (Voucher ${appliedVoucher.code} -Rp${voucherDiscount.toLocaleString('id-ID')})`
    : '';
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer ? customer.name : payload.customerName.trim(),
    actorRole: customer ? 'Pelanggan' : 'Sistem',
    activityType: 'Perubahan Pesanan',
    description: `Pesanan baru ${orderNumber} (${isGuestOrder ? 'Mode Tamu' : customer?.id}) senilai Rp${total.toLocaleString('id-ID')}${voucherNote}.`,
    createdAt: serverTimestamp(),
  });

  // Notifikasi otomatis ke Admin
  const adminNotifId = makeId('ntf');
  batch.set(doc(db, 'notifications', adminNotifId), {
    id: adminNotifId,
    targetType: 'admin',
    recipientCustomerId: '',
    recipientAuthUid: '',
    title: `Pesanan Baru ${orderNumber}`,
    message: `${payload.customerName.trim()} (${isGuestOrder ? 'Tamu' : customer?.id}) memesan ${orderItems.length} menu (${payload.deliveryMethod}) senilai Rp${total.toLocaleString('id-ID')}.`,
    category: 'Pesanan',
    senderName: payload.customerName.trim(),
    orderNumber,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  // Notifikasi otomatis ke Pelanggan Member
  if (!isGuestOrder && customer && authUid) {
    const custNotifId = makeId('ntf');
    batch.set(doc(db, 'notifications', custNotifId), {
      id: custNotifId,
      targetType: 'customer',
      recipientCustomerId: customer.id,
      recipientAuthUid: authUid,
      title: `Pesanan ${orderNumber} Diterima`,
      message: `Pesanan senilai Rp${total.toLocaleString('id-ID')} sudah masuk dan menunggu konfirmasi Admin DoraCake.`,
      category: 'Pesanan',
      senderName: 'DoraCake',
      orderNumber,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
  }

  const nowIso = new Date().toISOString();
  return {
    ...(orderDoc as unknown as Order),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function trackOrderFirebase(
  orderNumber: string,
): Promise<PublicOrderTrackingView | null> {
  const clean = orderNumber.trim().toUpperCase();
  if (!clean) return null;
  try {
    const snap = await getDoc(doc(db, 'orderTracking', clean));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return {
      ...(raw as unknown as PublicOrderTrackingView),
      createdAt: tsToIso(raw.createdAt),
      updatedAt: tsToIso(raw.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `orderTracking/${clean}`);
  }
}

export async function claimGuestOrderFirebase(params: {
  customer: CustomerAccount;
  orderNumberInput: string;
  verifiedPhoneInput: string;
}): Promise<string> {
  const { customer, orderNumberInput, verifiedPhoneInput } = params;
  const authUid = auth.currentUser?.uid || customer.authUid;
  if (!authUid) throw new Error('Sesi autentikasi pelanggan tidak ditemukan.');

  const orderNum = orderNumberInput.trim().toUpperCase();
  const trackSnap = await getDoc(doc(db, 'orderTracking', orderNum));
  if (!trackSnap.exists()) {
    throw new Error(`Nomor pesanan "${orderNum}" tidak ditemukan.`);
  }
  const trackData = trackSnap.data() as { orderId: string; isGuestOrder: boolean };
  if (!trackData.isGuestOrder) {
    throw new Error('Pesanan ini sudah terhubung dengan akun member.');
  }

  const custPhone = normalizePhoneKey(customer.phone);
  const inputPhone = normalizePhoneKey(verifiedPhoneInput);
  if (inputPhone !== custPhone) {
    throw new Error(
      'Nomor WhatsApp verifikasi tidak cocok dengan nomor HP utama akun Anda.',
    );
  }

  let orderSnap;
  try {
    orderSnap = await getDoc(doc(db, 'orders', trackData.orderId));
  } catch {
    throw new Error(
      'Nomor HP pesanan tamu tidak cocok dengan nomor HP akun Anda. Verifikasi ditolak.',
    );
  }

  if (!orderSnap.exists()) {
    throw new Error(`Detail pesanan "${orderNum}" tidak ditemukan.`);
  }

  const orderData = orderSnap.data() as Order;
  if (!orderData.isGuestOrder && orderData.customerId !== 'GUEST') {
    throw new Error('Pesanan ini sudah dimiliki akun lain.');
  }

  if (normalizePhoneKey(orderData.customerPhone) !== custPhone) {
    throw new Error(
      'Nomor HP pada pesanan tamu tidak sesuai dengan nomor HP utama akun Anda.',
    );
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', orderData.id), {
    customerId: customer.id,
    authUid,
    isGuestOrder: false,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orderTracking', orderNum), {
    isGuestOrder: false,
    updatedAt: serverTimestamp(),
  });

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer.name,
    actorRole: 'Pelanggan',
    activityType: 'Klaim Pesanan Tamu',
    description: `${customer.id} mengklaim pesanan tamu ${orderNum} ke akun member.`,
    createdAt: serverTimestamp(),
  });

  const adminNotifId = makeId('ntf');
  batch.set(doc(db, 'notifications', adminNotifId), {
    id: adminNotifId,
    targetType: 'admin',
    recipientCustomerId: '',
    recipientAuthUid: '',
    title: `Klaim Pesanan Tamu ${orderNum}`,
    message: `${customer.name} (${customer.id}) menghubungkan pesanan tamu ${orderNum} ke akun membernya.`,
    category: 'Pesanan',
    senderName: customer.name,
    orderNumber: orderNum,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  const custNotifId = makeId('ntf');
  batch.set(doc(db, 'notifications', custNotifId), {
    id: custNotifId,
    targetType: 'customer',
    recipientCustomerId: customer.id,
    recipientAuthUid: authUid,
    title: `Pesanan ${orderNum} Terhubung`,
    message: `Pesanan tamu ${orderNum} berhasil ditautkan ke akun ${customer.id}.`,
    category: 'Pesanan',
    senderName: 'DoraCake',
    orderNumber: orderNum,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  if (orderData.orderStatus === 'Selesai' && orderData.paymentStatus === 'Lunas') {
    return `Pesanan ${orderNum} berhasil diklaim! Hubungi Admin bila poin/stempel dari pesanan selesai ini perlu diverifikasi tambahan.`;
  }
  return `Pesanan ${orderNum} berhasil dihubungkan ke akun ${customer.id}. Poin & stempel akan masuk otomatis saat pesanan berstatus Selesai & Lunas.`;
}

export async function adminUpdateOrderStatusFirebase(params: {
  actorName: string;
  order: Order;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  customers: CustomerAccount[];
  products: Product[];
  referrals: ReferralRecord[];
  productShares: ProductShareRecord[];
  config: ClubConfig;
}): Promise<void> {
  const {
    actorName,
    order,
    orderStatus,
    paymentStatus,
    customers,
    products,
    referrals,
    productShares,
    config,
  } = params;

  const batch = writeBatch(db);
  let rewardsGranted = Boolean(order.rewardsGranted);
  let stampGranted = Boolean(order.stampGranted);

  const isCompletedAndPaid = orderStatus === 'Selesai' && paymentStatus === 'Lunas';

  if (isCompletedAndPaid && !order.isGuestOrder && order.customerId !== 'GUEST') {
    const cust = customers.find((c) => c.id === order.customerId);
    if (cust && cust.status === 'Aktif') {
      let nextPoints = cust.points;
      let nextStamps = cust.stamps;
      let nextTx = cust.totalTransactions;
      let nextSpent = cust.totalSpent;
      let referralClaimed = Boolean(cust.referralRewardClaimed);
      let custChanged = false;

      if (!rewardsGranted) {
        const netOrderSubtotal = Math.max(0, order.subtotal - (order.voucherDiscount || 0));
        const earnedPoints = Math.floor(netOrderSubtotal / Math.max(1, config.rupiahPerPoint));
        nextTx += 1;
        nextSpent += order.total;
        nextPoints += earnedPoints;
        rewardsGranted = true;
        custChanged = true;

        if (earnedPoints > 0) {
          const phId = makeId('ph');
          batch.set(doc(db, 'pointHistory', phId), {
            id: phId,
            customerId: cust.id,
            authUid: cust.authUid || '',
            type: 'Masuk',
            points: earnedPoints,
            orderNumber: order.orderNumber,
            description: `Belanja selesai ${order.orderNumber} (Rp${netOrderSubtotal.toLocaleString('id-ID')})`,
            createdAt: serverTimestamp(),
          });

          const audPts = makeId('aud');
          batch.set(doc(db, 'auditLogs', audPts), {
            id: audPts,
            actorName,
            actorRole: 'Admin',
            activityType: 'Penambahan Poin',
            description: `Pesanan ${order.orderNumber} selesai & lunas. +${earnedPoints} poin diberikan ke ${cust.id}.`,
            createdAt: serverTimestamp(),
          });
        }

        // Referral reward jika transaksi pertama
        if (cust.referredByCode && !cust.referralRewardClaimed) {
          const referrer = customers.find(
            (r) => r.referralCode.toUpperCase() === cust.referredByCode?.toUpperCase(),
          );
          if (referrer && referrer.id !== cust.id) {
            const refPts = config.referralReferrerPoints || 100;
            const refVoucherVal = config.referralNewCustomerVoucherValue || 3000;

            batch.update(doc(db, 'customers', referrer.id), {
              points: referrer.points + refPts,
              tier: computeMemberTier(referrer.totalSpent, referrer.points + refPts),
              updatedAt: serverTimestamp(),
            });

            const phRef = makeId('ph');
            batch.set(doc(db, 'pointHistory', phRef), {
              id: phRef,
              customerId: referrer.id,
              authUid: referrer.authUid || '',
              type: 'Masuk',
              points: refPts,
              orderNumber: order.orderNumber,
              description: `Bonus Referral dari transaksi pertama ${cust.name} (${cust.id})`,
              createdAt: serverTimestamp(),
            });

            const vcRefId = makeId('vc');
            const code = `REF${cust.id.slice(-3)}${String(Math.floor(10 + Math.random() * 89))}`;
            batch.set(doc(db, 'vouchers', vcRefId), {
              id: vcRefId,
              name: `Hadiah Referral (${referrer.name})`,
              code,
              type: 'Voucher Referral',
              discountType: 'fixed',
              discountValue: refVoucherVal,
              minPurchase: 15000,
              applicableProductCodes: [],
              quota: 1,
              usedCount: 0,
              perUserLimit: 1,
              validUntil: new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10),
              isActive: true,
              assignedCustomerId: cust.id,
              assignedAuthUid: cust.authUid || '',
              usedByCustomerIds: {},
              createdAt: serverTimestamp(),
            });

            const existingRef = referrals.find(
              (r) => r.referrerCustomerId === referrer.id && r.registeredCustomerId === cust.id,
            );
            if (existingRef) {
              batch.update(doc(db, 'referrals', existingRef.id), {
                firstOrderNumber: order.orderNumber,
                status: 'Berhasil',
                referrerRewardPoints: refPts,
                refereeRewardVoucherValue: refVoucherVal,
                completedAt: serverTimestamp(),
              });
            } else {
              const newRefId = makeId('ref');
              batch.set(doc(db, 'referrals', newRefId), {
                id: newRefId,
                referrerCustomerId: referrer.id,
                referrerAuthUid: referrer.authUid || '',
                referrerCode: referrer.referralCode,
                clicks: 1,
                registeredCustomerId: cust.id,
                registeredCustomerName: cust.name,
                firstOrderNumber: order.orderNumber,
                status: 'Berhasil',
                referrerRewardPoints: refPts,
                refereeRewardVoucherValue: refVoucherVal,
                createdAt: serverTimestamp(),
                completedAt: serverTimestamp(),
              });
            }

            referralClaimed = true;
            const audRef = makeId('aud');
            batch.set(doc(db, 'auditLogs', audRef), {
              id: audRef,
              actorName: cust.name,
              actorRole: 'Admin',
              activityType: 'Aktivitas Referral',
              description: `Referral ${referrer.referralCode} selesai oleh ${cust.id}. +${refPts} poin untuk ${referrer.id} & voucher Rp${refVoucherVal.toLocaleString('id-ID')}.`,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      // Cek stempel
      if (!stampGranted) {
        const eligibleSubtotal = order.items.reduce((sum, item) => {
          const prod = products.find((p) => p.id === item.productId);
          const eligible = prod ? prod.isStampEligible !== false : true;
          return eligible ? sum + item.subtotal : sum;
        }, 0);

        if (eligibleSubtotal >= config.stampMinSubtotal) {
          nextStamps += 1;
          stampGranted = true;
          custChanged = true;

          const shId = makeId('sh');
          batch.set(doc(db, 'stampHistory', shId), {
            id: shId,
            customerId: cust.id,
            authUid: cust.authUid || '',
            type: 'Masuk',
            stampsDelta: 1,
            orderNumber: order.orderNumber,
            description: `Stempel dari pesanan ${order.orderNumber} (Produk memenuhi syarat)`,
            createdAt: serverTimestamp(),
          });

          const audSt = makeId('aud');
          batch.set(doc(db, 'auditLogs', audSt), {
            id: audSt,
            actorName,
            actorRole: 'Admin',
            activityType: 'Penambahan Stempel',
            description: `+1 stempel untuk ${cust.id} dari pesanan ${order.orderNumber}.`,
            createdAt: serverTimestamp(),
          });
        }
      }

      if (custChanged) {
        batch.update(doc(db, 'customers', cust.id), {
          points: nextPoints,
          stamps: nextStamps,
          totalTransactions: nextTx,
          totalSpent: nextSpent,
          tier: computeMemberTier(nextSpent, nextPoints),
          referralRewardClaimed: referralClaimed,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  // Catat konversi product share
  if (isCompletedAndPaid && order.sharedByCode && order.sharedProductCode && !order.rewardsGranted) {
    const shareRec = productShares.find(
      (s) =>
        s.productCode.toUpperCase() === order.sharedProductCode?.toUpperCase() &&
        s.referralCode.toUpperCase() === order.sharedByCode?.toUpperCase(),
    );
    if (shareRec) {
      batch.update(doc(db, 'productShares', shareRec.id), {
        purchases: shareRec.purchases + 1,
        totalSales: shareRec.totalSales + order.total,
        lastSharedAt: serverTimestamp(),
      });
    } else {
      const prodItem = order.items.find(
        (i) => (i.productCode || i.productId.slice(-5).toUpperCase()) === order.sharedProductCode?.toUpperCase(),
      );
      const sender = customers.find(
        (c) => c.referralCode.toUpperCase() === order.sharedByCode?.toUpperCase(),
      );
      const psId = makeId('ps');
      batch.set(doc(db, 'productShares', psId), {
        id: psId,
        productId: prodItem?.productId || order.items[0]?.productId || 'unknown',
        productCode: order.sharedProductCode.toUpperCase(),
        productName: prodItem?.productName || order.items[0]?.productName || 'Produk DoraCake',
        senderCustomerId: sender ? sender.id : 'TAMU',
        senderAuthUid: sender?.authUid || '',
        senderName: sender ? sender.name : 'Pelanggan Tamu',
        referralCode: order.sharedByCode.toUpperCase(),
        clicks: 1,
        purchases: 1,
        totalSales: order.total,
        lastSharedAt: serverTimestamp(),
      });
    }
  }

  // Tambah soldCount pada produk saat pesanan pertama kali tuntas (Selesai & Lunas)
  if (isCompletedAndPaid && order.orderStatus !== 'Selesai') {
    const qtyByProduct = new Map<string, number>();
    for (const item of order.items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.quantity);
    }
    for (const [productId, orderedQty] of qtyByProduct.entries()) {
      const prod = products.find((p) => p.id === productId);
      if (prod && orderedQty > 0) {
        batch.update(doc(db, 'products', prod.id), {
          soldCount: Math.max(0, Math.round(Number(prod.soldCount) || 0)) + orderedQty,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  batch.update(doc(db, 'orders', order.id), {
    orderStatus,
    paymentStatus,
    rewardsGranted,
    stampGranted,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orderTracking', order.orderNumber), {
    orderStatus,
    paymentStatus,
    updatedAt: serverTimestamp(),
  });

  const audOrd = makeId('aud');
  batch.set(doc(db, 'auditLogs', audOrd), {
    id: audOrd,
    actorName,
    actorRole: 'Admin',
    activityType: 'Perubahan Pesanan',
    description: `Status pesanan ${order.orderNumber} diperbarui menjadi "${orderStatus}" (${paymentStatus}).`,
    createdAt: serverTimestamp(),
  });

  // Notifikasi perubahan status pesanan ke pelanggan member
  if (!order.isGuestOrder && order.customerId !== 'GUEST') {
    const cust = customers.find((c) => c.id === order.customerId);
    const targetAuthUid = cust?.authUid || order.authUid;
    if (targetAuthUid && (orderStatus !== order.orderStatus || paymentStatus !== order.paymentStatus)) {
      const ntfId = makeId('ntf');
      const extraInfo = isCompletedAndPaid
        ? ' Pesanan tuntas! Cek saldo poin & stempel Anda.'
        : '';
      batch.set(doc(db, 'notifications', ntfId), {
        id: ntfId,
        targetType: 'customer',
        recipientCustomerId: order.customerId,
        recipientAuthUid: targetAuthUid,
        title: `Update Pesanan ${order.orderNumber}: ${orderStatus}`,
        message: `Status pesanan menjadi "${orderStatus}" dengan pembayaran "${paymentStatus}".${extraInfo}`,
        category: 'Pesanan',
        senderName: actorName,
        orderNumber: order.orderNumber,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

// ==========================================================
// REWARDS, STAMPS & REFERRAL/SHARE CLICKS
// ==========================================================

export async function redeemPointRewardFirebase(
  customer: CustomerAccount,
  reward: PointRewardItem,
): Promise<Voucher> {
  const authUid = auth.currentUser?.uid || customer.authUid;
  if (!authUid) throw new Error('Sesi pelanggan tidak aktif.');
  if (customer.fraudStatus === 'Dibatasi' || customer.fraudStatus === 'Dinonaktifkan') {
    throw new Error('Penukaran hadiah sedang dibatasi untuk peninjauan keamanan. Hubungi Admin.');
  }
  if (customer.points < reward.pointsCost) {
    throw new Error(
      `Poin belum mencukupi (butuh ${reward.pointsCost} poin, saldo Anda ${customer.points} poin).`,
    );
  }

  const vcId = makeId('vc');
  const code = `PTS${customer.id.slice(-3)}${String(Math.floor(100 + Math.random() * 900))}`;
  const validUntil = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10);

  const voucherPayload = {
    id: vcId,
    name: reward.voucherName || reward.title,
    code,
    type: 'Voucher Pelanggan Loyal' as const,
    discountType: 'fixed' as const,
    discountValue: Math.min(500000, Math.max(1, reward.discountValue)),
    minPurchase: 0,
    applicableProductCodes: [],
    quota: 1,
    usedCount: 0,
    perUserLimit: 1,
    validUntil,
    isActive: true,
    assignedCustomerId: customer.id,
    assignedAuthUid: authUid,
    usedByCustomerIds: {},
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', customer.id), {
    points: customer.points - reward.pointsCost,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'vouchers', vcId), voucherPayload);

  const phId = makeId('ph');
  batch.set(doc(db, 'pointHistory', phId), {
    id: phId,
    customerId: customer.id,
    authUid,
    type: 'Keluar',
    points: reward.pointsCost,
    description: `Tukar hadiah "${reward.title}" -> Voucher ${code}`,
    createdAt: serverTimestamp(),
  });

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer.name,
    actorRole: 'Pelanggan',
    activityType: 'Penukaran Hadiah',
    description: `${customer.id} menukar ${reward.pointsCost} poin menjadi ${reward.title} (Voucher ${code}).`,
    createdAt: serverTimestamp(),
  });

  const custNtf = makeId('ntf');
  batch.set(doc(db, 'notifications', custNtf), {
    id: custNtf,
    targetType: 'customer',
    recipientCustomerId: customer.id,
    recipientAuthUid: authUid,
    title: `Hadiah Poin Berhasil Ditukar`,
    message: `${reward.pointsCost} poin ditukar menjadi voucher ${code} (${reward.title}). Siap dipakai saat checkout!`,
    category: 'Hadiah',
    senderName: 'DoraCake',
    isRead: false,
    createdAt: serverTimestamp(),
  });

  const adminNtf = makeId('ntf');
  batch.set(doc(db, 'notifications', adminNtf), {
    id: adminNtf,
    targetType: 'admin',
    recipientCustomerId: '',
    recipientAuthUid: '',
    title: `Penukaran Hadiah Poin`,
    message: `${customer.name} (${customer.id}) menukar ${reward.pointsCost} poin untuk "${reward.title}" (Kode: ${code}).`,
    category: 'Hadiah',
    senderName: customer.name,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return {
    ...voucherPayload,
    createdAt: new Date().toISOString(),
  };
}

export async function redeemStampRewardFirebase(
  customer: CustomerAccount,
  reward: StampRewardItem,
  stampTarget: number,
): Promise<Voucher> {
  const authUid = auth.currentUser?.uid || customer.authUid;
  if (!authUid) throw new Error('Sesi pelanggan tidak aktif.');
  const required = stampTarget || reward.stampsRequired || 10;
  if (customer.stamps < required) {
    throw new Error(`Kamu membutuhkan ${required} stempel untuk menukar hadiah ini.`);
  }
  if (customer.fraudStatus === 'Dibatasi' || customer.fraudStatus === 'Dinonaktifkan') {
    throw new Error('Penukaran stempel sedang dibatasi. Hubungi Admin.');
  }

  const nextStamps = Math.max(0, customer.stamps - required);
  const vcId = makeId('vc');
  const code = `STAMP${customer.id.slice(-3)}${String(Math.floor(10 + Math.random() * 90))}`;
  const validUntil = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10);

  const voucherPayload = {
    id: vcId,
    name: `Hadiah ${required} Stempel: ${reward.title}`,
    code,
    type: 'Voucher Pelanggan Loyal' as const,
    discountType: 'fixed' as const,
    discountValue: Math.min(500000, Math.max(1, reward.discountValue || 10000)),
    minPurchase: 0,
    applicableProductCodes: reward.productCode ? [reward.productCode] : [],
    quota: 1,
    usedCount: 0,
    perUserLimit: 1,
    validUntil,
    isActive: true,
    assignedCustomerId: customer.id,
    assignedAuthUid: authUid,
    usedByCustomerIds: {},
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', customer.id), {
    stamps: nextStamps,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'vouchers', vcId), voucherPayload);

  const shId = makeId('sh');
  batch.set(doc(db, 'stampHistory', shId), {
    id: shId,
    customerId: customer.id,
    authUid,
    type: 'Tukar',
    stampsDelta: -required,
    rewardTitle: reward.title,
    description: `Penukaran ${required} stempel -> ${reward.title} (Voucher ${code}). Saldo stempel menjadi ${nextStamps}.`,
    createdAt: serverTimestamp(),
  });

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: customer.name,
    actorRole: 'Pelanggan',
    activityType: 'Penukaran Hadiah',
    description: `${customer.id} menukar ${required} stempel untuk "${reward.title}" (Voucher ${code}).`,
    createdAt: serverTimestamp(),
  });

  const custNtf = makeId('ntf');
  batch.set(doc(db, 'notifications', custNtf), {
    id: custNtf,
    targetType: 'customer',
    recipientCustomerId: customer.id,
    recipientAuthUid: authUid,
    title: `Hadiah ${required} Stempel Siap Dipakai`,
    message: `Selamat! Stempel Anda berhasil ditukar dengan "${reward.title}" (Kode Voucher: ${code}).`,
    category: 'Hadiah',
    senderName: 'DoraCake',
    isRead: false,
    createdAt: serverTimestamp(),
  });

  const adminNtf = makeId('ntf');
  batch.set(doc(db, 'notifications', adminNtf), {
    id: adminNtf,
    targetType: 'admin',
    recipientCustomerId: '',
    recipientAuthUid: '',
    title: `Penukaran Hadiah Stempel`,
    message: `${customer.name} (${customer.id}) menukar ${required} stempel menjadi "${reward.title}" (Kode: ${code}).`,
    category: 'Hadiah',
    senderName: customer.name,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return {
    ...voucherPayload,
    createdAt: new Date().toISOString(),
  };
}

export async function recordReferralClickFirebase(referralCode: string): Promise<void> {
  const clean = referralCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (clean.length < 3) return;
  try {
    const clickRef = doc(db, 'referralClicks', clean);
    const snap = await getDoc(clickRef);
    if (snap.exists()) {
      const curr = Number(snap.data().clicks || 0);
      await updateDoc(clickRef, {
        clicks: curr + 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(clickRef, {
        code: clean,
        clicks: 1,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Abaikan agar tidak mengganggu pengalaman pengunjung
  }
}

export async function recordProductShareClickFirebase(
  product: Product,
  sender: CustomerAccount | null,
  referralCodeUsed?: string,
): Promise<void> {
  const code = (product.productCode || product.id.slice(-5).toUpperCase()).replace(/[^A-Z0-9_-]/gi, '');
  const refCode = ((referralCodeUsed || sender?.referralCode || 'TAMU').toUpperCase()).replace(
    /[^A-Z0-9_-]/g,
    '',
  );
  const clickKey = `${code}_${refCode}`.slice(0, 120);

  try {
    const clickRef = doc(db, 'productShareClicks', clickKey);
    const snap = await getDoc(clickRef);
    if (snap.exists()) {
      const curr = Number(snap.data().clicks || 0);
      await updateDoc(clickRef, {
        clicks: curr + 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(clickRef, {
        id: clickKey,
        productId: product.id,
        productCode: code,
        productName: product.name.slice(0, 160),
        referralCode: refCode,
        clicks: 1,
        updatedAt: serverTimestamp(),
      });
    }

    // Jika member login membagikan langsung, catat juga di productShares miliknya
    if (sender && auth.currentUser?.uid) {
      const shareRef = doc(db, 'productShares', clickKey);
      const shareSnap = await getDoc(shareRef);
      if (shareSnap.exists()) {
        await updateDoc(shareRef, {
          clicks: Number(shareSnap.data().clicks || 0) + 1,
          lastSharedAt: serverTimestamp(),
        });
      } else {
        await setDoc(shareRef, {
          id: clickKey,
          productId: product.id,
          productCode: code,
          productName: product.name.slice(0, 160),
          senderCustomerId: sender.id,
          senderAuthUid: auth.currentUser.uid,
          senderName: sender.name,
          referralCode: refCode,
          clicks: 1,
          purchases: 0,
          totalSales: 0,
          lastSharedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Non-fatal untuk UX share
  }
}

// ==========================================================
// ADMIN: CUSTOMER MANAGEMENT
// ==========================================================

export async function adminCreateCustomerFirebase(params: {
  actorName: string;
  existingCustomers: CustomerAccount[];
  name: string;
  phone: string;
  username: string;
  tempPassword: string;
  status: CustomerAccountStatus;
  email?: string;
  referredByCode?: string;
  birthday?: string;
}): Promise<CustomerAccount> {
  const name = params.name.trim();
  const phoneNorm = normalizePhoneKey(params.phone);
  const username = normalizeUsername(params.username);
  const tempPassword = params.tempPassword.trim();
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const refCodeInput = (params.referredByCode || '').trim().toUpperCase();

  if (name.length < 2) throw new Error('Nama pelanggan minimal 2 karakter.');
  if (phoneNorm.length < 9) throw new Error('Nomor HP tidak valid.');
  if (username.length < 4) {
    throw new Error('Username minimal 4 karakter (huruf, angka, garis bawah, atau tanda hubung).');
  }
  if (tempPassword.length < 6) throw new Error('Password sementara minimal 6 karakter.');

  const existingLookup = await getDoc(doc(db, 'customerLookups', username));
  if (existingLookup.exists()) {
    throw new Error(`Username "${username}" sudah digunakan pelanggan lain.`);
  }
  const existingPhone = await getDoc(doc(db, 'customerPhoneIndex', phoneNorm));
  if (existingPhone.exists()) {
    throw new Error(`Nomor HP "${params.phone}" sudah terdaftar pada akun lain.`);
  }

  let referrerCustomer: CustomerAccount | undefined;
  if (refCodeInput) {
    referrerCustomer = params.existingCustomers.find(
      (c) => c.referralCode.toUpperCase() === refCodeInput,
    );
    if (!referrerCustomer) {
      throw new Error(`Kode referral "${refCodeInput}" tidak ditemukan.`);
    }
  }

  const authEmail =
    cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ? cleanEmail
      : customerUsernameToAuthEmail(username);

  let createdAuthUid = '';
  try {
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, tempPassword);
    createdAuthUid = userCred.user.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error(
        `Email / kredensial "${authEmail}" sudah terpakai di Firebase Authentication. Gunakan username atau email lain.`,
      );
    }
    throw new Error(
      err instanceof Error ? err.message : 'Gagal membuat akun Firebase Auth untuk pelanggan.',
    );
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  const newId = generateNextCustomerId(params.existingCustomers);
  const cleanPrefix = username.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'CAKE';
  const referralCode = `${cleanPrefix}${newId.slice(-2)}`;

  const customerDocData = stripUndefined({
    id: newId,
    authUid: createdAuthUid,
    authEmail,
    ...(cleanEmail ? { email: cleanEmail } : {}),
    name,
    phone: phoneNorm,
    username,
    mustChangePassword: true,
    status: params.status || 'Aktif',
    tier: 'Cakeers Member' as const,
    points: 0,
    stamps: 0,
    totalTransactions: 0,
    totalSpent: 0,
    referralCode,
    ...(referrerCustomer ? { referredByCode: referrerCustomer.referralCode } : {}),
    referralRewardClaimed: false,
    ...(params.birthday ? { birthday: params.birthday } : {}),
    fraudStatus: 'Normal' as const,
    simulatedDeviceId: 'ADMIN-CREATED',
    failedLoginAttempts: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'customers', newId), customerDocData);
  batch.set(doc(db, 'customerLookups', username), {
    username,
    authEmail,
    customerId: newId,
    authUid: createdAuthUid,
    status: params.status || 'Aktif',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'customerAuthMap', createdAuthUid), {
    authUid: createdAuthUid,
    customerId: newId,
    phone: phoneNorm,
    status: params.status || 'Aktif',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'customerPhoneIndex', phoneNorm), {
    customerId: newId,
    updatedAt: serverTimestamp(),
  });

  const vcId = makeId('vc');
  batch.set(doc(db, 'vouchers', vcId), {
    id: vcId,
    name: `Voucher Pelanggan Baru (${name})`,
    code: `WELCOME${newId.slice(-3)}`,
    type: 'Voucher Pelanggan Baru',
    discountType: 'fixed',
    discountValue: 5000,
    minPurchase: 20000,
    applicableProductCodes: [],
    quota: 1,
    usedCount: 0,
    perUserLimit: 1,
    validUntil: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
    isActive: true,
    assignedCustomerId: newId,
    assignedAuthUid: createdAuthUid,
    usedByCustomerIds: {},
    createdAt: serverTimestamp(),
  });

  if (referrerCustomer) {
    const refId = makeId('ref');
    batch.set(doc(db, 'referrals', refId), {
      id: refId,
      referrerCustomerId: referrerCustomer.id,
      referrerAuthUid: referrerCustomer.authUid || '',
      referrerCode: referrerCustomer.referralCode,
      clicks: 1,
      registeredCustomerId: newId,
      registeredCustomerName: name,
      status: 'Terdaftar',
      referrerRewardPoints: 0,
      refereeRewardVoucherValue: 0,
      createdAt: serverTimestamp(),
    });
    const audRef = makeId('aud');
    batch.set(doc(db, 'auditLogs', audRef), {
      id: audRef,
      actorName: params.actorName,
      actorRole: 'Admin',
      activityType: 'Aktivitas Referral',
      description: `Akun ${newId} didaftarkan dengan kode referral ${referrerCustomer.referralCode} milik ${referrerCustomer.name}.`,
      createdAt: serverTimestamp(),
    });
  }

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName: params.actorName,
    actorRole: 'Admin',
    activityType: 'Pembuatan Akun',
    description: `Membuat akun pelanggan ${newId} (${name} / @${username}) di Firebase Auth & Firestore.`,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  const nowIso = new Date().toISOString();
  return {
    ...(customerDocData as unknown as CustomerAccount),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function adminUpdateCustomerStatusFirebase(
  actorName: string,
  customer: CustomerAccount,
  status: CustomerAccountStatus,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'customers', customer.id), {
    status,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'customerLookups', customer.username.toLowerCase()), {
    status,
    updatedAt: serverTimestamp(),
  });
  if (customer.authUid) {
    batch.update(doc(db, 'customerAuthMap', customer.authUid), {
      status,
      updatedAt: serverTimestamp(),
    });
  }
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Perubahan Status Akun',
    description: `Mengubah status akun ${customer.id} (${customer.name}) menjadi ${status}.`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function adminUpdateCustomerProfileFirebase(params: {
  actorName: string;
  customer: CustomerAccount;
  name: string;
  phone: string;
  birthday?: string;
  email?: string;
}): Promise<void> {
  const { actorName, customer } = params;
  const newName = params.name.trim();
  const newPhone = normalizePhoneKey(params.phone);
  const oldPhone = normalizePhoneKey(customer.phone);

  if (newName.length < 2) throw new Error('Nama pelanggan minimal 2 karakter.');
  if (newPhone.length < 9) throw new Error('Nomor HP tidak valid.');

  if (newPhone !== oldPhone) {
    const phoneCheck = await getDoc(doc(db, 'customerPhoneIndex', newPhone));
    if (phoneCheck.exists()) {
      throw new Error(`Nomor HP "${params.phone}" sudah dipakai akun lain.`);
    }
  }

  const batch = writeBatch(db);
  batch.update(
    doc(db, 'customers', customer.id),
    stripUndefined({
      name: newName,
      phone: newPhone,
      birthday: params.birthday ? params.birthday : '',
      email: params.email ? params.email.trim().toLowerCase() : '',
      updatedAt: serverTimestamp(),
    }),
  );

  if (newPhone !== oldPhone) {
    if (oldPhone) batch.delete(doc(db, 'customerPhoneIndex', oldPhone));
    batch.set(doc(db, 'customerPhoneIndex', newPhone), {
      customerId: customer.id,
      updatedAt: serverTimestamp(),
    });
    if (customer.authUid) {
      batch.update(doc(db, 'customerAuthMap', customer.authUid), {
        phone: newPhone,
        updatedAt: serverTimestamp(),
      });
    }
  }

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Perubahan Profil',
    description: `Memperbarui profil pelanggan ${customer.id} (${newName}).`,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function adminSendCustomerPasswordResetEmail(
  actorName: string,
  customer: CustomerAccount,
): Promise<string> {
  const targetEmail = (customer.authEmail || customer.email || '').trim().toLowerCase();
  if (!targetEmail || targetEmail.endsWith('@club.doracake.local')) {
    throw new Error(
      'Akun ini dibuat tanpa email asli (@club.doracake.local). Silakan ubah password pelanggan melalui Firebase Console -> Authentication -> Users.',
    );
  }
  await sendPasswordResetEmail(auth, targetEmail);
  const audId = makeId('aud');
  await setDoc(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Reset Password',
    description: `Mengirim link reset password Firebase ke email ${targetEmail} untuk ${customer.id}.`,
    createdAt: serverTimestamp(),
  });
  return targetEmail;
}

export async function adminAdjustCustomerRewardFirebase(
  actorName: string,
  customer: CustomerAccount,
  payload: { pointsDelta: number; stampsDelta: number; reason: string },
): Promise<void> {
  const reason = payload.reason.trim();
  if (reason.length < 4) throw new Error('Alasan koreksi wajib diisi (minimal 4 karakter).');

  const batch = writeBatch(db);
  let nextPts = customer.points;
  let nextStamps = customer.stamps;

  if (payload.pointsDelta !== 0) {
    nextPts = Math.max(0, customer.points + payload.pointsDelta);
    const actualDelta = nextPts - customer.points;
    const phId = makeId('ph');
    batch.set(doc(db, 'pointHistory', phId), {
      id: phId,
      customerId: customer.id,
      authUid: customer.authUid || '',
      type: actualDelta >= 0 ? 'Masuk' : 'Keluar',
      points: Math.abs(actualDelta),
      description: `Koreksi Admin: ${reason}`,
      createdAt: serverTimestamp(),
    });
    const audPts = makeId('aud');
    batch.set(doc(db, 'auditLogs', audPts), {
      id: audPts,
      actorName,
      actorRole: 'Admin',
      activityType: actualDelta >= 0 ? 'Penambahan Poin' : 'Pengurangan Poin',
      description: `Koreksi poin ${customer.id} (${actualDelta >= 0 ? '+' : ''}${actualDelta} poin). Alasan: ${reason}`,
      createdAt: serverTimestamp(),
    });
  }

  if (payload.stampsDelta !== 0) {
    nextStamps = Math.max(0, customer.stamps + payload.stampsDelta);
    const actualStampDelta = nextStamps - customer.stamps;
    const shId = makeId('sh');
    batch.set(doc(db, 'stampHistory', shId), {
      id: shId,
      customerId: customer.id,
      authUid: customer.authUid || '',
      type: actualStampDelta >= 0 ? 'Masuk' : 'Tukar',
      stampsDelta: actualStampDelta,
      description: `Koreksi Stempel Admin: ${reason}`,
      createdAt: serverTimestamp(),
    });
    const audSt = makeId('aud');
    batch.set(doc(db, 'auditLogs', audSt), {
      id: audSt,
      actorName,
      actorRole: 'Admin',
      activityType: 'Penambahan Stempel',
      description: `Koreksi stempel ${customer.id} (${actualStampDelta >= 0 ? '+' : ''}${actualStampDelta} stempel). Alasan: ${reason}`,
      createdAt: serverTimestamp(),
    });
  }

  batch.update(doc(db, 'customers', customer.id), {
    points: nextPts,
    stamps: nextStamps,
    tier: computeMemberTier(customer.totalSpent, nextPts),
    updatedAt: serverTimestamp(),
  });

  if (customer.authUid && (payload.pointsDelta !== 0 || payload.stampsDelta !== 0)) {
    const custNtf = makeId('ntf');
    const parts: string[] = [];
    if (payload.pointsDelta !== 0) {
      parts.push(`${payload.pointsDelta > 0 ? '+' : ''}${payload.pointsDelta} poin`);
    }
    if (payload.stampsDelta !== 0) {
      parts.push(`${payload.stampsDelta > 0 ? '+' : ''}${payload.stampsDelta} stempel`);
    }
    batch.set(doc(db, 'notifications', custNtf), {
      id: custNtf,
      targetType: 'customer',
      recipientCustomerId: customer.id,
      recipientAuthUid: customer.authUid,
      title: `Pembaruan Poin & Stempel`,
      message: `Admin memperbarui saldo Anda (${parts.join(', ')}). Alasan: ${reason}`,
      category: 'Hadiah',
      senderName: actorName,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

// ==========================================================
// ADMIN: CATEGORIES, PRODUCTS, REWARDS, VOUCHERS, CAMPAIGNS
// ==========================================================

export async function upsertCategoryFirebase(
  actor: AdminUserPublic,
  payload: Partial<Category>,
  editingId?: string,
): Promise<string> {
  const id = editingId || makeId('cat');
  const data = stripUndefined({
    id,
    name: (payload.name || '').trim(),
    description: (payload.description || '').trim(),
    imageUrl: payload.imageUrl || '',
    sortOrder: Number(payload.sortOrder) || 0,
    isActive: payload.isActive ?? true,
    updatedAt: serverTimestamp(),
  });

  if (editingId) {
    await updateDoc(doc(db, 'categories', id), data);
  } else {
    await setDoc(doc(db, 'categories', id), { ...data, createdAt: serverTimestamp() });
  }

  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: editingId ? 'Ubah Kategori' : 'Tambah Kategori',
    target: data.name,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteCategoryFirebase(
  actor: AdminUserPublic,
  cat: Category,
): Promise<void> {
  await deleteDoc(doc(db, 'categories', cat.id));
  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Hapus Kategori',
    target: cat.name,
    createdAt: serverTimestamp(),
  });
}

export async function upsertProductFirebase(
  actor: AdminUserPublic,
  payload: Partial<Product>,
  editingId?: string,
): Promise<string> {
  const id = editingId || makeId('prd');
  const stock = Math.max(0, Number(payload.stock) || 0);
  const soldCount =
    payload.soldCount !== undefined
      ? Math.max(0, Math.round(Number(payload.soldCount) || 0))
      : undefined;
  const promoVal =
    payload.promoPrice !== undefined && payload.promoPrice !== null && Number(payload.promoPrice) > 0
      ? Number(payload.promoPrice)
      : null;

  const data = stripUndefined({
    id,
    productCode: (payload.productCode || id.slice(-5).toUpperCase()).trim().toUpperCase(),
    isStampEligible: payload.isStampEligible !== false,
    name: (payload.name || '').trim(),
    description: (payload.description || '').trim(),
    categoryId: payload.categoryId || '',
    price: Math.max(0, Number(payload.price) || 0),
    promoPrice: promoVal,
    stock,
    ...(soldCount !== undefined ? { soldCount } : !editingId ? { soldCount: 0 } : {}),
    isAvailable: payload.isAvailable ?? stock > 0,
    imageUrl: payload.imageUrl || '',
    isActive: payload.isActive ?? true,
    isFavorite: Boolean(payload.isFavorite),
    isNewest: Boolean(payload.isNewest),
    isBestSeller: Boolean(payload.isBestSeller),
    variants: payload.variants || { flavors: [], toppings: [], glazes: [] },
    updatedAt: serverTimestamp(),
  });

  if (editingId) {
    await updateDoc(doc(db, 'products', id), data);
  } else {
    await setDoc(doc(db, 'products', id), { ...data, createdAt: serverTimestamp() });
  }

  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: editingId ? 'Ubah Produk' : 'Tambah Produk',
    target: data.name,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function deleteProductFirebase(
  actor: AdminUserPublic,
  product: Product,
): Promise<void> {
  await deleteDoc(doc(db, 'products', product.id));
  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Hapus Produk',
    target: product.name,
    createdAt: serverTimestamp(),
  });
}

export async function savePointRewardFirebase(
  actorName: string,
  reward: PointRewardItem,
  isNew: boolean,
): Promise<void> {
  const clean = stripUndefined({
    id: reward.id || makeId('pr'),
    title: reward.title.trim(),
    description: reward.description.trim(),
    pointsCost: Math.max(1, Number(reward.pointsCost) || 100),
    rewardType: reward.rewardType,
    discountValue: Math.max(0, Number(reward.discountValue) || 0),
    voucherName: reward.voucherName.trim() || reward.title.trim(),
    isActive: Boolean(reward.isActive),
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'pointRewards', clean.id), clean);
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `${isNew ? 'Menambahkan' : 'Memperbarui'} hadiah poin "${clean.title}" (${clean.pointsCost} poin).`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function togglePointRewardFirebase(reward: PointRewardItem): Promise<void> {
  await updateDoc(doc(db, 'pointRewards', reward.id), { isActive: !reward.isActive });
}

export async function saveStampRewardFirebase(
  actorName: string,
  reward: StampRewardItem,
  isNew: boolean,
): Promise<void> {
  const clean = stripUndefined({
    id: reward.id || makeId('sr'),
    title: reward.title.trim(),
    description: reward.description.trim(),
    stampsRequired: Math.max(1, Number(reward.stampsRequired) || 10),
    rewardType: reward.rewardType,
    discountValue: Math.max(0, Number(reward.discountValue) || 0),
    ...(reward.productCode && reward.productCode.trim()
      ? { productCode: reward.productCode.trim().toUpperCase() }
      : {}),
    isActive: Boolean(reward.isActive),
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'stampRewards', clean.id), clean);
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `${isNew ? 'Menambahkan' : 'Memperbarui'} hadiah stempel "${clean.title}".`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function toggleStampRewardFirebase(reward: StampRewardItem): Promise<void> {
  await updateDoc(doc(db, 'stampRewards', reward.id), { isActive: !reward.isActive });
}

export async function saveVoucherFirebase(
  actorName: string,
  voucher: Omit<Voucher, 'id' | 'usedCount' | 'usedByCustomerIds' | 'createdAt'>,
  customers: CustomerAccount[],
): Promise<void> {
  const vcId = makeId('vc');
  const assignedCust = voucher.assignedCustomerId
    ? customers.find((c) => c.id === voucher.assignedCustomerId)
    : undefined;
  const cleanCode = voucher.code.trim().toUpperCase().replace(/\s+/g, '');
  const cleanName = voucher.name.trim();
  if (cleanName.length < 1 || cleanCode.length < 2) {
    throw new Error('Nama voucher dan kode voucher (minimal 2 karakter) wajib diisi.');
  }
  const cleanDiscountValue =
    voucher.discountType === 'percentage'
      ? Math.min(100, Math.max(1, Number(voucher.discountValue) || 1))
      : Math.min(10000000, Math.max(1, Number(voucher.discountValue) || 1));

  const docData = {
    id: vcId,
    name: cleanName.slice(0, 160),
    code: cleanCode.slice(0, 40),
    type: voucher.type,
    discountType: voucher.discountType,
    discountValue: cleanDiscountValue,
    minPurchase: Math.min(100000000, Math.max(0, Number(voucher.minPurchase) || 0)),
    applicableProductCodes: Array.isArray(voucher.applicableProductCodes)
      ? voucher.applicableProductCodes.slice(0, 100)
      : [],
    quota: Math.min(1000000, Math.max(1, Number(voucher.quota) || 1)),
    usedCount: 0,
    perUserLimit: Math.min(10000, Math.max(1, Number(voucher.perUserLimit) || 1)),
    validUntil: voucher.validUntil,
    isActive: voucher.isActive,
    assignedCustomerId: assignedCust ? assignedCust.id : '',
    assignedAuthUid: assignedCust?.authUid || '',
    usedByCustomerIds: {},
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'vouchers', vcId), docData);
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `Membuat voucher baru "${docData.code}" (${docData.type})${assignedCust ? ` untuk ${assignedCust.id}` : ''}.`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function toggleVoucherFirebase(voucher: Voucher): Promise<void> {
  await updateDoc(doc(db, 'vouchers', voucher.id), { isActive: !voucher.isActive });
}

export async function updateVoucherFirebase(
  actorName: string,
  existing: Voucher,
  updates: {
    name: string;
    code: string;
    type: Voucher['type'];
    discountType: 'fixed' | 'percentage';
    discountValue: number;
    minPurchase: number;
    applicableProductCodes: string[];
    quota: number;
    perUserLimit: number;
    validUntil: string;
    isActive: boolean;
    assignedCustomerId?: string;
  },
  customers: CustomerAccount[],
): Promise<void> {
  const assignedCust = updates.assignedCustomerId
    ? customers.find((c) => c.id === updates.assignedCustomerId)
    : undefined;
  const cleanCode = updates.code.trim().toUpperCase().replace(/\s+/g, '');
  const cleanName = updates.name.trim();
  if (cleanName.length < 1 || cleanCode.length < 2) {
    throw new Error('Nama voucher dan kode voucher (minimal 2 karakter) wajib diisi.');
  }
  const cleanDiscountValue =
    updates.discountType === 'percentage'
      ? Math.min(100, Math.max(1, Number(updates.discountValue) || 1))
      : Math.min(10000000, Math.max(1, Number(updates.discountValue) || 1));

  const batch = writeBatch(db);
  batch.update(doc(db, 'vouchers', existing.id), {
    name: cleanName.slice(0, 160),
    code: cleanCode.slice(0, 40),
    type: updates.type,
    discountType: updates.discountType,
    discountValue: cleanDiscountValue,
    minPurchase: Math.min(100000000, Math.max(0, Number(updates.minPurchase) || 0)),
    applicableProductCodes: Array.isArray(updates.applicableProductCodes)
      ? updates.applicableProductCodes.slice(0, 100)
      : [],
    quota: Math.min(1000000, Math.max(Math.max(1, existing.usedCount || 0), Number(updates.quota) || 1)),
    perUserLimit: Math.min(10000, Math.max(1, Number(updates.perUserLimit) || 1)),
    validUntil: updates.validUntil,
    isActive: Boolean(updates.isActive),
    assignedCustomerId: assignedCust ? assignedCust.id : '',
    assignedAuthUid: assignedCust?.authUid || '',
  });

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `Mengedit voucher "${existing.code}" -> "${cleanCode}" (${cleanName}).`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteVoucherFirebase(actorName: string, voucher: Voucher): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'vouchers', voucher.id));
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `Menghapus voucher "${voucher.code}" (${voucher.name}).`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function distributeVoucherToCustomersFirebase(params: {
  actorName: string;
  template: {
    name: string;
    code: string;
    type: Voucher['type'];
    discountType: 'fixed' | 'percentage';
    discountValue: number;
    minPurchase: number;
    applicableProductCodes: string[];
    validUntil: string;
  };
  targetCustomers: CustomerAccount[];
  existingVouchers: Voucher[];
}): Promise<Array<{ customer: CustomerAccount; code: string }>> {
  const { actorName, template, targetCustomers, existingVouchers } = params;
  if (targetCustomers.length === 0) {
    throw new Error('Pilih minimal 1 pelanggan untuk dikirimi voucher.');
  }
  const cleanBaseCode = template.code.trim().toUpperCase().replace(/\s+/g, '');
  const cleanName = template.name.trim();
  if (cleanName.length < 1 || cleanBaseCode.length < 2) {
    throw new Error('Nama voucher dan kode voucher dasar (minimal 2 karakter) wajib diisi.');
  }
  const cleanDiscountValue =
    template.discountType === 'percentage'
      ? Math.min(100, Math.max(1, Number(template.discountValue) || 1))
      : Math.min(10000000, Math.max(1, Number(template.discountValue) || 1));

  const usedCodes = new Set(existingVouchers.map((v) => v.code.toUpperCase()));
  const prefix = cleanBaseCode.slice(0, 26);

  const sentResults: Array<{ customer: CustomerAccount; code: string }> = [];
  const docPayloads: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const cust of targetCustomers) {
    const shortId = cust.id.replace(/[^A-Z0-9]/gi, '').slice(-6) || makeId('U').slice(-4);
    let candidate = `${prefix}-${shortId}`.slice(0, 40);
    let attempt = 0;
    while (usedCodes.has(candidate)) {
      attempt += 1;
      const suffix = String(Math.floor(10 + Math.random() * 89));
      candidate = `${prefix.slice(0, 22)}-${shortId}-${suffix}`.slice(0, 40);
      if (attempt > 25) {
        candidate = `${prefix.slice(0, 18)}-${Date.now().toString().slice(-6)}`.slice(0, 40);
      }
    }
    usedCodes.add(candidate);

    const vcId = makeId('vc');
    docPayloads.push({
      id: vcId,
      data: {
        id: vcId,
        name: cleanName.slice(0, 160),
        code: candidate,
        type: template.type,
        discountType: template.discountType,
        discountValue: cleanDiscountValue,
        minPurchase: Math.min(100000000, Math.max(0, Number(template.minPurchase) || 0)),
        applicableProductCodes: Array.isArray(template.applicableProductCodes)
          ? template.applicableProductCodes.slice(0, 100)
          : [],
        quota: 1,
        usedCount: 0,
        perUserLimit: 1,
        validUntil: template.validUntil,
        isActive: true,
        assignedCustomerId: cust.id,
        assignedAuthUid: cust.authUid || '',
        usedByCustomerIds: {},
        createdAt: serverTimestamp(),
      },
    });
    sentResults.push({ customer: cust, code: candidate });
  }

  // Commit in chunks of 200 (voucher + notif = 2 ops per customer) to stay safely within Firestore 500-op batch limit
  const CHUNK_SIZE = 200;
  for (let i = 0; i < docPayloads.length; i += CHUNK_SIZE) {
    const chunk = docPayloads.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, 'vouchers', item.id), item.data);
      const authUid = String(item.data.assignedAuthUid || '');
      const custId = String(item.data.assignedCustomerId || '');
      const voucherCode = String(item.data.code || '');
      if (authUid && custId) {
        const ntfId = makeId('ntf');
        const discountLabel =
          template.discountType === 'percentage'
            ? `${cleanDiscountValue}%`
            : `Rp${cleanDiscountValue.toLocaleString('id-ID')}`;
        batch.set(doc(db, 'notifications', ntfId), {
          id: ntfId,
          targetType: 'customer',
          recipientCustomerId: custId,
          recipientAuthUid: authUid,
          title: `Kamu Dapat Voucher: ${cleanName}`,
          message: `Admin mengirim voucher spesial kode ${voucherCode} (potongan ${discountLabel}, berlaku s.d. ${template.validUntil}). Cek tab Voucher Saya!`,
          category: 'Promo',
          senderName: actorName,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }
    }
    if (i + CHUNK_SIZE >= docPayloads.length) {
      const audId = makeId('aud');
      const custPreview = sentResults
        .slice(0, 5)
        .map((s) => s.customer.id)
        .join(', ');
      batch.set(doc(db, 'auditLogs', audId), {
        id: audId,
        actorName,
        actorRole: 'Admin',
        activityType: 'Pengaturan Sistem',
        description: `Mengirim voucher "${cleanName}" (${cleanBaseCode}) ke ${sentResults.length} pelanggan (${custPreview}${sentResults.length > 5 ? ', ...' : ''}).`,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return sentResults;
}

export async function saveCampaignFirebase(
  actorName: string,
  campaign: PromoCampaign,
  isNew: boolean,
): Promise<void> {
  const id = campaign.id || makeId('cmp');
  const data = stripUndefined({
    id,
    title: campaign.title.trim(),
    subtitle: campaign.subtitle.trim(),
    badgeText: campaign.badgeText.trim() || 'Promo Spesial',
    ...(campaign.promoCode && campaign.promoCode.trim()
      ? { promoCode: campaign.promoCode.trim().toUpperCase() }
      : {}),
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    isActive: Boolean(campaign.isActive),
    targetAudience: campaign.targetAudience,
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'campaigns', id), data);
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `${isNew ? 'Menambahkan' : 'Memperbarui'} kampanye promosi "${data.title}".`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function toggleCampaignFirebase(campaign: PromoCampaign): Promise<void> {
  await updateDoc(doc(db, 'campaigns', campaign.id), { isActive: !campaign.isActive });
}

export async function deleteCampaignFirebase(campaign: PromoCampaign): Promise<void> {
  await deleteDoc(doc(db, 'campaigns', campaign.id));
}

export async function saveClubConfigFirebase(
  actorName: string,
  config: ClubConfig,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'clubConfig'), {
    rupiahPerPoint: Math.max(100, Number(config.rupiahPerPoint) || 1000),
    stampMinSubtotal: Math.max(0, Number(config.stampMinSubtotal) || 15000),
    stampTarget: Math.max(1, Number(config.stampTarget) || 10),
    referralReferrerPoints: Math.max(0, Number(config.referralReferrerPoints) || 100),
    referralNewCustomerVoucherValue: Math.max(0, Number(config.referralNewCustomerVoucherValue) || 3000),
    updatedAt: serverTimestamp(),
  });
  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Pengaturan Sistem',
    description: `Memperbarui konfigurasi aturan poin, stempel, dan referral DoraCake Customer Club.`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateFraudAlertFirebase(params: {
  actorName: string;
  alert: FraudAlert;
  nextStatus: FraudStatus;
  customer?: CustomerAccount;
}): Promise<void> {
  const { actorName, alert, nextStatus, customer } = params;
  const batch = writeBatch(db);
  batch.update(doc(db, 'fraudAlerts', alert.id), {
    status: nextStatus,
    reviewedAt: serverTimestamp(),
    reviewedBy: actorName,
  });

  if (customer) {
    const nextAccountStatus = nextStatus === 'Dinonaktifkan' ? 'Dinonaktifkan' : customer.status;
    batch.update(doc(db, 'customers', customer.id), {
      fraudStatus: nextStatus,
      status: nextAccountStatus,
      updatedAt: serverTimestamp(),
    });
    if (nextAccountStatus !== customer.status) {
      batch.update(doc(db, 'customerLookups', customer.username.toLowerCase()), {
        status: nextAccountStatus,
        updatedAt: serverTimestamp(),
      });
      if (customer.authUid) {
        batch.update(doc(db, 'customerAuthMap', customer.authUid), {
          status: nextAccountStatus,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  const audId = makeId('aud');
  batch.set(doc(db, 'auditLogs', audId), {
    id: audId,
    actorName,
    actorRole: 'Admin',
    activityType: 'Anti-Fraud Review',
    description: `Meninjau alert ${alert.id} (${alert.customerId}) -> Status ${nextStatus}.`,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

// ==========================================================
// ADMIN: SETTINGS, WEBSITE EDITOR, ADMIN USERS, BACKUP
// ==========================================================

export async function updateStoreSettingsFirebase(
  actor: AdminUserPublic,
  settings: StoreSettings,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'settings', 'public'),
    stripUndefined({
      ...settings,
      updatedAt: serverTimestamp(),
    }),
  );
  const logId = makeId('log');
  batch.set(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Ubah Pengaturan Toko',
    target: settings.fullName,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function saveWebsiteDraftFirebase(draft: WebsiteContentConfig): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'websiteDraft'),
    stripUndefined({
      ...draft,
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function publishWebsiteFirebase(
  actor: AdminUserPublic,
  content: WebsiteContentConfig,
  currentSettings: StoreSettings,
): Promise<void> {
  const cleanContent = stripUndefined({
    ...content,
    updatedAt: serverTimestamp(),
  });
  const snapId = makeId('snap');
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'websiteDraft'), cleanContent);
  batch.set(doc(db, 'settings', 'websitePublished'), cleanContent);
  batch.set(
    doc(db, 'settings', 'public'),
    stripUndefined({
      ...currentSettings,
      storeName: content.storeName || currentSettings.storeName,
      fullName: content.footerStoreName || currentSettings.fullName,
      address: content.footerAddress || currentSettings.address,
      operationalHours: content.footerHours || currentSettings.operationalHours,
      whatsappNumber: content.footerWhatsapp || currentSettings.whatsappNumber,
      paymentInfoText: content.footerPaymentText || currentSettings.paymentInfoText,
      updatedAt: serverTimestamp(),
    }),
  );
  batch.set(doc(db, 'websiteHistory', snapId), {
    id: snapId,
    savedAt: serverTimestamp(),
    savedBy: actor.name,
    note: `Publikasi Editor Website (${content.storeName})`,
    content: stripUndefined({ ...content, updatedAt: new Date().toISOString() }),
  });
  const logId = makeId('log');
  batch.set(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Publikasi Tampilan Website',
    target: content.brandName || content.storeName,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function discardWebsiteDraftFirebase(
  published: WebsiteContentConfig,
): Promise<void> {
  await setDoc(
    doc(db, 'settings', 'websiteDraft'),
    stripUndefined({
      ...published,
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function restoreWebsiteSnapshotFirebase(
  actor: AdminUserPublic,
  snapshot: WebsiteSnapshot,
): Promise<void> {
  const batch = writeBatch(db);
  const clean = stripUndefined({
    ...snapshot.content,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'settings', 'websiteDraft'), clean);
  batch.set(doc(db, 'settings', 'websitePublished'), clean);
  const logId = makeId('log');
  batch.set(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Pulihkan Riwayat Website',
    target: snapshot.note || snapshot.id,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function inviteAdminFirebase(params: {
  actor: AdminUserPublic;
  name: string;
  email: string;
  role: AdminRole;
}): Promise<void> {
  const emailKey = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) {
    throw new Error('Format email Google Admin tidak valid.');
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'adminInvites', emailKey), {
    email: emailKey,
    name: params.name.trim(),
    role: params.role,
    isActive: true,
    invitedBy: params.actor.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const logId = makeId('log');
  batch.set(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    action: 'Undang Admin Baru',
    target: `${emailKey} (${params.role})`,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function revokeAdminInviteFirebase(
  actor: AdminUserPublic,
  emailKey: string,
): Promise<void> {
  await deleteDoc(doc(db, 'adminInvites', emailKey.toLowerCase()));
  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Hapus Undangan Admin',
    target: emailKey,
    createdAt: serverTimestamp(),
  });
}

export async function updateAdminUserFirebase(
  actor: AdminUserPublic,
  user: AdminUserPublic,
  patch: { role?: AdminRole; isActive?: boolean },
): Promise<void> {
  await updateDoc(doc(db, 'users', user.id), {
    ...(patch.role ? { role: patch.role } : {}),
    ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}),
    updatedAt: serverTimestamp(),
  });
  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Ubah Hak Akses Admin',
    target: `${user.email} (${patch.role || user.role})`,
    createdAt: serverTimestamp(),
  });
}

export async function deleteAdminUserFirebase(
  actor: AdminUserPublic,
  user: AdminUserPublic,
): Promise<void> {
  await deleteDoc(doc(db, 'users', user.id));
  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Hapus Akun Admin',
    target: user.email,
    createdAt: serverTimestamp(),
  });
}

export async function updateMyAdminProfileFirebase(
  actor: AdminUserPublic,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', actor.id), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function exportFirebaseBackup(actor: AdminUserPublic): Promise<Record<string, unknown>> {
  const [cats, prods, ords, custs, pr, sr, vc, cmp, pub, draft, web, club] = await Promise.all([
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'customers')),
    getDocs(collection(db, 'pointRewards')),
    getDocs(collection(db, 'stampRewards')),
    getDocs(collection(db, 'vouchers')),
    getDocs(collection(db, 'campaigns')),
    getDoc(doc(db, 'settings', 'public')),
    getDoc(doc(db, 'settings', 'websiteDraft')),
    getDoc(doc(db, 'settings', 'websitePublished')),
    getDoc(doc(db, 'settings', 'clubConfig')),
  ]);

  const logId = makeId('log');
  await setDoc(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Ekspor Backup Firestore',
    target: 'JSON Backup',
    createdAt: serverTimestamp(),
  });

  return {
    exportedAt: new Date().toISOString(),
    version: 3,
    source: 'firebase-firestore',
    data: {
      categories: snapToArray(cats),
      products: snapToArray(prods),
      orders: snapToArray(ords),
      customers: snapToArray(custs),
      pointRewards: snapToArray(pr),
      stampRewards: snapToArray(sr),
      vouchers: snapToArray(vc),
      campaigns: snapToArray(cmp),
      settings: pub.exists() ? pub.data() : DEFAULT_STORE_SETTINGS,
      websiteDraft: draft.exists() ? draft.data() : DEFAULT_WEBSITE_CONTENT,
      websitePublished: web.exists() ? web.data() : DEFAULT_WEBSITE_CONTENT,
      clubConfig: club.exists() ? club.data() : DEFAULT_CLUB_CONFIG,
    },
  };
}

export async function restoreFirebaseBackup(
  actor: AdminUserPublic,
  backupJson: Record<string, unknown>,
): Promise<void> {
  const payload = (backupJson.data || backupJson) as Record<string, unknown>;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Format file backup JSON tidak valid.');
  }

  const batch = writeBatch(db);
  if (Array.isArray(payload.categories)) {
    for (const c of payload.categories as Category[]) {
      if (c?.id) {
        batch.set(
          doc(db, 'categories', c.id),
          stripUndefined({ ...c, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        );
      }
    }
  }
  if (Array.isArray(payload.products)) {
    for (const p of payload.products as Product[]) {
      if (p?.id) {
        batch.set(
          doc(db, 'products', p.id),
          stripUndefined({
            ...p,
            promoPrice: p.promoPrice ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        );
      }
    }
  }
  if (payload.settings && typeof payload.settings === 'object') {
    batch.set(
      doc(db, 'settings', 'public'),
      stripUndefined({ ...(payload.settings as StoreSettings), updatedAt: serverTimestamp() }),
    );
  }
  if (payload.websitePublished && typeof payload.websitePublished === 'object') {
    batch.set(
      doc(db, 'settings', 'websitePublished'),
      stripUndefined({
        ...(payload.websitePublished as WebsiteContentConfig),
        updatedAt: serverTimestamp(),
      }),
    );
  }
  if (payload.websiteDraft && typeof payload.websiteDraft === 'object') {
    batch.set(
      doc(db, 'settings', 'websiteDraft'),
      stripUndefined({
        ...(payload.websiteDraft as WebsiteContentConfig),
        updatedAt: serverTimestamp(),
      }),
    );
  }
  if (payload.clubConfig && typeof payload.clubConfig === 'object') {
    batch.set(
      doc(db, 'settings', 'clubConfig'),
      stripUndefined({
        ...(payload.clubConfig as ClubConfig),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  const logId = makeId('log');
  batch.set(doc(db, 'activityLogs', logId), {
    id: logId,
    actorName: actor.name,
    actorEmail: actor.email,
    action: 'Pulihkan Backup Firestore',
    target: 'JSON Restore',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

// ==========================================================
// REAL-TIME NOTIFICATIONS (CUSTOMER & ADMIN)
// ==========================================================

export function subscribeCustomerNotifications(
  authUid: string,
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let personalList: AppNotification[] = [];
  let broadcastList: AppNotification[] = [];

  const emitMerged = () => {
    const map = new Map<string, AppNotification>();
    for (const item of personalList) map.set(item.id, item);
    for (const item of broadcastList) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    const merged = [...map.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 120);
    onUpdate(merged);
  };

  const unsubPersonal = onSnapshot(
    query(
      collection(db, 'notifications'),
      where('targetType', '==', 'customer'),
      where('recipientAuthUid', '==', authUid),
    ),
    (snap) => {
      personalList = snapToArray<AppNotification>(snap);
      emitMerged();
    },
    (err) => onError?.(err),
  );

  const unsubBroadcast = onSnapshot(
    query(collection(db, 'notifications'), where('targetType', '==', 'broadcast')),
    (snap) => {
      broadcastList = snapToArray<AppNotification>(snap);
      emitMerged();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubPersonal();
    unsubBroadcast();
  };
}

export async function sendAdminManualNotificationFirebase(params: {
  actorName: string;
  title: string;
  message: string;
  category: NotificationCategory;
  targetMode: 'broadcast' | 'selected';
  targetCustomers: CustomerAccount[];
}): Promise<number> {
  const title = params.title.trim().slice(0, 160);
  const message = params.message.trim().slice(0, 1000);
  if (title.length < 2 || message.length < 3) {
    throw new Error('Judul dan isi pesan notifikasi wajib diisi.');
  }

  if (params.targetMode === 'broadcast') {
    const ntfId = makeId('ntf');
    const batch = writeBatch(db);
    batch.set(doc(db, 'notifications', ntfId), {
      id: ntfId,
      targetType: 'broadcast',
      recipientCustomerId: '',
      recipientAuthUid: '',
      title,
      message,
      category: params.category,
      senderName: params.actorName,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    const audId = makeId('aud');
    batch.set(doc(db, 'auditLogs', audId), {
      id: audId,
      actorName: params.actorName,
      actorRole: 'Admin',
      activityType: 'Pengaturan Sistem',
      description: `Mengirim broadcast notifikasi (${params.category}): "${title}".`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return 1;
  }

  const validTargets = params.targetCustomers.filter((c) => Boolean(c.authUid));
  if (validTargets.length === 0) {
    throw new Error('Pilih minimal 1 pelanggan yang memiliki akun aktif.');
  }

  const CHUNK_SIZE = 400;
  for (let i = 0; i < validTargets.length; i += CHUNK_SIZE) {
    const chunk = validTargets.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const cust of chunk) {
      const ntfId = makeId('ntf');
      batch.set(doc(db, 'notifications', ntfId), {
        id: ntfId,
        targetType: 'customer',
        recipientCustomerId: cust.id,
        recipientAuthUid: cust.authUid || '',
        title,
        message,
        category: params.category,
        senderName: params.actorName,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }
    if (i + CHUNK_SIZE >= validTargets.length) {
      const audId = makeId('aud');
      const preview = validTargets
        .slice(0, 5)
        .map((c) => c.id)
        .join(', ');
      batch.set(doc(db, 'auditLogs', audId), {
        id: audId,
        actorName: params.actorName,
        actorRole: 'Admin',
        activityType: 'Pengaturan Sistem',
        description: `Mengirim notifikasi (${params.category}) "${title}" ke ${validTargets.length} pelanggan (${preview}${validTargets.length > 5 ? ', ...' : ''}).`,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return validTargets.length;
}

export async function markNotificationReadFirebase(
  notificationId: string,
  isRead = true,
): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { isRead });
}

export async function markAllNotificationsReadFirebase(
  notifications: AppNotification[],
): Promise<void> {
  const unread = notifications.filter((n) => !n.isRead && n.targetType !== 'broadcast');
  if (unread.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < unread.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const item of unread.slice(i, i + CHUNK_SIZE)) {
      batch.update(doc(db, 'notifications', item.id), { isRead: true });
    }
    await batch.commit();
  }
}

export async function deleteNotificationFirebase(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}

