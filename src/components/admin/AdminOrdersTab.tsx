import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  MessageCircle,
  Printer,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  ClubConfig,
  CustomerAccount,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductShareRecord,
  ReferralRecord,
  StoreSettings,
} from '../../types';
import { adminUpdateOrderStatusFirebase } from '../../services/firebaseService';
import {
  buildWhatsAppLink,
  formatDateOnlyId,
  formatDateTimeId,
  formatRupiah,
  getOrderStatusBadge,
  getPaymentStatusBadge,
} from '../../utils/format';
import { ConfirmModal } from '../ConfirmModal';

interface AdminOrdersTabProps {
  actorName: string;
  orders: Order[];
  customers: CustomerAccount[];
  products: Product[];
  referrals: ReferralRecord[];
  productShares: ProductShareRecord[];
  clubConfig: ClubConfig;
  settings: StoreSettings;
  initialSelectedOrderId?: string | null;
  onOrdersUpdated?: () => Promise<void> | void;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Menunggu Konfirmasi',
  'Dikonfirmasi',
  'Sedang Diproses',
  'Siap Diambil',
  'Dalam Pengiriman',
  'Selesai',
  'Dibatalkan',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'Belum Dibayar',
  'Menunggu Verifikasi',
  'Lunas',
  'Dibatalkan',
];

