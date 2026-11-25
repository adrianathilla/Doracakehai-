import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Download,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  TicketPercent,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  CustomerAccount,
  Order,
  PointHistoryItem,
  Product,
  PromoCampaign,
  Voucher,
  VoucherType,
} from '../../types';
import {
  deleteCampaignFirebase,
  deleteVoucherFirebase,
  distributeVoucherToCustomersFirebase,
  saveCampaignFirebase,
  saveVoucherFirebase,
  toggleCampaignFirebase,
  toggleVoucherFirebase,
  updateVoucherFirebase,
} from '../../services/firebaseService';
import { buildWhatsAppLink, formatDateTimeId, formatRupiah } from '../../utils/format';
import { ConfirmModal } from '../ConfirmModal';

interface AdminMarketingAndReportsTabProps {
  section: 'vouchers' | 'campaigns' | 'reports';
  vouchers: Voucher[];
  campaigns: PromoCampaign[];
  orders: Order[];
  pointHistory: PointHistoryItem[];
  customers: CustomerAccount[];
  allProducts: Product[];
  actorName: string;
}

const VOUCHER_TYPES: VoucherType[] = [
  'Voucher Pelanggan Baru',
  'Voucher Referral',
  'Voucher Ulang Tahun',
  'Voucher Pembelian Kedua',
  'Voucher Pelanggan Loyal',
  'Voucher Produk Tertentu',
  'Voucher Kampanye Promosi',
];

