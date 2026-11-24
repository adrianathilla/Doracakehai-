import {
  CartItem,
  ClubConfig,
  ClubSimulationState,
  CustomerAccount,
  Order,
  Voucher,
} from '../types';

const LEGACY_CLUB_STORAGE_KEY = 'doracake_club_prototype_v1';

export const DEFAULT_CLUB_CONFIG: ClubConfig = {
  rupiahPerPoint: 1000,
  stampMinSubtotal: 15000,
  stampTarget: 10,
  referralReferrerPoints: 100,
  referralNewCustomerVoucherValue: 3000,
};

export function purgeLegacyPrototypeStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_CLUB_STORAGE_KEY);
    }
  } catch {
    // Abaikan jika browser membatasi akses storage
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function customerUsernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@club.doracake.local`;
}

export function generateNextCustomerId(customers: CustomerAccount[]): string {
  let maxNum = 0;
  for (const c of customers) {
    const match = /^DC-(\d+)$/.exec(c.id);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `DC-${String(maxNum + 1).padStart(6, '0')}`;
}

export function generateOrderNumber(existing: Order[]): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  const used = new Set(existing.map((o) => o.orderNumber));
  for (let i = 0; i < 40; i++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const cand = `DC-${datePart}-${suffix}`;
    if (!used.has(cand)) return cand;
  }
  return `DC-${datePart}-${String(Date.now()).slice(-4)}`;
}

export function computeMemberTier(totalSpent: number, points: number): CustomerAccount['tier'] {
  if (totalSpent >= 500000 || points >= 600) return 'Cakeers Loyal';
  if (totalSpent >= 250000 || points >= 300) return 'Cakeers Gold';
  if (totalSpent >= 100000 || points >= 100) return 'Cakeers Silver';
  return 'Cakeers Member';
}

export function createInitialDemoState(): ClubSimulationState {
  purgeLegacyPrototypeStorage();
  return {
    version: 2,
    customers: [],
    demoCategories: [],
    demoProducts: [],
    orders: [],
    pointHistory: [],
    pointRewards: [],
    stampHistory: [],
    stampRewards: [],
    vouchers: [],
    referrals: [],
    productShares: [],
    campaigns: [],
    fraudAlerts: [],
    auditLogs: [],
    config: { ...DEFAULT_CLUB_CONFIG },
    currentDeviceId: 'WEB-ONLINE',
  };
}

export function validateVoucherForCart(
  vouchers: Voucher[],
  voucherCode: string,
  cartItems: CartItem[],
  customer: CustomerAccount | null,
): { ok: true; voucher: Voucher; discountAmount: number } | { ok: false; error: string } {
  const code = voucherCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'Masukkan kode voucher.' };

  const voucher = vouchers.find((v) => v.code.toUpperCase() === code);
  if (!voucher) return { ok: false, error: `Kode voucher "${code}" tidak ditemukan.` };
  if (!voucher.isActive) return { ok: false, error: 'Voucher ini sedang tidak aktif.' };

  const today = new Date().toISOString().slice(0, 10);
  if (voucher.validUntil && voucher.validUntil < today) {
    return { ok: false, error: `Voucher sudah kedaluwarsa sejak ${voucher.validUntil}.` };
  }
  if (voucher.usedCount >= voucher.quota) {
    return { ok: false, error: 'Kuota voucher telah habis.' };
  }

  if (voucher.assignedCustomerId) {
    if (!customer || customer.id !== voucher.assignedCustomerId) {
      return { ok: false, error: 'Voucher ini khusus untuk akun member tertentu.' };
    }
  }

  if (customer) {
    const usedByUser = voucher.usedByCustomerIds[customer.id] || 0;
    if (usedByUser >= voucher.perUserLimit) {
      return { ok: false, error: 'Batas pemakaian voucher untuk akun Anda sudah tercapai.' };
    }
  } else if (voucher.type !== 'Voucher Kampanye Promosi') {
    return {
      ok: false,
      error: 'Voucher member hanya dapat digunakan setelah login ke DoraCake Customer Club.',
    };
  }

  const eligibleSubtotal =
    voucher.applicableProductCodes.length === 0
      ? cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      : cartItems
          .filter((item) => {
            const pCode = item.productCode || item.productId.slice(-5).toUpperCase();
            return voucher.applicableProductCodes.includes(pCode);
          })
          .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const totalCartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  if (voucher.applicableProductCodes.length > 0 && eligibleSubtotal === 0) {
    return {
      ok: false,
      error: `Voucher ini hanya berlaku untuk produk berkode: ${voucher.applicableProductCodes.join(', ')}.`,
    };
  }

  if (totalCartSubtotal < voucher.minPurchase) {
    return {
      ok: false,
      error: `Minimal belanja untuk voucher ini adalah Rp${voucher.minPurchase.toLocaleString('id-ID')}.`,
    };
  }

  let discountAmount = 0;
  if (voucher.discountType === 'fixed') {
    discountAmount = Math.min(eligibleSubtotal, voucher.discountValue);
  } else {
    discountAmount = Math.min(
      eligibleSubtotal,
      Math.round((eligibleSubtotal * voucher.discountValue) / 100),
    );
  }

  return {
    ok: true,
    voucher,
    discountAmount: Math.max(0, discountAmount),
  };
}
