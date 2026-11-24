import { Order, OrderStatus, PaymentStatus, StoreSettings } from '../types';

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDateTimeId(isoString: string): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateOnlyId(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function normalizeWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return `62${digits}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizeWhatsAppDigits(phone || '+62 857-7368-0571');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildOrderWhatsAppMessage(order: Order, settings: StoreSettings): string {
  const itemLines = order.items
    .map((item, idx) => {
      const variants: string[] = [];
      if (item.selectedVariants.flavor) variants.push(`Rasa: ${item.selectedVariants.flavor.name}`);
      if (item.selectedVariants.topping) variants.push(`Topping: ${item.selectedVariants.topping.name}`);
      if (item.selectedVariants.glaze) variants.push(`Glaze: ${item.selectedVariants.glaze.name}`);
      const variantText = variants.length > 0 ? ` (${variants.join(', ')})` : '';
      const noteText = item.notes ? `\n   Catatan: ${item.notes}` : '';
      return `${idx + 1}. ${item.productName}${variantText} x${item.quantity} — ${formatRupiah(item.subtotal)}${noteText}`;
    })
    .join('\n');

  return [
    `Halo Admin ${settings.fullName}!`,
    `Saya ingin mengonfirmasi pesanan baru:`,
    ``,
    `No. Pesanan: *${order.orderNumber}*`,
    `Nama: ${order.customerName}`,
    `WhatsApp: ${order.customerPhone}`,
    `Metode: ${order.deliveryMethod}`,
    `Alamat: ${order.customerAddress}`,
    `Tanggal: ${formatDateOnlyId(order.orderDate)}`,
    `Jam: ${order.pickupDeliveryTime} WIB`,
    ``,
    `Daftar Pesanan:`,
    itemLines,
    ``,
    `Subtotal: ${formatRupiah(order.subtotal)}`,
    `Ongkir: ${order.shippingCost === 0 ? 'Gratis' : formatRupiah(order.shippingCost)}`,
    `Total Pembayaran: *${formatRupiah(order.total)}*`,
    order.notes ? `Catatan Tambahan: ${order.notes}` : '',
    ``,
    `Mohon informasi rekening Transfer Bank / QRIS resmi DoraCake untuk proses pembayaran. Terima kasih!`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export function getOrderStatusBadge(status: OrderStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'Menunggu Konfirmasi':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
      };
    case 'Dikonfirmasi':
    case 'Sedang Diproses':
    case 'Siap Diambil':
    case 'Dalam Pengiriman':
      return {
        bg: 'bg-sky-50',
        text: 'text-sky-800',
        border: 'border-sky-200',
      };
    case 'Selesai':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
      };
    case 'Dibatalkan':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
      };
  }
}

export function getPaymentStatusBadge(status: PaymentStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'Lunas':
      return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'Menunggu Verifikasi':
      return { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' };
    case 'Dibatalkan':
      return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' };
    default:
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
  }
}

export function safeImageSrc(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(trimmed)
  ) {
    return trimmed;
  }
  return '';
}

export const DORACAKE_ADMIN_WHATSAPP = '+6285773680571';

export function formatDatePartId(isoString: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTimePartId(isoString: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return (
    new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d) + ' WIB'
  );
}

export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  if (digits.startsWith('0')) return digits;
  return `0${digits}`;
}

export function buildCustomerRegistrationWaLink(): string {
  const msg = 'Halo Min, saya ingin membuat akun pelanggan DoraCake. Bagaimana cara pendaftarannya?';
  return buildWhatsAppLink(DORACAKE_ADMIN_WHATSAPP, msg);
}

export function buildForgotPasswordWaLink(identifier?: string): string {
  const clue = identifier?.trim() ? ` Username / No. HP saya: ${identifier.trim()}.` : '';
  const msg = `Halo Min, saya lupa password akun DoraCake Customer Club.${clue} Mohon bantuan untuk reset password sementara. Terima kasih!`;
  return buildWhatsAppLink(DORACAKE_ADMIN_WHATSAPP, msg);
}

export function buildNewCustomerCredentialsMessage(
  customerName: string,
  username: string,
  tempPassword: string,
): string {
  return [
    `Halo Kak ${customerName}!`,
    ``,
    `Selamat datang di DoraCake Customer Club.`,
    ``,
    `Akun pelanggan Kakak sudah berhasil dibuat.`,
    ``,
    `Username: ${username}`,
    `Password sementara: ${tempPassword}`,
    ``,
    `Silakan login melalui website DoraCake.`,
    ``,
    `Setelah login pertama, Kakak diwajibkan mengganti password demi keamanan akun.`,
    ``,
    `Terima kasih telah menjadi bagian dari Cakeers!`,
  ].join('\n');
}

export function buildResetPasswordCredentialsMessage(
  customerName: string,
  customerId: string,
  username: string,
  tempPassword: string,
): string {
  return [
    `Halo Kak ${customerName} (${customerId}),`,
    ``,
    `Password akun DoraCake Customer Club Kakak telah direset oleh Admin.`,
    ``,
    `Username: ${username}`,
    `Password sementara baru: ${tempPassword}`,
    ``,
    `Silakan login melalui website DoraCake dan segera ganti password Kakak pada halaman login/profil.`,
    ``,
    `Terima kasih, Cakeers!`,
  ].join('\n');
}