export const AdminMarketingAndReportsTab: React.FC<AdminMarketingAndReportsTabProps> = ({
  section,
  vouchers,
  campaigns,
  orders,
  pointHistory,
  customers,
  allProducts,
  actorName,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create Voucher Form State
  const [vName, setVName] = useState('');
  const [vCode, setVCode] = useState('');
  const [vType, setVType] = useState<VoucherType>('Voucher Kampanye Promosi');
  const [vDiscountType, setVDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [vValue, setVValue] = useState('5000');
  const [vMinPurchase, setVMinPurchase] = useState('25000');
  const [vProductCodes, setVProductCodes] = useState('');
  const [vQuota, setVQuota] = useState('50');
  const [vPerUserLimit, setVPerUserLimit] = useState('1');
  const [vDistributionMode, setVDistributionMode] = useState<'template' | 'direct'>('template');
  const [vSelectedCustomerIds, setVSelectedCustomerIds] = useState<string[]>([]);
  const [vSaveMasterAlso, setVSaveMasterAlso] = useState(true);
  const [vPickerSearch, setVPickerSearch] = useState('');
  const [vValidUntil, setVValidUntil] = useState(
    new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  );

  // Send Existing Voucher Modal State
  const [sendModalVoucher, setSendModalVoucher] = useState<Voucher | null>(null);
  const [sendModalName, setSendModalName] = useState('');
  const [sendModalValidUntil, setSendModalValidUntil] = useState('');
  const [sendModalSearch, setSendModalSearch] = useState('');
  const [sendModalTier, setSendModalTier] = useState<string>('ALL');
  const [sendModalSelectedIds, setSendModalSelectedIds] = useState<string[]>([]);
  const [lastSentBatch, setLastSentBatch] = useState<
    Array<{
      customer: CustomerAccount;
      code: string;
      voucherName: string;
      discountLabel: string;
      validUntil: string;
    }>
  >([]);

  // Voucher View / Filter / Edit / Delete State
  const [voucherSubTab, setVoucherSubTab] = useState<'created' | 'circulating'>('created');
  const [voucherSearch, setVoucherSearch] = useState('');
  const [createdTypeFilter, setCreatedTypeFilter] = useState<string>('ALL');
  const [circulatingStatusFilter, setCirculatingStatusFilter] = useState<
    'ALL' | 'available' | 'used' | 'expired' | 'inactive'
  >('ALL');
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editType, setEditType] = useState<VoucherType>('Voucher Kampanye Promosi');
  const [editDiscountType, setEditDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [editValue, setEditValue] = useState('');
  const [editMinPurchase, setEditMinPurchase] = useState('');
  const [editProductCodes, setEditProductCodes] = useState('');
  const [editQuota, setEditQuota] = useState('1');
  const [editPerUserLimit, setEditPerUserLimit] = useState('1');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editAssignedCustomerId, setEditAssignedCustomerId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  // Campaign Form State
  const [cTitle, setCTitle] = useState('');
  const [cSubtitle, setCSubtitle] = useState('');
  const [cPromoCode, setCPromoCode] = useState('');
  const [cBadge, setCBadge] = useState('Kampanye Aktif');

  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerAccount>();
    for (const c of customers) {
      map.set(c.id, c);
    }
    return map;
  }, [customers]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const reportStats = useMemo(() => {
    const completedOrders = orders.filter((o) => o.orderStatus === 'Selesai');
    const totalRevenue = completedOrders.reduce((s, o) => s + o.total, 0);
    const pointsIn = pointHistory
      .filter((p) => p.type === 'Masuk')
      .reduce((s, p) => s + p.points, 0);
    const pointsOut = pointHistory
      .filter((p) => p.type === 'Keluar')
      .reduce((s, p) => s + p.points, 0);

    // Top products by qty sold
    const prodSalesMap = new Map<string, { name: string; qty: number; rev: number }>();
    for (const o of orders) {
      if (o.orderStatus === 'Dibatalkan') continue;
      for (const it of o.items) {
        const cur = prodSalesMap.get(it.productName) || { name: it.productName, qty: 0, rev: 0 };
        cur.qty += it.quantity;
        cur.rev += it.subtotal;
        prodSalesMap.set(it.productName, cur);
      }
    }
    const topProducts = [...prodSalesMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 5);
    return {
      completedCount: completedOrders.length,
      totalRevenue,
      pointsIn,
      pointsOut,
      topProducts,
    };
  }, [orders, pointHistory]);

  if (section === 'vouchers') {
    const today = new Date().toISOString().slice(0, 10);

    const createdVouchers = vouchers.filter((v) => !v.assignedCustomerId);
    const circulatingVouchers = vouchers.filter((v) => Boolean(v.assignedCustomerId));

    const getCirculatingState = (v: Voucher): 'available' | 'used' | 'expired' | 'inactive' => {
      if (v.usedCount >= v.quota) return 'used';
      if (v.validUntil && v.validUntil < today) return 'expired';
      if (!v.isActive) return 'inactive';
      return 'available';
    };

    const availableCirculatingCount = circulatingVouchers.filter(
      (v) => getCirculatingState(v) === 'available',
    ).length;
    const usedCirculatingCount = circulatingVouchers.filter(
      (v) => getCirculatingState(v) === 'used',
    ).length;
    const totalRedemptions = vouchers.reduce((s, v) => s + (v.usedCount || 0), 0);

    const queryLower = voucherSearch.trim().toLowerCase();

    const filteredCreatedVouchers = createdVouchers.filter((v) => {
      if (createdTypeFilter !== 'ALL' && v.type !== createdTypeFilter) return false;
      if (queryLower) {
        const matchCode = v.code.toLowerCase().includes(queryLower);
        const matchName = v.name.toLowerCase().includes(queryLower);
        const matchType = v.type.toLowerCase().includes(queryLower);
        if (!matchCode && !matchName && !matchType) return false;
      }
      return true;
    });

    const filteredCirculatingVouchers = circulatingVouchers.filter((v) => {
      const state = getCirculatingState(v);
      if (circulatingStatusFilter !== 'ALL' && state !== circulatingStatusFilter) return false;
      if (queryLower) {
        const holder = v.assignedCustomerId ? customerMap.get(v.assignedCustomerId) : undefined;
        const matchCode = v.code.toLowerCase().includes(queryLower);
        const matchName = v.name.toLowerCase().includes(queryLower);
        const matchCustId = (v.assignedCustomerId || '').toLowerCase().includes(queryLower);
        const matchCustName = (holder?.name || '').toLowerCase().includes(queryLower);
        const matchPhone = (holder?.phone || '').toLowerCase().includes(queryLower);
        if (!matchCode && !matchName && !matchCustId && !matchCustName && !matchPhone) return false;
      }
      return true;
    });

    const generalVoucherRedeemers = createdVouchers.flatMap((v) =>
      Object.entries(v.usedByCustomerIds || {}).map(([uidKey, count]) => {
        const holder = customerMap.get(uidKey);
        return {
          voucher: v,
          holderId: uidKey,
          holderName: holder ? holder.name : uidKey === 'GUEST' ? 'Pelanggan Tamu' : uidKey,
          holderPhone: holder?.phone || '-',
          usageCount: count,
        };
      }),
    );

    const openEditModal = (v: Voucher) => {
      setErrorMsg(null);
      setEditingVoucher(v);
      setEditName(v.name);
      setEditCode(v.code);
      setEditType(v.type);
      setEditDiscountType(v.discountType);
      setEditValue(String(v.discountValue));
      setEditMinPurchase(String(v.minPurchase));
      setEditProductCodes((v.applicableProductCodes || []).join(', '));
      setEditQuota(String(v.quota));
      setEditPerUserLimit(String(v.perUserLimit || 1));
      setEditValidUntil(v.validUntil);
      setEditAssignedCustomerId(v.assignedCustomerId || '');
      setEditIsActive(v.isActive);
    };

    const activeCustomers = sortedCustomers.filter((c) => c.status === 'Aktif');

    const toggleCreateSelectedCustomer = (customerId: string) => {
      setVSelectedCustomerIds((prev) =>
        prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId],
      );
    };

    const toggleSendModalCustomer = (customerId: string) => {
      setSendModalSelectedIds((prev) =>
        prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId],
      );
    };

    const openSendModal = (v: Voucher) => {
      setErrorMsg(null);
      setSendModalVoucher(v);
      setSendModalName(v.name);
      setSendModalValidUntil(
        v.validUntil >= today
          ? v.validUntil
          : new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
      );
      setSendModalSearch('');
      setSendModalTier('ALL');
      setSendModalSelectedIds([]);
    };

    const handleCreateVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      const code = vCode.trim().toUpperCase().replace(/\s+/g, '');
      if (!vName.trim() || code.length < 2) {
        setErrorMsg('Nama voucher dan kode voucher (minimal 2 karakter) wajib diisi.');
        return;
      }
      if (
        (vDistributionMode === 'template' || vSaveMasterAlso) &&
        vouchers.some((v) => v.code.toUpperCase() === code)
      ) {
        setErrorMsg(`Kode voucher "${code}" sudah digunakan.`);
        return;
      }
      if (vDistributionMode === 'direct' && vSelectedCustomerIds.length === 0) {
        setErrorMsg('Pilih minimal 1 pelanggan untuk dikirimi voucher secara langsung.');
        return;
      }

      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      setLastSentBatch([]);
      try {
        const cleanDiscount =
          vDiscountType === 'percentage'
            ? Math.min(100, Math.max(1, Number(vValue) || 10))
            : Math.max(1, Number(vValue) || 1000);
        const cleanMinPurchase = Math.max(0, Number(vMinPurchase) || 0);
        const productCodesList = vProductCodes
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);

        if (vDistributionMode === 'template' || vSaveMasterAlso) {
          await saveVoucherFirebase(
            actorName,
            {
              name: vName.trim(),
              code,
              type: vType,
              discountType: vDiscountType,
              discountValue: cleanDiscount,
              minPurchase: cleanMinPurchase,
              applicableProductCodes: productCodesList,
              quota: Math.max(1, Number(vQuota) || 1),
              perUserLimit: Math.max(1, Number(vPerUserLimit) || 1),
              validUntil: vValidUntil,
              isActive: true,
              assignedCustomerId: '',
            },
            customers,
          );
        }

        if (vDistributionMode === 'direct') {
          const targets = activeCustomers.filter((c) => vSelectedCustomerIds.includes(c.id));
          const sent = await distributeVoucherToCustomersFirebase({
            actorName,
            template: {
              name: vName.trim(),
              code,
              type: vType,
              discountType: vDiscountType,
              discountValue: cleanDiscount,
              minPurchase: cleanMinPurchase,
              applicableProductCodes: productCodesList,
              validUntil: vValidUntil,
            },
            targetCustomers: targets,
            existingVouchers: vouchers,
          });
          const discountLabel =
            vDiscountType === 'percentage' ? `${cleanDiscount}%` : formatRupiah(cleanDiscount);
          setLastSentBatch(
            sent.map((s) => ({
              ...s,
              voucherName: vName.trim(),
              discountLabel,
              validUntil: vValidUntil,
            })),
          );
          setVoucherSubTab('circulating');
          setFeedback(
            `Voucher "${vName.trim()}" berhasil dikirim ke ${sent.length} pelanggan${
              vSaveMasterAlso ? ' dan disimpan ke Daftar Voucher Tercipta' : ''
            }.`,
          );
        } else {
          setVoucherSubTab('created');
          setFeedback(`Voucher ${code} berhasil disimpan ke Daftar Voucher Tercipta.`);
        }

        setVName('');
        setVCode('');
        setVProductCodes('');
        setVSelectedCustomerIds([]);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat voucher.');
      } finally {
        setBusy(false);
      }
    };

    const handleSendExistingVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!sendModalVoucher) return;
      if (sendModalSelectedIds.length === 0) {
        setErrorMsg('Pilih minimal 1 pelanggan penerima voucher.');
        return;
      }
      const targets = activeCustomers.filter((c) => sendModalSelectedIds.includes(c.id));
      if (targets.length === 0) {
        setErrorMsg('Pelanggan yang dipilih tidak ditemukan atau sedang nonaktif.');
        return;
      }

      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        const finalName = sendModalName.trim() || sendModalVoucher.name;
        const finalExpiry = sendModalValidUntil || sendModalVoucher.validUntil;
        const sent = await distributeVoucherToCustomersFirebase({
          actorName,
          template: {
            name: finalName,
            code: sendModalVoucher.code,
            type: sendModalVoucher.type,
            discountType: sendModalVoucher.discountType,
            discountValue: sendModalVoucher.discountValue,
            minPurchase: sendModalVoucher.minPurchase,
            applicableProductCodes: sendModalVoucher.applicableProductCodes || [],
            validUntil: finalExpiry,
          },
          targetCustomers: targets,
          existingVouchers: vouchers,
        });
        const discountLabel =
          sendModalVoucher.discountType === 'percentage'
            ? `${sendModalVoucher.discountValue}%`
            : formatRupiah(sendModalVoucher.discountValue);
        setLastSentBatch(
          sent.map((s) => ({
            ...s,
            voucherName: finalName,
            discountLabel,
            validUntil: finalExpiry,
          })),
        );
        setSendModalVoucher(null);
        setVoucherSubTab('circulating');
        setFeedback(
          `Voucher "${finalName}" berhasil dikirim ke ${sent.length} pelanggan dan kini tampil di Voucher Beredar.`,
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim voucher ke pelanggan.');
      } finally {
        setBusy(false);
      }
    };

    const handleUpdateVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingVoucher) return;
      const cleanCode = editCode.trim().toUpperCase().replace(/\s+/g, '');
      if (!editName.trim() || cleanCode.length < 2) {
        setErrorMsg('Nama voucher dan kode voucher (minimal 2 karakter) wajib diisi.');
        return;
      }
      if (vouchers.some((v) => v.id !== editingVoucher.id && v.code.toUpperCase() === cleanCode)) {
        setErrorMsg(`Kode voucher "${cleanCode}" sudah dipakai voucher lain.`);
        return;
      }
      const nextQuota = Number(editQuota) || 1;
      if (nextQuota < editingVoucher.usedCount) {
        setErrorMsg(
          `Kuota tidak boleh lebih kecil dari jumlah yang sudah terpakai (${editingVoucher.usedCount}).`,
        );
        return;
      }

      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        await updateVoucherFirebase(
          actorName,
          editingVoucher,
          {
            name: editName.trim(),
            code: cleanCode,
            type: editType,
            discountType: editDiscountType,
            discountValue:
              editDiscountType === 'percentage'
                ? Math.min(100, Math.max(1, Number(editValue) || 1))
                : Math.max(1, Number(editValue) || 1),
            minPurchase: Math.max(0, Number(editMinPurchase) || 0),
            applicableProductCodes: editProductCodes
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
            quota: nextQuota,
            perUserLimit: Math.max(1, Number(editPerUserLimit) || 1),
            validUntil: editValidUntil,
            isActive: editIsActive,
            assignedCustomerId: editAssignedCustomerId || '',
          },
          customers,
        );
        setFeedback(`Voucher ${cleanCode} berhasil diperbarui.`);
        setEditingVoucher(null);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui voucher.');
      } finally {
        setBusy(false);
      }
    };

    const handleConfirmDelete = async () => {
      if (!deleteTarget) return;
      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        await deleteVoucherFirebase(actorName, deleteTarget);
        setFeedback(`Voucher ${deleteTarget.code} berhasil dihapus.`);
        setDeleteTarget(null);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus voucher.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Kelola Voucher &amp; Sirkulasi Pemegang
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Kelola Daftar Voucher Tercipta, pantau Voucher yang Beredar beserta pemegangnya, dan edit voucher kapan saja jika ada data yang perlu diperbaiki.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">
              Daftar Voucher Tercipta
            </p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2C1810]">
              {createdVouchers.length}
            </p>
            <p className="mt-0.5 text-xs text-[#6E5849]">
              Voucher promo/umum yang dibuat Admin
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">
              Voucher Beredar di Pelanggan
            </p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#8E2E49]">
              {circulatingVouchers.length}
            </p>
            <p className="mt-0.5 text-xs text-[#6E5849]">
              {availableCirculatingCount} tersedia · {usedCirculatingCount} sudah dipakai
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">Total Pemakaian</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-emerald-700">
              {totalRedemptions}x
            </p>
            <p className="mt-0.5 text-xs text-[#6E5849]">
              Total voucher terpakai di seluruh pesanan
            </p>
          </div>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        {lastSentBatch.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-[#8E2E49]/30 bg-[#FDF2F5] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#8E2E49]">
                  Pengiriman Voucher Berhasil ({lastSentBatch.length} Pelanggan)
                </p>
                <p className="text-[#5C4435]">
                  Voucher sudah masuk ke akun masing-masing pelanggan. Anda juga dapat mengirim pemberitahuan lewat WhatsApp di bawah ini:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLastSentBatch([])}
                className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 font-semibold text-[#6E5849] hover:bg-[#F6EFE4]"
              >
                Tutup Info
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {lastSentBatch.map((item) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#2C1810]">
                      {item.customer.name} ({item.customer.id})
                    </p>
                    <p className="font-mono-tabular text-[11px] font-semibold text-[#8E2E49]">
                      Kode: {item.code}
                    </p>
                  </div>
                  <a
                    href={buildWhatsAppLink(
                      item.customer.phone,
                      `Halo Kak ${item.customer.name}!\n\nAda voucher spesial untuk Kakak di DoraCake Customer Club:\n• Voucher: ${item.voucherName}\n• Kode Pribadi: ${item.code}\n• Potongan: ${item.discountLabel}\n• Berlaku s/d: ${item.validUntil}\n\nSilakan login & gunakan langsung saat checkout di DoraCake ya!`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3B2316] px-2.5 py-1.5 text-[11px] font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#E7CFA2]" />
                    <span>Kirim WA</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Voucher Form */}
        <form
          onSubmit={handleCreateVoucher}
          className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-[#2C1810]">
              <Plus className="h-4 w-4 text-[#8E2E49]" />
              <span>Buat Voucher Baru (Sesuai Ide Anda)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setVDistributionMode('template')}
                className={`rounded-xl px-3 py-1.5 font-semibold transition-colors ${
                  vDistributionMode === 'template'
                    ? 'bg-[#3B2316] text-[#FBF6EE]'
                    : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316]'
                }`}
              >
                Simpan ke Daftar Tercipta
              </button>
              <button
                type="button"
                onClick={() => setVDistributionMode('direct')}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-semibold transition-colors ${
                  vDistributionMode === 'direct'
                    ? 'bg-[#8E2E49] text-white'
                    : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316]'
                }`}
              >
                <Send className="h-3 w-3" />
                <span>Kirim ke Pelanggan Pilihan ({vSelectedCustomerIds.length})</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block font-semibold text-[#3B2316]">Nama Voucher *</label>
              <input
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Contoh: Traktiran Pelanggan Setia"
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Kode Voucher Dasar *</label>
              <input
                type="text"
                required
                value={vCode}
                onChange={(e) => setVCode(e.target.value.toUpperCase())}
                placeholder="SPECIAL10K"
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Jenis Voucher</label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value as VoucherType)}
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              >
                {VOUCHER_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Tipe &amp; Nilai Potongan</label>
              <div className="mt-1 flex gap-1.5">
                <select
                  value={vDiscountType}
                  onChange={(e) => setVDiscountType(e.target.value as 'fixed' | 'percentage')}
                  className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-2 py-2 text-xs"
                >
                  <option value="fixed">Rp</option>
                  <option value="percentage">%</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={vDiscountType === 'percentage' ? 100 : 10000000}
                  value={vValue}
                  onChange={(e) => setVValue(e.target.value)}
                  className="font-mono-tabular min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Min. Belanja (Rp)</label>
              <input
                type="number"
                min={0}
                value={vMinPurchase}
                onChange={(e) => setVMinPurchase(e.target.value)}
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">
                Kode Produk Khusus (Opsional)
              </label>
              <input
                type="text"
                value={vProductCodes}
                onChange={(e) => setVProductCodes(e.target.value.toUpperCase())}
                placeholder="Mis. CK001, GB002"
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[#3B2316]">Kuota Umum</label>
                <input
                  type="number"
                  min={1}
                  value={vQuota}
                  onChange={(e) => setVQuota(e.target.value)}
                  className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3B2316]">Batas/Akun</label>
                <input
                  type="number"
                  min={1}
                  value={vPerUserLimit}
                  onChange={(e) => setVPerUserLimit(e.target.value)}
                  className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Berlaku Sampai</label>
              <input
                type="date"
                value={vValidUntil}
                onChange={(e) => setVValidUntil(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {vDistributionMode === 'direct' && (
            <div className="space-y-3 rounded-2xl border border-[#8E2E49]/25 bg-[#FDF2F5]/60 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#8E2E49]">
                    Pilih Pelanggan Penerima Voucher (Bisa Pilih 1 atau Banyak)
                  </p>
                  <p className="text-[11px] text-[#5C4435]">
                    Setiap pelanggan terpilih mendapat kode voucher unik pribadi dan langsung masuk ke dompet mereka.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVSelectedCustomerIds(activeCustomers.map((c) => c.id))}
                    className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 font-semibold text-[#3B2316] hover:bg-[#F6EFE4]"
                  >
                    Pilih Semua ({activeCustomers.length})
                  </button>
                  {vSelectedCustomerIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVSelectedCustomerIds([])}
                      className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 font-semibold text-[#6E5849]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7362]" />
                <input
                  type="search"
                  value={vPickerSearch}
                  onChange={(e) => setVPickerSearch(e.target.value)}
                  placeholder="Cari nama pelanggan, ID (DC-xxxxxx), atau nomor WA..."
                  className="w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] py-2 pl-8 pr-3 text-xs"
                />
              </div>

              {activeCustomers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E6D8C5] bg-[#FFFDF9] p-4 text-center text-[#6E5849]">
                  Belum ada pelanggan aktif. Tambahkan pelanggan terlebih dahulu di menu Tambah Pelanggan.
                </p>
              ) : (
                <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {activeCustomers
                    .filter((c) => {
                      const q = vPickerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        c.name.toLowerCase().includes(q) ||
                        c.id.toLowerCase().includes(q) ||
                        c.phone.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => {
                      const checked = vSelectedCustomerIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCreateSelectedCustomer(c.id)}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                            checked
                              ? 'border-[#8E2E49] bg-[#FFFDF9] ring-1 ring-[#8E2E49]'
                              : 'border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#FBF6EE]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#2C1810]">{c.name}</p>
                            <p className="font-mono-tabular truncate text-[10px] text-[#6E5849]">
                              {c.id} · {c.phone}
                            </p>
                          </div>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              checked
                                ? 'border-[#8E2E49] bg-[#8E2E49] text-white'
                                : 'border-[#D7C5B4] bg-[#FBF6EE]'
                            }`}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 pt-1 text-[11px] font-medium text-[#3B2316]">
                <input
                  type="checkbox"
                  checked={vSaveMasterAlso}
                  onChange={(e) => setVSaveMasterAlso(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#8E2E49]"
                />
                <span>
                  Simpan juga master-nya di <strong>Daftar Voucher Tercipta</strong> (supaya nanti bisa dikirim lagi ke pelanggan lain tanpa mengetik ulang)
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[#6E5849]">
              {vDistributionMode === 'template'
                ? 'Voucher akan masuk ke Daftar Voucher Tercipta dan bisa Anda kirim manual kapan saja ke pelanggan tertentu.'
                : `Siap mengirim voucher pribadi ke ${vSelectedCustomerIds.length} pelanggan terpilih.`}
            </p>
            <button
              type="submit"
              disabled={busy}
              className={`rounded-xl px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-60 ${
                vDistributionMode === 'direct'
                  ? 'bg-[#8E2E49] hover:bg-[#77243C]'
                  : 'bg-[#3B2316] hover:bg-[#4F3020]'
              }`}
            >
              {busy
                ? 'Menyimpan...'
                : vDistributionMode === 'direct'
                  ? `Buat & Kirim ke ${vSelectedCustomerIds.length} Pelanggan`
                  : 'Simpan ke Daftar Voucher Tercipta'}
            </button>
          </div>
        </form>

        {/* Sub-Tabs & Filter Bar */}
        <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVoucherSubTab('created')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  voucherSubTab === 'created'
                    ? 'bg-[#3B2316] text-[#FBF6EE]'
                    : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:bg-[#F2E7D6]'
                }`}
              >
                <TicketPercent className="h-3.5 w-3.5" />
                <span>Daftar Voucher Tercipta ({createdVouchers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setVoucherSubTab('circulating')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  voucherSubTab === 'circulating'
                    ? 'bg-[#8E2E49] text-white'
                    : 'border border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:bg-[#F2E7D6]'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Voucher Beredar &amp; Pemegangnya ({circulatingVouchers.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7362]" />
                <input
                  type="search"
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  placeholder="Cari kode, nama voucher, atau pelanggan..."
                  className="w-60 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-1.5 pl-8 pr-3 text-xs text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
                />
              </div>

              {voucherSubTab === 'created' ? (
                <select
                  value={createdTypeFilter}
                  onChange={(e) => setCreatedTypeFilter(e.target.value)}
                  className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs text-[#2C1810]"
                >
                  <option value="ALL">Semua Jenis Voucher</option>
                  {VOUCHER_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={circulatingStatusFilter}
                  onChange={(e) =>
                    setCirculatingStatusFilter(
                      e.target.value as 'ALL' | 'available' | 'used' | 'expired' | 'inactive',
                    )
                  }
                  className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs text-[#2C1810]"
                >
                  <option value="ALL">Semua Status Beredar</option>
                  <option value="available">Tersedia di Pelanggan</option>
                  <option value="used">Sudah Dipakai</option>
                  <option value="expired">Kedaluwarsa</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              )}
            </div>
          </div>

          {/* Sub-Tab 1: Daftar Voucher Tercipta */}
          {voucherSubTab === 'created' && (
            <div className="space-y-3">
              {filteredCreatedVouchers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E6D8C5] bg-[#FBF6EE]/60 p-8 text-center text-xs text-[#6E5849]">
                  Belum ada voucher umum di Daftar Voucher Tercipta yang cocok dengan filter.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredCreatedVouchers.map((v) => {
                    const isExpired = Boolean(v.validUntil && v.validUntil < today);
                    const isQuotaOut = v.usedCount >= v.quota;
                    const redeemerEntries = Object.entries(v.usedByCustomerIds || {});
                    return (
                      <div
                        key={v.id}
                        className="flex flex-col justify-between rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE]/45 p-4 text-xs"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#8E2E49]">
                              <TicketPercent className="h-3.5 w-3.5" />
                              {v.type}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isExpired && (
                                <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                  Kedaluwarsa
                                </span>
                              )}
                              {isQuotaOut && (
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Kuota Habis
                                </span>
                              )}
                              <span className="font-mono-tabular rounded bg-[#FFFDF9] border border-[#E6D8C5] px-2 py-0.5 font-bold text-[#2C1810]">
                                {v.code}
                              </span>
                            </div>
                          </div>
                          <h4 className="mt-2 text-sm font-bold text-[#2C1810]">{v.name}</h4>
                          <p className="mt-1 text-[#5C4435]">
                            Potongan:{' '}
                            <strong>
                              {v.discountType === 'percentage'
                                ? `${v.discountValue}%`
                                : formatRupiah(v.discountValue)}
                            </strong>{' '}
                            · Min. belanja {formatRupiah(v.minPurchase)}
                          </p>
                          <p className="mt-0.5 text-[#6E5849]">
                            Terpakai: <strong>{v.usedCount}/{v.quota}</strong> · Maks.{' '}
                            {v.perUserLimit}/akun · Berlaku s/d {v.validUntil}
                          </p>
                          {v.applicableProductCodes.length > 0 && (
                            <p className="mt-0.5 text-[#6E5849]">
                              Produk khusus: {v.applicableProductCodes.join(', ')}
                            </p>
                          )}
                          {redeemerEntries.length > 0 && (
                            <div className="mt-2 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] p-2.5 text-[11px] text-[#5C4435]">
                              <p className="font-semibold text-[#2C1810]">
                                Dipakai oleh ({redeemerEntries.length} akun):
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {redeemerEntries.slice(0, 6).map(([uid, count]) => {
                                  const cust = customerMap.get(uid);
                                  return (
                                    <span
                                      key={uid}
                                      className="rounded-md bg-[#FBF6EE] px-2 py-0.5 text-[10px] font-medium text-[#3B2316]"
                                    >
                                      {cust ? `${cust.name} (${cust.id})` : uid} · {count}x
                                    </span>
                                  );
                                })}
                                {redeemerEntries.length > 6 && (
                                  <span className="text-[10px] text-[#6E5849]">
                                    +{redeemerEntries.length - 6} lainnya
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6D8C5] pt-2.5">
                          <span className="text-[10px] text-[#8C7362]">
                            Dibuat: {formatDateTimeId(v.createdAt)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openSendModal(v)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#8E2E49] px-2.5 py-1 font-semibold text-white hover:bg-[#77243C]"
                            >
                              <Send className="h-3 w-3" />
                              <span>Kirim ke Pelanggan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(v)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleVoucherFirebase(v)}
                              className={`rounded-lg border px-2.5 py-1 font-semibold ${
                                v.isActive
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-[#E6D8C5] bg-[#FFFDF9] text-[#6E5849]'
                              }`}
                            >
                              {v.isActive ? 'Aktif' : 'Nonaktif'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(v)}
                              className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                              aria-label={`Hapus voucher ${v.code}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Voucher yang Beredar beserta Pemegangnya */}
          {voucherSubTab === 'circulating' && (
            <div className="space-y-4">
              {filteredCirculatingVouchers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E6D8C5] bg-[#FBF6EE]/60 p-8 text-center text-xs text-[#6E5849]">
                  Belum ada voucher pribadi yang beredar di dompet pelanggan untuk filter ini.
                  <br />
                  Voucher beredar akan muncul saat member mendaftar, mendapat hadiah referral, menukar poin/stempel, atau saat Admin mengirim voucher langsung ke pelanggan.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredCirculatingVouchers.map((v) => {
                    const holder = v.assignedCustomerId
                      ? customerMap.get(v.assignedCustomerId)
                      : undefined;
                    const state = getCirculatingState(v);
                    const stateBadge =
                      state === 'available'
                        ? {
                            label: 'Tersedia di Pelanggan',
                            cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                          }
                        : state === 'used'
                          ? {
                              label: 'Sudah Dipakai',
                              cls: 'border-amber-200 bg-amber-50 text-amber-800',
                            }
                          : state === 'expired'
                            ? {
                                label: 'Kedaluwarsa',
                                cls: 'border-rose-200 bg-rose-50 text-rose-700',
                              }
                            : {
                                label: 'Nonaktif',
                                cls: 'border-[#E6D8C5] bg-[#FBF6EE] text-[#6E5849]',
                              };

                    return (
                      <div
                        key={v.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE]/45 p-4 text-xs sm:flex-row sm:items-center"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#FDF2F5] px-2.5 py-1 font-bold text-[#8E2E49]">
                              <UserCheck className="h-3.5 w-3.5" />
                              {holder ? holder.name : 'Member Terdaftar'} ({v.assignedCustomerId})
                            </span>
                            {holder?.phone && (
                              <span className="text-[11px] text-[#6E5849]">
                                WA: {holder.phone} · {holder.tier}
                              </span>
                            )}
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${stateBadge.cls}`}
                            >
                              {stateBadge.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular rounded border border-[#E6D8C5] bg-[#FFFDF9] px-2 py-0.5 font-bold text-[#2C1810]">
                              {v.code}
                            </span>
                            <span className="text-sm font-bold text-[#2C1810]">{v.name}</span>
                            <span className="text-[11px] text-[#8E2E49] font-semibold">
                              ({v.type})
                            </span>
                          </div>

                          <p className="text-[#5C4435]">
                            Potongan:{' '}
                            <strong>
                              {v.discountType === 'percentage'
                                ? `${v.discountValue}%`
                                : formatRupiah(v.discountValue)}
                            </strong>{' '}
                            · Min. belanja {formatRupiah(v.minPurchase)} · Terpakai {v.usedCount}/
                            {v.quota} · Berlaku s/d {v.validUntil}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                          {holder?.phone && (
                            <a
                              href={buildWhatsAppLink(
                                holder.phone,
                                `Halo Kak ${holder.name}!\n\nVoucher DoraCake Customer Club untuk Kakak siap dipakai:\n• Voucher: ${v.name}\n• Kode: ${v.code}\n• Potongan: ${
                                  v.discountType === 'percentage'
                                    ? `${v.discountValue}%`
                                    : formatRupiah(v.discountValue)
                                }\n• Berlaku s/d: ${v.validUntil}\n\nSilakan cek di dompet voucher Kakak saat belanja di DoraCake ya!`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1.5 font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-[#8E2E49]" />
                              <span>Info WA</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(v)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleVoucherFirebase(v)}
                            className={`rounded-lg border px-3 py-1.5 font-semibold ${
                              v.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-[#E6D8C5] bg-[#FFFDF9] text-[#6E5849]'
                            }`}
                          >
                            {v.isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(v)}
                            className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                            aria-label={`Hapus voucher ${v.code}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {generalVoucherRedeemers.length > 0 && (
                <div className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE]/60 p-4">
                  <h4 className="text-xs font-bold uppercase text-[#3B2316]">
                    Riwayat Pemakaian Voucher Umum oleh Pelanggan ({generalVoucherRedeemers.length})
                  </h4>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {generalVoucherRedeemers.map((entry, idx) => (
                      <div
                        key={`${entry.voucher.id}-${entry.holderId}-${idx}`}
                        className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#2C1810]">
                            {entry.holderName}{' '}
                            <span className="font-mono-tabular text-[11px] text-[#6E5849]">
                              ({entry.holderId})
                            </span>
                          </p>
                          <p className="text-[11px] text-[#5C4435]">
                            Kode: <strong>{entry.voucher.code}</strong> · {entry.voucher.name}
                          </p>
                        </div>
                        <span className="rounded-lg bg-[#FDF2F5] px-2 py-0.5 text-[11px] font-bold text-[#8E2E49]">
                          Dipakai {entry.usageCount}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Voucher Modal */}
        {editingVoucher && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
                <div>
                  <p className="text-xs font-semibold text-[#8E2E49]">Edit Data Voucher</p>
                  <h3 className="font-mono-tabular text-lg font-bold text-[#2C1810]">
                    {editingVoucher.code}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
                  aria-label="Tutup modal edit voucher"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateVoucher} className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Nama Voucher *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Kode Voucher *</label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                      className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Jenis Voucher</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as VoucherType)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    >
                      {VOUCHER_TYPES.map((vt) => (
                        <option key={vt} value={vt}>
                          {vt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Pemegang Voucher</label>
                    <select
                      value={editAssignedCustomerId}
                      onChange={(e) => setEditAssignedCustomerId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    >
                      <option value="">Umum (Daftar Voucher Tercipta)</option>
                      {sortedCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Tipe &amp; Nilai Potongan</label>
                    <div className="mt-1 flex gap-1.5">
                      <select
                        value={editDiscountType}
                        onChange={(e) =>
                          setEditDiscountType(e.target.value as 'fixed' | 'percentage')
                        }
                        className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-2 text-xs"
                      >
                        <option value="fixed">Rp</option>
                        <option value="percentage">%</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={editDiscountType === 'percentage' ? 100 : 10000000}
                        required
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="font-mono-tabular min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Min. Belanja (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editMinPurchase}
                      onChange={(e) => setEditMinPurchase(e.target.value)}
                      className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">
                      Kode Produk Khusus (Opsional)
                    </label>
                    <input
                      type="text"
                      value={editProductCodes}
                      onChange={(e) => setEditProductCodes(e.target.value.toUpperCase())}
                      placeholder="Kosongkan untuk semua produk"
                      className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-[#3B2316]">
                        Kuota (Terpakai: {editingVoucher.usedCount})
                      </label>
                      <input
                        type="number"
                        min={Math.max(1, editingVoucher.usedCount)}
                        required
                        value={editQuota}
                        onChange={(e) => setEditQuota(e.target.value)}
                        className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#3B2316]">Batas/Akun</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={editPerUserLimit}
                        onChange={(e) => setEditPerUserLimit(e.target.value)}
                        className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Berlaku Sampai</label>
                    <input
                      type="date"
                      required
                      value={editValidUntil}
                      onChange={(e) => setEditValidUntil(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-xs font-semibold text-[#2C1810]">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#3B2316]"
                      />
                      <span>Voucher Aktif</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E6D8C5] pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingVoucher(null)}
                    disabled={busy}
                    className="rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-[#3B2316] px-5 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
                  >
                    {busy ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Send Existing Voucher to Selected Customers Modal */}
        {sendModalVoucher && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
                <div>
                  <p className="text-xs font-semibold text-[#8E2E49]">
                    Kirim Voucher ke Pelanggan Secara Manual
                  </p>
                  <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    {sendModalVoucher.name} ({sendModalVoucher.code})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSendModalVoucher(null)}
                  className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
                  aria-label="Tutup modal kirim voucher"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSendExistingVoucher}
                className="flex flex-1 flex-col space-y-4 overflow-y-auto p-6 text-xs"
              >
                <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3 text-[#5C4435]">
                  Potongan:{' '}
                  <strong className="text-[#2C1810]">
                    {sendModalVoucher.discountType === 'percentage'
                      ? `${sendModalVoucher.discountValue}%`
                      : formatRupiah(sendModalVoucher.discountValue)}
                  </strong>{' '}
                  · Min. belanja {formatRupiah(sendModalVoucher.minPurchase)} · Jenis:{' '}
                  {sendModalVoucher.type}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-[#3B2316]">
                      Nama Voucher yang Diterima Pelanggan
                    </label>
                    <input
                      type="text"
                      required
                      value={sendModalName}
                      onChange={(e) => setSendModalName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#3B2316]">Berlaku Sampai</label>
                    <input
                      type="date"
                      required
                      value={sendModalValidUntil}
                      onChange={(e) => setSendModalValidUntil(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#2C1810]">
                      Pilih Pelanggan ({sendModalSelectedIds.length} dipilih)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const visibleIds = activeCustomers
                            .filter((c) => {
                              if (sendModalTier !== 'ALL' && c.tier !== sendModalTier) return false;
                              const q = sendModalSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                c.name.toLowerCase().includes(q) ||
                                c.id.toLowerCase().includes(q) ||
                                c.phone.toLowerCase().includes(q)
                              );
                            })
                            .map((c) => c.id);
                          setSendModalSelectedIds(visibleIds);
                        }}
                        className="rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1 font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
                      >
                        Pilih Semua yang Tampil
                      </button>
                      {sendModalSelectedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSendModalSelectedIds([])}
                          className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 font-semibold text-[#6E5849]"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="relative sm:col-span-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7362]" />
                      <input
                        type="search"
                        value={sendModalSearch}
                        onChange={(e) => setSendModalSearch(e.target.value)}
                        placeholder="Cari nama, ID DC-xxxxxx, atau WhatsApp..."
                        className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2 pl-8 pr-3 text-xs"
                      />
                    </div>
                    <select
                      value={sendModalTier}
                      onChange={(e) => setSendModalTier(e.target.value)}
                      className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-xs"
                    >
                      <option value="ALL">Semua Tier Member</option>
                      <option value="Cakeers Member">Cakeers Member</option>
                      <option value="Cakeers Silver">Cakeers Silver</option>
                      <option value="Cakeers Gold">Cakeers Gold</option>
                      <option value="Cakeers Loyal">Cakeers Loyal</option>
                    </select>
                  </div>

                  {activeCustomers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E6D8C5] bg-[#FBF6EE]/60 p-6 text-center text-[#6E5849]">
                      Belum ada pelanggan aktif di sistem.
                    </div>
                  ) : (
                    <div className="grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {activeCustomers
                        .filter((c) => {
                          if (sendModalTier !== 'ALL' && c.tier !== sendModalTier) return false;
                          const q = sendModalSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.id.toLowerCase().includes(q) ||
                            c.phone.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => {
                          const checked = sendModalSelectedIds.includes(c.id);
                          const alreadyHas = circulatingVouchers.some(
                            (cv) =>
                              cv.assignedCustomerId === c.id &&
                              cv.code.startsWith(`${sendModalVoucher.code.slice(0, 26)}-`) &&
                              cv.usedCount < cv.quota &&
                              cv.isActive,
                          );
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleSendModalCustomer(c.id)}
                              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                                checked
                                  ? 'border-[#8E2E49] bg-[#FDF2F5] ring-1 ring-[#8E2E49]'
                                  : 'border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#FBF6EE]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-bold text-[#2C1810]">{c.name}</p>
                                  {alreadyHas && (
                                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                      Sudah Punya
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono-tabular truncate text-[10px] text-[#6E5849]">
                                  {c.id} · {c.phone} · {c.tier}
                                </p>
                              </div>
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  checked
                                    ? 'border-[#8E2E49] bg-[#8E2E49] text-white'
                                    : 'border-[#D7C5B4] bg-[#FBF6EE]'
                                }`}
                              >
                                {checked && <Check className="h-3.5 w-3.5" />}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#E6D8C5] pt-4">
                  <button
                    type="button"
                    onClick={() => setSendModalVoucher(null)}
                    disabled={busy}
                    className="rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={busy || sendModalSelectedIds.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#8E2E49] px-5 py-2 text-xs font-semibold text-white hover:bg-[#77243C] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {busy
                        ? 'Mengirim...'
                        : `Kirim ke ${sendModalSelectedIds.length} Pelanggan`}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="Hapus Voucher?"
          message={`Anda yakin ingin menghapus voucher "${deleteTarget?.code}" (${deleteTarget?.name}) secara permanen dari Firestore?`}
          confirmLabel="Ya, Hapus Voucher"
          isLoading={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>
    );
  }

  if (section === 'campaigns') {
    const handleAddCampaign = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cTitle.trim()) return;
      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        const cmp: PromoCampaign = {
          id: `cmp_${Date.now()}`,
          title: cTitle.trim(),
          subtitle: cSubtitle.trim() || 'Promo spesial DoraCake Customer Club.',
          badgeText: cBadge.trim() || 'Kampanye Aktif',
          promoCode: cPromoCode.trim().toUpperCase() || undefined,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
          isActive: true,
          targetAudience: 'Semua Pelanggan',
        };
        await saveCampaignFirebase(actorName, cmp, true);
        setCTitle('');
        setCSubtitle('');
        setCPromoCode('');
        setFeedback(`Kampanye "${cmp.title}" diterbitkan ke halaman toko.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal menerbitkan kampanye.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Kampanye Promosi DoraCake
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Banner kampanye aktif akan tampil di beranda toko dan dashboard pelanggan.
          </p>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleAddCampaign}
          className="space-y-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 text-xs"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-[#2C1810]">
            <Megaphone className="h-4 w-4 text-[#8E2E49]" />
            <span>Buat Kampanye Promosi Baru</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#3B2316]">Judul Kampanye *</label>
              <input
                type="text"
                required
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                placeholder="Contoh: Promo Payday Cakeers 15%"
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Kode Promo (Opsional)</label>
              <input
                type="text"
                value={cPromoCode}
                onChange={(e) => setCPromoCode(e.target.value.toUpperCase())}
                placeholder="PROMO10"
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#3B2316]">Deskripsi Singkat</label>
              <input
                type="text"
                value={cSubtitle}
                onChange={(e) => setCSubtitle(e.target.value)}
                placeholder="Jelaskan ketentuan atau periode promo..."
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Label Kampanye</label>
              <input
                type="text"
                value={cBadge}
                onChange={(e) => setCBadge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#8E2E49] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#77243C] disabled:opacity-60"
          >
            {busy ? 'Menerbitkan...' : 'Terbitkan Kampanye'}
          </button>
        </form>

        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-10 text-center text-xs text-[#6E5849]">
              Belum ada kampanye promosi aktif.
            </div>
          ) : (
            campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-[#8E2E49]">{c.badgeText}</span>
                    {c.promoCode && (
                      <span className="font-mono-tabular rounded bg-[#FDF2F5] px-2 py-0.5 font-bold text-[#8E2E49]">
                        {c.promoCode}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-1 text-sm font-bold text-[#2C1810]">{c.title}</h4>
                  <p className="mt-0.5 text-[#5C4435]">{c.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCampaignFirebase(c)}
                    className={`rounded-lg border px-3 py-1.5 font-semibold ${
                      c.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#6E5849]'
                    }`}
                  >
                    {c.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCampaignFirebase(c)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                    aria-label="Hapus kampanye"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // section === 'reports'
  const handleExportCustomersCsv = () => {
    const header = ['ID', 'Nama', 'Username', 'No_HP', 'Tier', 'Status', 'Poin', 'Stempel', 'Total_Belanja'];
    const rows = customers.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.username,
      c.phone,
      c.tier,
      c.status,
      c.points,
      c.stamps,
      c.totalSpent,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doracake-club-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxRev = Math.max(1, ...reportStats.topProducts.map((t) => t.rev));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Laporan Penjualan &amp; Loyalitas
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Ringkasan performa produk, sirkulasi DoraCake Points, dan ekspor data pelanggan.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCustomersCsv}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
        >
          <Download className="h-4 w-4 text-[#E7CFA2]" />
          <span>Ekspor CSV Pelanggan</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-[11px] font-bold uppercase text-[#6E5849]">Penjualan Selesai</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#2C1810]">
            {formatRupiah(reportStats.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-[#6E5849]">{reportStats.completedCount} transaksi tuntas</p>
        </div>
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-[11px] font-bold uppercase text-[#6E5849]">Poin Diterbitkan</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-emerald-700">
            +{reportStats.pointsIn.toLocaleString('id-ID')}
          </p>
          <p className="mt-1 text-xs text-[#6E5849]">Total poin masuk member</p>
        </div>
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-[11px] font-bold uppercase text-[#6E5849]">Poin Ditukar</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#8E2E49]">
            {reportStats.pointsOut.toLocaleString('id-ID')}
          </p>
          <p className="mt-1 text-xs text-[#6E5849]">Ditukar menjadi hadiah</p>
        </div>
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <p className="text-[11px] font-bold uppercase text-[#6E5849]">Produk Terdaftar</p>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#2C1810]">
            {allProducts.length}
          </p>
          <p className="mt-1 text-xs text-[#6E5849]">Siap dibagikan &amp; dipesan</p>
        </div>
      </div>

      {/* Simple Bar Chart: Top Products */}
      <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6">
        <div className="flex items-center gap-2 font-bold text-[#2C1810]">
          <BarChart3 className="h-4 w-4 text-[#8E2E49]" />
          <h3 className="font-serif-display text-lg">Produk Terlaris Berdasarkan Omzet</h3>
        </div>
        <div className="mt-4 space-y-3">
          {reportStats.topProducts.length === 0 ? (
            <p className="text-xs text-[#6E5849]">Belum ada data penjualan produk.</p>
          ) : (
            reportStats.topProducts.map((tp) => {
              const pct = Math.max(8, Math.round((tp.rev / maxRev) * 100));
              return (
                <div key={tp.name} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-[#2C1810]">
                    <span>
                      {tp.name} ({tp.qty} terjual)
                    </span>
                    <span className="font-mono-tabular">{formatRupiah(tp.rev)}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#FBF6EE]">
                    <div
                      className="h-full rounded-full bg-[#8E2E49]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
