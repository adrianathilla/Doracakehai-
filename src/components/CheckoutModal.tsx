import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Info,
  MessageCircle,
  Sparkles,
  Stamp,
  TicketPercent,
  X,
} from 'lucide-react';
import {
  CartItem,
  ClubConfig,
  CustomerAccount,
  DeliveryMethod,
  Order,
  Product,
  StoreSettings,
  Voucher,
} from '../types';
import { validateVoucherForCart } from '../services/clubStore';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppLink,
  formatDateOnlyId,
  formatRupiah,
} from '../utils/format';

interface CheckoutModalProps {
  isOpen: boolean;
  items: CartItem[];
  allProducts?: Product[];
  settings: StoreSettings;
  activeCustomer?: CustomerAccount | null;
  vouchers: Voucher[];
  clubConfig: ClubConfig;
  sharedAttribution?: { refCode?: string; productCode?: string } | null;
  onClose: () => void;
  onSubmitOrder: (payload: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    deliveryMethod: DeliveryMethod;
    orderDate: string;
    pickupDeliveryTime: string;
    notes: string;
    voucherCode?: string;
  }) => Promise<{ ok: true; order: Order } | { ok: false; error: string }>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  items,
  allProducts = [],
  settings,
  activeCustomer = null,
  vouchers,
  clubConfig,
  sharedAttribution = null,
  onClose,
  onSubmitOrder,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customerName, setCustomerName] = useState(activeCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(activeCustomer?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('Antar');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr);
  const [pickupDeliveryTime, setPickupDeliveryTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    voucher: Voucher;
    discountAmount: number;
  } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (isOpen && !confirmedOrder) {
      if (activeCustomer) {
        setCustomerName((prev) => prev || activeCustomer.name);
        setCustomerPhone((prev) => prev || activeCustomer.phone);
      }
    }
  }, [isOpen, activeCustomer, confirmedOrder]);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Re-validate applied voucher if cart subtotal changes
  useEffect(() => {
    if (!appliedVoucher) return;
    const recheck = validateVoucherForCart(
      vouchers,
      appliedVoucher.voucher.code,
      items,
      activeCustomer,
    );
    if (recheck.ok) {
      if (recheck.discountAmount !== appliedVoucher.discountAmount) {
        setAppliedVoucher({ voucher: recheck.voucher, discountAmount: recheck.discountAmount });
      }
    } else {
      setAppliedVoucher(null);
    }
  }, [items, subtotal, vouchers, activeCustomer, appliedVoucher]);

  const usableVouchers = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return vouchers.filter((v) => {
      if (!v.isActive) return false;
      if (v.validUntil && v.validUntil < today) return false;
      if (v.usedCount >= v.quota) return false;
      if (v.assignedCustomerId && v.assignedCustomerId !== activeCustomer?.id) return false;
      if (!activeCustomer && v.type !== 'Voucher Kampanye Promosi') return false;
      if (activeCustomer && (v.usedByCustomerIds[activeCustomer.id] || 0) >= v.perUserLimit) {
        return false;
      }
      return true;
    });
  }, [vouchers, activeCustomer]);

  if (!isOpen) return null;

  const voucherDiscount = appliedVoucher?.discountAmount || 0;
  const afterVoucher = Math.max(0, subtotal - voucherDiscount);
  const shippingCost =
    deliveryMethod === 'Ambil'
      ? 0
      : afterVoucher >= settings.minFreeShipping
        ? 0
        : settings.defaultShippingCost;
  const total = afterVoucher + shippingCost;

  const netSubtotalForPoints = afterVoucher;
  const estimatedPoints = Math.floor(
    netSubtotalForPoints / Math.max(100, clubConfig.rupiahPerPoint),
  );
  const hasStampProduct = items.some((it) => {
    const p = allProducts.find((prod) => prod.id === it.productId);
    return p ? p.isStampEligible !== false : true;
  });
  const eligibleForStamp =
    Boolean(activeCustomer) &&
    subtotal >= clubConfig.stampMinSubtotal &&
    hasStampProduct;

  const handleApplyVoucher = (codeOverride?: string) => {
    const code = (codeOverride ?? voucherInput).trim().toUpperCase();
    setVoucherError(null);
    if (!code) {
      setAppliedVoucher(null);
      return;
    }
    const check = validateVoucherForCart(vouchers, code, items, activeCustomer);
    if (!check.ok) {
      setAppliedVoucher(null);
      setVoucherError(check.error);
      return;
    }
    setVoucherInput(check.voucher.code);
    setAppliedVoucher({ voucher: check.voucher, discountAmount: check.discountAmount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (customerName.trim().length < 2) {
      setErrorMsg('Nama pelanggan wajib diisi minimal 2 karakter.');
      return;
    }
    if (!/^[+0-9\s-]{8,20}$/.test(customerPhone.trim())) {
      setErrorMsg('Masukkan nomor WhatsApp yang valid (contoh: 085712345678).');
      return;
    }
    if (deliveryMethod === 'Antar' && customerAddress.trim().length < 5) {
      setErrorMsg('Alamat lengkap wajib diisi untuk metode pengiriman Antar.');
      return;
    }
    const startH = settings.pickupDeliveryStartHour || '08:00';
    const endH = settings.pickupDeliveryEndHour || '18:00';
    if (pickupDeliveryTime < startH || pickupDeliveryTime > endH) {
      setErrorMsg(`Jam pengambilan/pengiriman harus antara ${startH}–${endH} WIB.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmitOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        deliveryMethod,
        orderDate,
        pickupDeliveryTime,
        notes: notes.trim(),
        voucherCode: appliedVoucher?.voucher.code,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
      } else {
        setConfirmedOrder(res.order);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat pesanan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAll = () => {
    setConfirmedOrder(null);
    setErrorMsg(null);
    setVoucherError(null);
    setAppliedVoucher(null);
    setVoucherInput('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
          <div>
            <h2 className="font-serif-display text-xl font-bold text-[#2C1810]">
              {confirmedOrder ? 'Pesanan Berhasil Dibuat' : 'Checkout Pesanan DoraCake'}
            </h2>
            {!confirmedOrder && (
              <p className="text-xs text-[#6E5849]">
                {activeCustomer
                  ? `Login sebagai Member: ${activeCustomer.name} (${activeCustomer.id})`
                  : 'Mode Tamu — Pesanan dapat diklaim ke akun member setelah transaksi'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseAll}
            className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
            aria-label="Tutup checkout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {confirmedOrder ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                <p className="mt-2 text-xs font-semibold tracking-wider text-emerald-800 uppercase">
                  Nomor Pesanan Anda
                </p>
                <p className="font-mono-tabular mt-1 text-2xl font-bold text-[#2C1810]">
                  {confirmedOrder.orderNumber}
                </p>
                <p className="mt-2 text-xs text-emerald-900">
                  Simpan nomor pesanan di atas untuk melacak status pesanan Anda kapan saja.
                </p>
              </div>

              {confirmedOrder.isGuestOrder ? (
                <div className="rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-4 text-xs text-[#8E2E49]">
                  <strong>Mode Tamu:</strong> Jika nanti Kakak bergabung dengan DoraCake Customer
                  Club menggunakan nomor HP <span className="font-mono-tabular font-bold">{confirmedOrder.customerPhone}</span>, nomor pesanan{' '}
                  <span className="font-mono-tabular font-bold">{confirmedOrder.orderNumber}</span> dapat
                  diklaim ke akun member untuk mendapatkan poin &amp; stempel.
                </div>
              ) : (
                <div className="rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] p-4 text-xs text-[#8E2E49]">
                  <strong>Estimasi Hadiah Customer Club:</strong> Poin &amp; stempel akan otomatis
                  masuk ke akun <strong>{activeCustomer?.id}</strong> setelah Admin mengonfirmasi
                  status pesanan <strong>Selesai</strong> &amp; pembayaran <strong>Lunas</strong>.
                </div>
              )}

              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-5 text-sm">
                <h3 className="font-serif-display text-base font-bold text-[#2C1810]">
                  Ringkasan Pesanan
                </h3>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[#6E5849]">Pemesan: </span>
                    <span className="font-semibold text-[#2C1810]">
                      {confirmedOrder.customerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6E5849]">Metode: </span>
                    <span className="font-semibold text-[#2C1810]">
                      {confirmedOrder.deliveryMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6E5849]">Jadwal: </span>
                    <span className="font-semibold text-[#2C1810]">
                      {formatDateOnlyId(confirmedOrder.orderDate)},{' '}
                      {confirmedOrder.pickupDeliveryTime} WIB
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6E5849]">Status Pembayaran: </span>
                    <span className="font-semibold text-amber-800">
                      {confirmedOrder.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-[#E6D8C5] pt-3">
                  {confirmedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-[#2C1810]">
                        {it.productName} x{it.quantity}
                      </span>
                      <span className="font-semibold text-[#2C1810] tabular-nums">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  ))}
                  {Boolean(confirmedOrder.voucherDiscount && confirmedOrder.voucherDiscount > 0) && (
                    <div className="flex justify-between text-xs text-[#8E2E49]">
                      <span>Voucher ({confirmedOrder.voucherCode})</span>
                      <span className="font-semibold tabular-nums">
                        -{formatRupiah(confirmedOrder.voucherDiscount || 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E6D8C5] pt-2 font-bold text-[#2C1810]">
                    <span>Total Pembayaran</span>
                    <span className="tabular-nums">{formatRupiah(confirmedOrder.total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#C89D54]/50 bg-[#FBF6EE] p-4 text-xs leading-relaxed text-[#3B2316]">
                <p className="font-semibold">Informasi Pembayaran:</p>
                <p className="mt-1">{settings.paymentInfoText}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={buildWhatsAppLink(
                    settings.whatsappNumber,
                    buildOrderWhatsAppMessage(confirmedOrder, settings),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#3B2316] px-5 py-3.5 text-sm font-semibold text-[#FBF6EE] transition-colors hover:bg-[#4F3020]"
                >
                  <MessageCircle className="h-4 w-4 text-[#E7CFA2]" />
                  <span>Konfirmasi ke WhatsApp Admin</span>
                </a>
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-5 py-3.5 text-sm font-semibold text-[#3B2316] hover:bg-[#F6EFE4]"
                >
                  Kembali ke Katalog
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
                    {errorMsg}
                  </div>
                )}

                {sharedAttribution?.refCode && (
                  <div className="rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3.5 py-2.5 text-xs text-[#8E2E49]">
                    Tautan terhubung dengan kode referral{' '}
                    <span className="font-mono-tabular font-bold">{sharedAttribution.refCode}</span>
                    {sharedAttribution.productCode
                      ? ` · Produk ${sharedAttribution.productCode}`
                      : ''}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Contoh: 085712345678"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Metode Pengambilan *
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-3">
                    {(['Antar', 'Ambil'] as DeliveryMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setDeliveryMethod(method)}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                          deliveryMethod === method
                            ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                            : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:border-[#C89D54]'
                        }`}
                      >
                        {method === 'Antar' ? 'Antar (Delivery)' : 'Ambil di Toko'}
                      </button>
                    ))}
                  </div>
                </div>

                {deliveryMethod === 'Antar' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Alamat Lengkap Pengiriman *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Jalan, nomor rumah, RT/RW, patokan..."
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3 text-xs text-[#5C4435]">
                    Lokasi ambil pesanan: <strong className="text-[#2C1810]">{settings.address}</strong>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Tanggal Pemesanan *
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Jam ({settings.pickupDeliveryStartHour}–{settings.pickupDeliveryEndHour} WIB) *
                    </label>
                    <input
                      type="time"
                      required
                      min={settings.pickupDeliveryStartHour}
                      max={settings.pickupDeliveryEndHour}
                      value={pickupDeliveryTime}
                      onChange={(e) => setPickupDeliveryTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Voucher Input & Quick Select */}
                <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3B2316]">
                      <TicketPercent className="h-4 w-4 text-[#8E2E49]" />
                      <span>Gunakan Voucher DoraCake</span>
                    </span>
                    {appliedVoucher && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedVoucher(null);
                          setVoucherInput('');
                          setVoucherError(null);
                        }}
                        className="text-xs font-semibold text-rose-700 hover:underline"
                      >
                        Lepas Voucher
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      placeholder="Masukkan kode voucher (mis. PROMO10)"
                      className="font-mono-tabular min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs text-[#2C1810] uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyVoucher()}
                      className="rounded-xl bg-[#8E2E49] px-4 py-2 text-xs font-semibold text-white hover:bg-[#77243C] whitespace-nowrap shrink-0"
                    >
                      Terapkan
                    </button>
                  </div>

                  {voucherError && (
                    <p className="text-xs font-medium text-rose-700">{voucherError}</p>
                  )}

                  {appliedVoucher && (
                    <p className="text-xs font-semibold text-emerald-700">
                      Voucher {appliedVoucher.voucher.code} aktif — Potongan{' '}
                      {formatRupiah(appliedVoucher.discountAmount)}
                    </p>
                  )}

                  {usableVouchers.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-[#6E5849]">Voucher Tersedia:</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {usableVouchers.slice(0, 6).map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleApplyVoucher(v.code)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              appliedVoucher?.voucher.code === v.code
                                ? 'border-[#8E2E49] bg-[#8E2E49] text-white'
                                : 'border-[#EAB8C6] bg-[#FFFDF9] text-[#8E2E49] hover:bg-[#FDF2F5]'
                            }`}
                          >
                            {v.code} (
                            {v.discountType === 'percentage'
                              ? `${v.discountValue}%`
                              : formatRupiah(v.discountValue)}
                            )
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Catatan Pesanan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Pesan tambahan untuk admin atau kurir"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
                  />
                </div>
              </div>

              {/* Right Column: Summary & Club Preview */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-5 lg:col-span-5">
                <div>
                  <h3 className="font-serif-display text-base font-bold text-[#2C1810]">
                    Ringkasan Pesanan
                  </h3>
                  <div className="mt-3 max-h-48 space-y-2.5 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div key={item.cartItemId} className="flex justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#2C1810] truncate">
                            {item.productName} x{item.quantity}
                          </p>
                          {(item.selectedVariants.flavor ||
                            item.selectedVariants.topping ||
                            item.selectedVariants.glaze) && (
                            <p className="text-[11px] text-[#6E5849] truncate">
                              {[
                                item.selectedVariants.flavor?.name,
                                item.selectedVariants.topping?.name,
                                item.selectedVariants.glaze?.name,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-semibold text-[#2C1810] tabular-nums">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[#E6D8C5] pt-3 text-xs">
                    <div className="flex justify-between text-[#5C4435]">
                      <span>Subtotal</span>
                      <span className="font-semibold text-[#2C1810] tabular-nums">
                        {formatRupiah(subtotal)}
                      </span>
                    </div>
                    {voucherDiscount > 0 && (
                      <div className="flex justify-between text-[#8E2E49]">
                        <span>Diskon Voucher ({appliedVoucher?.voucher.code})</span>
                        <span className="font-semibold tabular-nums">
                          -{formatRupiah(voucherDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#5C4435]">
                      <span>Ongkos Kirim</span>
                      <span className="font-semibold text-[#2C1810] tabular-nums">
                        {shippingCost === 0 ? 'Gratis' : formatRupiah(shippingCost)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#E6D8C5] pt-2 text-sm font-bold text-[#2C1810]">
                      <span>Total</span>
                      <span className="tabular-nums">{formatRupiah(total)}</span>
                    </div>
                  </div>

                  {/* Customer Club Reward Estimation */}
                  <div className="mt-4 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] p-3 text-xs text-[#8E2E49]">
                    {activeCustomer ? (
                      <div className="space-y-1">
                        <p className="inline-flex items-center gap-1.5 font-bold">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Potensi Hadiah Customer Club</span>
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Coins className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Estimasi <strong className="tabular-nums">+{estimatedPoints} poin</strong>{' '}
                            (ongkir tidak dihitung)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Stamp className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {eligibleForStamp
                              ? `+1 Stempel Digital (Subtotal >= ${formatRupiah(clubConfig.stampMinSubtotal)})`
                              : `Tambah ${formatRupiah(Math.max(0, clubConfig.stampMinSubtotal - subtotal))} lagi untuk +1 stempel`}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80">
                          Poin &amp; stempel masuk setelah pesanan Selesai &amp; Lunas.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] leading-relaxed">
                        <strong>Mode Tamu:</strong> Pesanan tetap diproses tanpa akun. Setelah jadi
                        member, Anda bisa mengklaim nomor pesanan ini.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] p-3 text-[11px] leading-relaxed text-[#5C4435]">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9E7840]" />
                      <div>
                        <p>
                          Pickup &amp; delivery pukul {settings.pickupDeliveryStartHour}–
                          {settings.pickupDeliveryEndHour} WIB.
                        </p>
                        <p className="mt-1">
                          Gratis ongkir min. {formatRupiah(settings.minFreeShipping)} (area layanan
                          DoraCake).
                        </p>
                        <p className="mt-1">{settings.cancellationPolicy}</p>
                        <p className="mt-1 font-medium text-[#3B2316]">{settings.paymentInfoText}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="mt-5 w-full rounded-xl bg-[#3B2316] px-5 py-3.5 text-sm font-semibold text-[#FBF6EE] transition-colors hover:bg-[#4F3020] disabled:opacity-60"
                >
                  {submitting ? 'Memproses Pesanan...' : 'Buat Pesanan Sekarang'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