export const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({
  actorName,
  orders,
  customers,
  products,
  referrals,
  productShares,
  clubConfig,
  settings,
  initialSelectedOrderId,
  onOrdersUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(() =>
    initialSelectedOrderId ? orders.find((o) => o.id === initialSelectedOrderId) || null : null,
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.orderStatus !== statusFilter) return false;
      if (dateFilter && order.orderDate !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchOrder = order.orderNumber.toLowerCase().includes(q);
        const matchName = order.customerName.toLowerCase().includes(q);
        const matchPhone = order.customerPhone.toLowerCase().includes(q);
        const matchCustId = (order.customerId || '').toLowerCase().includes(q);
        if (!matchOrder && !matchName && !matchPhone && !matchCustId) return false;
      }
      return true;
    });
  }, [orders, statusFilter, dateFilter, searchQuery]);

  const handleStatusChange = async (
    order: Order,
    payload: { orderStatus?: OrderStatus; paymentStatus?: PaymentStatus },
  ) => {
    setUpdatingId(order.id);
    setFeedbackMsg(null);
    const nextOrderStatus = payload.orderStatus ?? order.orderStatus;
    const nextPaymentStatus = payload.paymentStatus ?? order.paymentStatus;
    try {
      await adminUpdateOrderStatusFirebase({
        actorName,
        order,
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        customers,
        products,
        referrals,
        productShares,
        config: clubConfig,
      });
      if (onOrdersUpdated) await onOrdersUpdated();
      const willGrantRewards =
        nextOrderStatus === 'Selesai' &&
        nextPaymentStatus === 'Lunas' &&
        !order.isGuestOrder &&
        order.customerId.startsWith('DC-') &&
        !order.rewardsGranted;
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({
          ...order,
          orderStatus: nextOrderStatus,
          paymentStatus: nextPaymentStatus,
          rewardsGranted: order.rewardsGranted || willGrantRewards,
          updatedAt: new Date().toISOString(),
        });
      }
      const rewardNote =
        (order.rewardsGranted || willGrantRewards) && order.customerId.startsWith('DC-')
          ? ` Poin & stempel otomatis diproses ke ${order.customerId}.`
          : '';
      setFeedbackMsg(`Status pesanan ${order.orderNumber} berhasil diperbarui.${rewardNote}`);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Gagal memperbarui status pesanan.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">Kelola Pesanan</h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Konfirmasi pesanan, verifikasi pembayaran, perbarui progres dapur, dan cetak invoice.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-[#C89D54]/50 bg-[#FFFDF9] px-4 py-3 text-sm text-[#2C1810] no-print">
          {feedbackMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 sm:grid-cols-4 no-print">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. pesanan, nama pelanggan, atau WhatsApp..."
            className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2 pl-10 pr-3.5 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
        >
          <option value="ALL">Semua Status</option>
          {ORDER_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="rounded-xl border border-[#E6D8C5] px-2.5 py-2 text-xs text-[#6E5849] hover:bg-[#F6EFE4]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] text-xs font-semibold tracking-wider text-[#6E5849] uppercase">
              <tr>
                <th className="px-4 py-3.5">No. Pesanan</th>
                <th className="px-4 py-3.5">Pelanggan</th>
                <th className="px-4 py-3.5">Jadwal &amp; Metode</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5">Pembayaran</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E4D2]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#6E5849]">
                    Belum ada pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const ost = getOrderStatusBadge(order.orderStatus);
                  const pst = getPaymentStatusBadge(order.paymentStatus);
                  return (
                    <tr key={order.id} className="hover:bg-[#FBF6EE]/60">
                      <td className="font-mono-tabular px-4 py-3.5 font-semibold text-[#2C1810] whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-semibold text-[#2C1810]">
                          <span>{order.customerName}</span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              order.isGuestOrder || !order.customerId.startsWith('DC-')
                                ? 'bg-[#F2E7D6] text-[#6E5849]'
                                : 'bg-[#FDF2F5] text-[#8E2E49]'
                            }`}
                          >
                            {order.isGuestOrder ? 'TAMU' : order.customerId}
                          </span>
                        </div>
                        <div className="text-xs text-[#6E5849]">{order.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#5C4435]">
                        <div className="font-semibold text-[#2C1810]">{order.deliveryMethod}</div>
                        <div>
                          {order.orderDate} · {order.pickupDeliveryTime} WIB
                        </div>
                      </td>
                      <td className="font-mono-tabular px-4 py-3.5 text-right font-bold text-[#2C1810] whitespace-nowrap">
                        {formatRupiah(order.total)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${pst.bg} ${pst.text} ${pst.border}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ost.bg} ${ost.text} ${ost.border}`}
                        >
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4] whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Detail</span>
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

      {/* Order Detail & Invoice Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4 no-print">
              <div>
                <p className="text-xs font-medium text-[#9E7840]">Detail &amp; Invoice Pesanan</p>
                <h3 className="font-mono-tabular text-lg font-bold text-[#2C1810]">
                  {selectedOrder.orderNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
                  aria-label="Tutup detail pesanan"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Printable Invoice Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E6D8C5] pb-4">
                <div>
                  <h4 className="font-serif-display text-xl font-bold text-[#2C1810]">
                    {settings.fullName}
                  </h4>
                  <p className="text-xs text-[#5C4435]">{settings.address}</p>
                  <p className="text-xs text-[#5C4435]">WhatsApp: {settings.whatsappNumber}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-[#2C1810]">INVOICE PESANAN</p>
                  <p className="font-mono-tabular font-bold text-[#3B2316]">
                    {selectedOrder.orderNumber}
                  </p>
                  <p className="text-[#6E5849]">Dibuat: {formatDateTimeId(selectedOrder.createdAt)}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid gap-4 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="font-semibold text-[#3B2316] uppercase">Informasi Pelanggan</p>
                  <p>
                    Nama: <strong className="text-[#2C1810]">{selectedOrder.customerName}</strong>
                  </p>
                  <p>
                    WhatsApp:{' '}
                    <strong className="text-[#2C1810]">{selectedOrder.customerPhone}</strong>
                  </p>
                  <p>Alamat: {selectedOrder.customerAddress}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-[#3B2316] uppercase">Pengambilan &amp; Catatan</p>
                  <p>
                    Metode: <strong className="text-[#2C1810]">{selectedOrder.deliveryMethod}</strong>
                  </p>
                  <p>
                    Jadwal: {formatDateOnlyId(selectedOrder.orderDate)},{' '}
                    {selectedOrder.pickupDeliveryTime} WIB
                  </p>
                  <p>Catatan: {selectedOrder.notes || '-'}</p>
                </div>
              </div>

              {/* Line Items */}
              <div className="overflow-hidden rounded-xl border border-[#E6D8C5]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FBF6EE] text-[#6E5849] uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Produk &amp; Varian</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Harga Satuan</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E4D2]">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#2C1810]">{item.productName}</div>
                          {(item.selectedVariants.flavor ||
                            item.selectedVariants.topping ||
                            item.selectedVariants.glaze) && (
                            <div className="mt-0.5 text-[#6E5849]">
                              {[
                                item.selectedVariants.flavor &&
                                  `Rasa: ${item.selectedVariants.flavor.name}`,
                                item.selectedVariants.topping &&
                                  `Topping: ${item.selectedVariants.topping.name}`,
                                item.selectedVariants.glaze &&
                                  `Glaze: ${item.selectedVariants.glaze.name}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-0.5 italic text-[#6E5849]">
                              Catatan: {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{item.quantity}</td>
                        <td className="font-mono-tabular px-4 py-3 text-right tabular-nums">
                          {formatRupiah(item.unitPrice)}
                        </td>
                        <td className="font-mono-tabular px-4 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-1.5 border-t border-[#E6D8C5] bg-[#FBF6EE] px-4 py-3 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono-tabular font-semibold">
                      {formatRupiah(selectedOrder.subtotal)}
                    </span>
                  </div>
                  {Boolean(selectedOrder.voucherDiscount && selectedOrder.voucherDiscount > 0) && (
                    <div className="flex justify-between text-[#8E2E49]">
                      <span>Voucher ({selectedOrder.voucherCode})</span>
                      <span className="font-mono-tabular font-semibold">
                        -{formatRupiah(selectedOrder.voucherDiscount || 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Ongkos Kirim</span>
                    <span className="font-mono-tabular font-semibold">
                      {selectedOrder.shippingCost === 0
                        ? 'Gratis'
                        : formatRupiah(selectedOrder.shippingCost)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#E6D8C5] pt-2 text-sm font-bold text-[#2C1810]">
                    <span>Total Pembayaran</span>
                    <span className="font-mono-tabular">{formatRupiah(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Admin Status Controls */}
              <div className="space-y-4 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 no-print">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Status Pesanan
                    </label>
                    <select
                      disabled={updatingId === selectedOrder.id}
                      value={selectedOrder.orderStatus}
                      onChange={(e) => {
                        const val = e.target.value as OrderStatus;
                        if (val === 'Dibatalkan') {
                          setCancelTarget(selectedOrder);
                        } else {
                          handleStatusChange(selectedOrder, { orderStatus: val });
                        }
                      }}
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm font-medium text-[#2C1810]"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Status Pembayaran
                    </label>
                    <select
                      disabled={updatingId === selectedOrder.id}
                      value={selectedOrder.paymentStatus}
                      onChange={(e) =>
                        handleStatusChange(selectedOrder, {
                          paymentStatus: e.target.value as PaymentStatus,
                        })
                      }
                      className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm font-medium text-[#2C1810]"
                    >
                      {PAYMENT_STATUSES.map((pst) => (
                        <option key={pst} value={pst}>
                          {pst}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {selectedOrder.orderStatus === 'Menunggu Konfirmasi' && (
                    <button
                      type="button"
                      disabled={updatingId === selectedOrder.id}
                      onClick={() =>
                        handleStatusChange(selectedOrder, { orderStatus: 'Dikonfirmasi' })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#E7CFA2]" />
                      <span>Konfirmasi Pesanan</span>
                    </button>
                  )}

                  {selectedOrder.paymentStatus !== 'Lunas' &&
                    selectedOrder.orderStatus !== 'Dibatalkan' && (
                      <button
                        type="button"
                        disabled={updatingId === selectedOrder.id}
                        onClick={() =>
                          handleStatusChange(selectedOrder, { paymentStatus: 'Lunas' })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Konfirmasi Lunas</span>
                      </button>
                    )}

                  <a
                    href={buildWhatsAppLink(
                      selectedOrder.customerPhone,
                      `Halo Kak ${selectedOrder.customerName}, kami dari ${settings.fullName} ingin mengonfirmasi pesanan ${selectedOrder.orderNumber} dengan total ${formatRupiah(selectedOrder.total)}.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#9E7840]" />
                    <span>Chat Pelanggan (WA)</span>
                  </a>

                  {selectedOrder.orderStatus !== 'Dibatalkan' && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(selectedOrder)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Batalkan Pesanan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        title="Batalkan Pesanan?"
        message={`Anda yakin ingin membatalkan pesanan ${cancelTarget?.orderNumber}? Stok produk akan dikembalikan otomatis.`}
        confirmLabel="Ya, Batalkan Pesanan"
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) {
            await handleStatusChange(cancelTarget, {
              orderStatus: 'Dibatalkan',
              paymentStatus: 'Dibatalkan',
            });
            setCancelTarget(null);
          }
        }}
      />
    </div>
  );
};
