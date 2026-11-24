import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Megaphone,
  Plus,
  TicketPercent,
  Trash2,
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
  saveCampaignFirebase,
  saveVoucherFirebase,
  toggleCampaignFirebase,
  toggleVoucherFirebase,
} from '../../services/firebaseService';
import { formatRupiah } from '../../utils/format';

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

  // Voucher Form State
  const [vName, setVName] = useState('');
  const [vCode, setVCode] = useState('');
  const [vType, setVType] = useState<VoucherType>('Voucher Kampanye Promosi');
  const [vDiscountType, setVDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [vValue, setVValue] = useState('5000');
  const [vMinPurchase, setVMinPurchase] = useState('25000');
  const [vProductCodes, setVProductCodes] = useState('');
  const [vQuota, setVQuota] = useState('50');
  const [vValidUntil, setVValidUntil] = useState(
    new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  );

  // Campaign Form State
  const [cTitle, setCTitle] = useState('');
  const [cSubtitle, setCSubtitle] = useState('');
  const [cPromoCode, setCPromoCode] = useState('');
  const [cBadge, setCBadge] = useState('Kampanye Aktif');

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
    const handleCreateVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      const code = vCode.trim().toUpperCase().replace(/\s+/g, '');
      if (!vName.trim() || !code) return;
      if (vouchers.some((v) => v.code.toUpperCase() === code)) {
        setErrorMsg(`Kode voucher "${code}" sudah digunakan.`);
        return;
      }

      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        await saveVoucherFirebase(
          actorName,
          {
            name: vName.trim(),
            code,
            type: vType,
            discountType: vDiscountType,
            discountValue: Math.max(1, Number(vValue) || 1000),
            minPurchase: Math.max(0, Number(vMinPurchase) || 0),
            applicableProductCodes: vProductCodes
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
            quota: Math.max(1, Number(vQuota) || 1),
            perUserLimit: 1,
            validUntil: vValidUntil,
            isActive: true,
          },
          customers,
        );
        setVName('');
        setVCode('');
        setVProductCodes('');
        setFeedback(`Voucher ${code} berhasil disimpan ke Cloud Firestore.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat voucher.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Kelola Voucher (7 Jenis Promo)
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Buat dan kelola voucher Pelanggan Baru, Referral, Ulang Tahun, Pembelian Kedua,
            Pelanggan Loyal, Produk Tertentu, dan Kampanye Promosi.
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
          onSubmit={handleCreateVoucher}
          className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5"
        >
          <div className="flex items-center gap-2 font-bold text-[#2C1810]">
            <Plus className="h-4 w-4 text-[#8E2E49]" />
            <span>Buat Voucher Baru</span>
          </div>

          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block font-semibold text-[#3B2316]">Nama Voucher *</label>
              <input
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Contoh: Promo Akhir Pekan"
                className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">Kode Voucher *</label>
              <input
                type="text"
                required
                value={vCode}
                onChange={(e) => setVCode(e.target.value.toUpperCase())}
                placeholder="WEEKEND5K"
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
              <label className="block font-semibold text-[#3B2316]">Tipe &amp; Nilai Diskon</label>
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
            <div>
              <label className="block font-semibold text-[#3B2316]">Kuota</label>
              <input
                type="number"
                min={1}
                value={vQuota}
                onChange={(e) => setVQuota(e.target.value)}
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
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

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#3B2316] px-5 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            {busy ? 'Menyimpan...' : 'Simpan Voucher Baru'}
          </button>
        </form>

        {/* Voucher List */}
        {vouchers.length === 0 ? (
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-10 text-center text-xs text-[#6E5849]">
            Belum ada voucher yang dibuat. Tambahkan voucher promo pertama Anda di atas.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 text-xs shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#8E2E49]">
                      <TicketPercent className="h-3.5 w-3.5" />
                      {v.type}
                    </span>
                    <span className="font-mono-tabular rounded bg-[#FBF6EE] px-2 py-0.5 font-bold text-[#2C1810]">
                      {v.code}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-sm font-bold text-[#2C1810]">{v.name}</h4>
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
                    Terpakai: {v.usedCount}/{v.quota} · Berlaku s/d {v.validUntil}
                    {v.applicableProductCodes.length > 0 &&
                      ` · Produk: ${v.applicableProductCodes.join(', ')}`}
                  </p>
                </div>
                <div className="mt-3 flex justify-end border-t border-[#F0E4D2] pt-2.5">
                  <button
                    type="button"
                    onClick={() => toggleVoucherFirebase(v)}
                    className={`rounded-lg border px-3 py-1 font-semibold ${
                      v.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#6E5849]'
                    }`}
                  >
                    {v.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
