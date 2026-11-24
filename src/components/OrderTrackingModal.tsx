import React, { useState } from 'react';
import { CheckCircle2, Clock, PackageSearch, Search, X } from 'lucide-react';
import { Order, OrderStatus, PublicOrderTrackingView, StoreSettings } from '../types';
import { trackOrderFirebase } from '../services/firebaseService';
import {
  buildWhatsAppLink,
  formatDateOnlyId,
  formatRupiah,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../utils/format';

interface OrderTrackingModalProps {
  isOpen: boolean;
  recentOrderNumbers: string[];
  localOrders?: Order[];
  settings: StoreSettings;
  onClose: () => void;
}

const PROGRESS_STEPS: OrderStatus[] = [
  'Menunggu Konfirmasi',
  'Dikonfirmasi',
  'Sedang Diproses',
  'Siap Diambil',
  'Dalam Pengiriman',
  'Selesai',
];

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  recentOrderNumbers,
  localOrders = [],
  settings,
  onClose,
}) => {
  const [query, setQuery] = useState(recentOrderNumbers[0] || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tracking, setTracking] = useState<PublicOrderTrackingView | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (codeToSearch: string) => {
    const cleaned = codeToSearch.trim().toUpperCase();
    if (!cleaned) {
      setErrorMsg('Masukkan nomor pesanan terlebih dahulu.');
      return;
    }

    const localMatch = localOrders.find((o) => o.orderNumber.toUpperCase() === cleaned);
    if (localMatch) {
      setErrorMsg(null);
      setTracking({
        orderNumber: localMatch.orderNumber,
        customerName: localMatch.customerName,
        deliveryMethod: localMatch.deliveryMethod,
        orderDate: localMatch.orderDate,
        pickupDeliveryTime: localMatch.pickupDeliveryTime,
        orderStatus: localMatch.orderStatus,
        paymentStatus: localMatch.paymentStatus,
        items: localMatch.items,
        subtotal: localMatch.subtotal,
        shippingCost: localMatch.shippingCost,
        total: localMatch.total,
        paymentMethod: localMatch.paymentMethod,
        createdAt: localMatch.createdAt,
        updatedAt: localMatch.updatedAt,
      });
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await trackOrderFirebase(cleaned);
      if (!res) {
        setTracking(null);
        setErrorMsg(`Nomor pesanan "${cleaned}" tidak ditemukan.`);
      } else {
        setTracking(res);
      }
    } catch (err) {
      setTracking(null);
      setErrorMsg(err instanceof Error ? err.message : 'Pesanan tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const activeStepIndex = tracking ? PROGRESS_STEPS.indexOf(tracking.orderStatus) : -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <PackageSearch className="h-5 w-5 text-[#9E7840]" />
            <h2 className="font-serif-display text-xl font-bold text-[#2C1810]">
              Lacak Status Pesanan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
            aria-label="Tutup pelacakan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="Masukkan No. Pesanan (Contoh: DC-20261123-1234)"
                className="font-mono-tabular w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2.5 pl-10 pr-4 text-sm text-[#2C1810] placeholder:font-sans focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#3B2316] px-5 py-2.5 text-sm font-semibold text-[#FBF6EE] transition-colors hover:bg-[#4F3020] disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? 'Mencari...' : 'Lacak Pesanan'}
            </button>
          </form>

          {recentOrderNumbers.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6E5849]">
              <span>Pesanan terbaru Anda:</span>
              {recentOrderNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setQuery(num);
                    handleSearch(num);
                  }}
                  className="font-mono-tabular rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1 text-xs font-medium text-[#3B2316] hover:border-[#C89D54]"
                >
                  {num}
                </button>
              ))}
            </div>
          )}

          {errorMsg && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMsg}
            </div>
          )}

          {tracking && (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#6E5849]">Nomor Pesanan</p>
                    <p className="font-mono-tabular text-lg font-bold text-[#2C1810]">
                      {tracking.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-[#3B2316]">
                      Pemesan: <span className="font-semibold">{tracking.customerName}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {(() => {
                      const st = getOrderStatusBadge(tracking.orderStatus);
                      return (
                        <span
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold ${st.bg} ${st.text} ${st.border}`}
                        >
                          {tracking.orderStatus}
                        </span>
                      );
                    })()}
                    {(() => {
                      const pst = getPaymentStatusBadge(tracking.paymentStatus);
                      return (
                        <span
                          className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-medium ${pst.bg} ${pst.text} ${pst.border}`}
                        >
                          Pembayaran: {tracking.paymentStatus}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Progress Steps */}
                {tracking.orderStatus !== 'Dibatalkan' && (
                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#E6D8C5] pt-4 sm:grid-cols-3">
                    {PROGRESS_STEPS.map((step, index) => {
                      const reached = index <= activeStepIndex;
                      return (
                        <div
                          key={step}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                            reached
                              ? 'border-[#3B2316]/30 bg-[#FFFDF9] font-semibold text-[#2C1810]'
                              : 'border-transparent bg-transparent text-[#8C7362]'
                          }`}
                        >
                          {reached ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{step}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 grid gap-2 border-t border-[#E6D8C5] pt-4 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[#6E5849]">Metode Pengiriman: </span>
                    <span className="font-semibold text-[#2C1810]">{tracking.deliveryMethod}</span>
                  </div>
                  <div>
                    <span className="text-[#6E5849]">Jadwal: </span>
                    <span className="font-semibold text-[#2C1810]">
                      {formatDateOnlyId(tracking.orderDate)}, {tracking.pickupDeliveryTime} WIB
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
                <h3 className="font-serif-display text-sm font-bold text-[#2C1810]">
                  Rincian Produk
                </h3>
                <div className="mt-3 space-y-2.5">
                  {tracking.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 border-b border-[#F0E4D2] pb-2.5 last:border-b-0 last:pb-0 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#2C1810]">
                          {item.productName} × {item.quantity}
                        </p>
                        {(item.selectedVariants.flavor ||
                          item.selectedVariants.topping ||
                          item.selectedVariants.glaze) && (
                          <p className="mt-0.5 text-[#6E5849]">
                            {[
                              item.selectedVariants.flavor?.name,
                              item.selectedVariants.topping?.name,
                              item.selectedVariants.glaze?.name,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-[#2C1810] tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#E6D8C5] pt-3 text-sm font-bold text-[#2C1810]">
                  <span>Total Pembayaran</span>
                  <span className="tabular-nums">{formatRupiah(tracking.total)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-3 text-xs text-[#5C4435]">
                <span>Butuh bantuan mengenai pesanan ini?</span>
                <a
                  href={buildWhatsAppLink(
                    settings.whatsappNumber,
                    `Halo Admin ${settings.fullName}, saya ingin menanyakan status pesanan ${tracking.orderNumber}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#3B2316] underline hover:text-[#9E7840]"
                >
                  Hubungi Admin WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
