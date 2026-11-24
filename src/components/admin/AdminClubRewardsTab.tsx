import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Plus,
  QrCode,
  Share2,
  Stamp,
  Users,
} from 'lucide-react';
import {
  AdminUserPublic,
  ClubConfig,
  CustomerAccount,
  PointHistoryItem,
  PointRewardItem,
  Product,
  ProductShareRecord,
  ReferralRecord,
  StampHistoryItem,
  StampRewardItem,
} from '../../types';
import {
  saveClubConfigFirebase,
  savePointRewardFirebase,
  saveStampRewardFirebase,
  togglePointRewardFirebase,
  toggleStampRewardFirebase,
  upsertProductFirebase,
} from '../../services/firebaseService';
import { formatDateTimeId, formatRupiah } from '../../utils/format';

interface AdminClubRewardsTabProps {
  section: 'points' | 'stamps' | 'referral' | 'product_codes';
  currentAdmin: AdminUserPublic;
  customers: CustomerAccount[];
  pointRewards: PointRewardItem[];
  stampRewards: StampRewardItem[];
  pointHistory: PointHistoryItem[];
  stampHistory: StampHistoryItem[];
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
  clubConfig: ClubConfig;
  allProducts: Product[];
}

export const AdminClubRewardsTab: React.FC<AdminClubRewardsTabProps> = ({
  section,
  currentAdmin,
  customers,
  pointRewards,
  stampRewards,
  pointHistory,
  stampHistory,
  referrals,
  referralClicks,
  productShares,
  productShareClicks,
  clubConfig,
  allProducts,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Config inputs
  const [rupiahPerPoint, setRupiahPerPoint] = useState(String(clubConfig.rupiahPerPoint));
  const [stampMinSubtotal, setStampMinSubtotal] = useState(String(clubConfig.stampMinSubtotal));
  const [stampTarget, setStampTarget] = useState(String(clubConfig.stampTarget));
  const [refPoints, setRefPoints] = useState(String(clubConfig.referralReferrerPoints));
  const [refVoucherVal, setRefVoucherVal] = useState(
    String(clubConfig.referralNewCustomerVoucherValue),
  );

  useEffect(() => {
    setRupiahPerPoint(String(clubConfig.rupiahPerPoint));
    setStampMinSubtotal(String(clubConfig.stampMinSubtotal));
    setStampTarget(String(clubConfig.stampTarget));
    setRefPoints(String(clubConfig.referralReferrerPoints));
    setRefVoucherVal(String(clubConfig.referralNewCustomerVoucherValue));
  }, [clubConfig]);

  // New Point Reward form
  const [newPointTitle, setNewPointTitle] = useState('');
  const [newPointCost, setNewPointCost] = useState('100');
  const [newPointDiscount, setNewPointDiscount] = useState('1000');

  // New Stamp Reward form
  const [newStampTitle, setNewStampTitle] = useState('');
  const [newStampDiscount, setNewStampDiscount] = useState('15000');

  const saveConfig = async (msg: string) => {
    setBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await saveClubConfigFirebase(currentAdmin.name, {
        rupiahPerPoint: Math.max(100, Number(rupiahPerPoint) || 1000),
        stampMinSubtotal: Math.max(1000, Number(stampMinSubtotal) || 15000),
        stampTarget: Math.max(3, Number(stampTarget) || 10),
        referralReferrerPoints: Math.max(0, Number(refPoints) || 100),
        referralNewCustomerVoucherValue: Math.max(0, Number(refVoucherVal) || 3000),
      });
      setFeedback(msg);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setBusy(false);
    }
  };

  // Merge live public clicks with share records
  const mergedProductShareRows = useMemo(() => {
    const clickMap = new Map<string, number>();
    for (const c of productShareClicks) {
      const k = `${c.productId || c.productCode}_${c.referralCode}`;
      clickMap.set(k, (clickMap.get(k) || 0) + c.clicks);
    }
    const rows = productShares.map((ps) => {
      const k = `${ps.productId || ps.productCode}_${ps.referralCode}`;
      const pubClicks = clickMap.get(k) || 0;
      clickMap.delete(k);
      return {
        ...ps,
        clicks: Math.max(ps.clicks, pubClicks),
      };
    });
    // Include pure anonymous click records not yet in productShares
    for (const c of productShareClicks) {
      const k = `${c.productId || c.productCode}_${c.referralCode}`;
      if (clickMap.has(k)) {
        rows.push({
          id: `click_${c.id}`,
          productId: c.productId,
          productCode: c.productCode,
          productName: c.productName,
          senderCustomerId: 'PENGUNJUNG',
          senderName: `Kode ${c.referralCode}`,
          referralCode: c.referralCode,
          clicks: c.clicks,
          purchases: 0,
          totalSales: 0,
          lastSharedAt: new Date().toISOString(),
        });
        clickMap.delete(k);
      }
    }
    return rows;
  }, [productShares, productShareClicks]);

  if (section === 'points') {
    const handleAddPointReward = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPointTitle.trim()) return;
      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        const item: PointRewardItem = {
          id: `pr_${Date.now()}`,
          title: newPointTitle.trim(),
          description: `Hadiah penukaran ${newPointCost} DoraCake Points.`,
          pointsCost: Math.max(10, Number(newPointCost) || 100),
          rewardType: 'discount_fixed',
          discountValue: Math.max(500, Number(newPointDiscount) || 1000),
          voucherName: `Tukar Poin: ${newPointTitle.trim()}`,
          isActive: true,
        };
        await savePointRewardFirebase(currentAdmin.name, item, true);
        setNewPointTitle('');
        setFeedback(`Hadiah poin "${item.title}" disimpan ke Cloud Firestore.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal menambah hadiah poin.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">DoraCake Points</h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Atur rasio perolehan poin (ongkir tidak dihitung), katalog hadiah tukar poin, dan
            pantau riwayat mutasi poin pelanggan.
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

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
            <div className="flex items-center gap-2 font-bold text-[#2C1810]">
              <Coins className="h-4 w-4 text-[#9E7840]" />
              <span>Aturan Perhitungan Poin</span>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#3B2316]">
                  Nominal Subtotal Produk per 1 Poin (Rp)
                </label>
                <input
                  type="number"
                  min={100}
                  value={rupiahPerPoint}
                  onChange={(e) => setRupiahPerPoint(e.target.value)}
                  className="font-mono-tabular mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-[#6E5849]">
                  Default: Rp1.000 = 1 Poin. Poin masuk otomatis hanya saat pesanan Selesai &amp;
                  Lunas.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  saveConfig(`Memperbarui rasio DoraCake Points: Rp${rupiahPerPoint} = 1 poin.`)
                }
                className="rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
              >
                Simpan Aturan Poin
              </button>
            </div>
          </div>

          <form
            onSubmit={handleAddPointReward}
            className="space-y-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5"
          >
            <div className="flex items-center gap-2 font-bold text-[#2C1810]">
              <Plus className="h-4 w-4 text-[#8E2E49]" />
              <span>Tambah Hadiah Tukar Poin</span>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="block font-semibold text-[#3B2316]">Nama Hadiah</label>
                <input
                  type="text"
                  required
                  value={newPointTitle}
                  onChange={(e) => setNewPointTitle(e.target.value)}
                  placeholder="Contoh: Voucher Diskon Rp5.000"
                  className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3B2316]">Biaya Poin</label>
                <input
                  type="number"
                  min={10}
                  value={newPointCost}
                  onChange={(e) => setNewPointCost(e.target.value)}
                  className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3B2316]">Nilai Diskon (Rp)</label>
                <input
                  type="number"
                  min={500}
                  value={newPointDiscount}
                  onChange={(e) => setNewPointDiscount(e.target.value)}
                  className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[#8E2E49] px-4 py-2 text-xs font-semibold text-white hover:bg-[#77243C] disabled:opacity-60"
                >
                  Tambah Hadiah
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">Katalog Hadiah Poin</h3>
          {pointRewards.length === 0 ? (
            <p className="mt-3 text-xs text-[#6E5849]">
              Belum ada hadiah poin. Tambahkan hadiah pertama di atas.
            </p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pointRewards.map((rw) => (
                <div
                  key={rw.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs"
                >
                  <div>
                    <span className="font-mono-tabular font-bold text-[#8E2E49]">
                      {rw.pointsCost} Poin
                    </span>
                    <h4 className="mt-1 font-bold text-[#2C1810]">{rw.title}</h4>
                    <p className="mt-1 text-[#5C4435]">{rw.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePointRewardFirebase(rw)}
                    className={`mt-3 rounded-lg border px-3 py-1.5 font-semibold ${
                      rw.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#E6D8C5] bg-white text-[#6E5849]'
                    }`}
                  >
                    {rw.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Riwayat Mutasi Poin Terbaru
          </h3>
          {pointHistory.length === 0 ? (
            <p className="mt-3 text-xs text-[#6E5849]">Belum ada mutasi poin tercatat.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {pointHistory.slice(0, 15).map((ph) => {
                const cust = customers.find((c) => c.id === ph.customerId);
                return (
                  <div
                    key={ph.id}
                    className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#2C1810]">
                        {cust?.name || ph.customerId} ({ph.customerId}) — {ph.description}
                      </p>
                      <p className="text-[11px] text-[#6E5849]">{formatDateTimeId(ph.createdAt)}</p>
                    </div>
                    <span
                      className={`font-mono-tabular font-bold ${
                        ph.type === 'Masuk' ? 'text-emerald-700' : 'text-[#8E2E49]'
                      }`}
                    >
                      {ph.type === 'Masuk' ? '+' : '-'}
                      {ph.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'stamps') {
    const handleAddStampReward = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newStampTitle.trim()) return;
      setBusy(true);
      setErrorMsg(null);
      setFeedback(null);
      try {
        const targetVal = Math.max(3, Number(stampTarget) || clubConfig.stampTarget || 10);
        const item: StampRewardItem = {
          id: `sr_${Date.now()}`,
          title: newStampTitle.trim(),
          description: `Hadiah penukaran ${targetVal} stempel DoraCake.`,
          stampsRequired: targetVal,
          rewardType: 'discount_fixed',
          discountValue: Math.max(1000, Number(newStampDiscount) || 10000),
          isActive: true,
        };
        await saveStampRewardFirebase(currentAdmin.name, item, true);
        setNewStampTitle('');
        setFeedback(`Hadiah stempel "${item.title}" disimpan ke Cloud Firestore.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal menambah hadiah stempel.');
      } finally {
        setBusy(false);
      }
    };

    const handleToggleProductStampEligible = async (p: Product) => {
      await upsertProductFirebase(
        currentAdmin,
        { isStampEligible: p.isStampEligible === false, name: p.name },
        p.id,
      );
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Stamp Card Digital
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Atur minimum belanja penghasil stempel, target kartu stempel, produk eligible, dan
            pilihan hadiah {clubConfig.stampTarget} stempel.
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

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
            <div className="flex items-center gap-2 font-bold text-[#2C1810]">
              <Stamp className="h-4 w-4 text-[#8E2E49]" />
              <span>Aturan Kartu Stempel</span>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-[#3B2316]">
                  Minimum Belanja Produk (&gt; Rp)
                </label>
                <input
                  type="number"
                  min={1000}
                  value={stampMinSubtotal}
                  onChange={(e) => setStampMinSubtotal(e.target.value)}
                  className="font-mono-tabular mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3B2316]">Target Stempel Penuh</label>
                <input
                  type="number"
                  min={3}
                  value={stampTarget}
                  onChange={(e) => setStampTarget(e.target.value)}
                  className="font-mono-tabular mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                saveConfig(
                  `Memperbarui aturan Stamp Card: min > Rp${stampMinSubtotal}, target ${stampTarget} stempel.`,
                )
              }
              className="rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
            >
              Simpan Pengaturan Stempel
            </button>
          </div>

          <form
            onSubmit={handleAddStampReward}
            className="space-y-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5"
          >
            <div className="flex items-center gap-2 font-bold text-[#2C1810]">
              <Plus className="h-4 w-4 text-[#8E2E49]" />
              <span>Tambah Opsi Hadiah Stempel</span>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-[#3B2316]">Judul Hadiah</label>
                <input
                  type="text"
                  required
                  value={newStampTitle}
                  onChange={(e) => setNewStampTitle(e.target.value)}
                  placeholder="Contoh: Gratis Box Mini Cake"
                  className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#3B2316]">Nilai Diskon / Setara Rp</label>
                <input
                  type="number"
                  min={1000}
                  value={newStampDiscount}
                  onChange={(e) => setNewStampDiscount(e.target.value)}
                  className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#8E2E49] px-4 py-2 text-xs font-semibold text-white hover:bg-[#77243C] disabled:opacity-60"
            >
              Tambah Hadiah Stempel
            </button>
          </form>
        </div>

        {/* Stamp Reward Catalog */}
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Daftar Hadiah Penukaran Stempel
          </h3>
          {stampRewards.length === 0 ? (
            <p className="mt-2 text-xs text-[#6E5849]">Belum ada opsi hadiah stempel.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stampRewards.map((sr) => (
                <div
                  key={sr.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs"
                >
                  <div>
                    <span className="font-mono-tabular font-bold text-[#8E2E49]">
                      {sr.stampsRequired} Stempel
                    </span>
                    <h4 className="mt-1 font-bold text-[#2C1810]">{sr.title}</h4>
                    <p className="mt-1 text-[#5C4435]">
                      Nilai: {formatRupiah(sr.discountValue)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStampRewardFirebase(sr)}
                    className={`mt-3 rounded-lg border px-3 py-1.5 font-semibold ${
                      sr.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#E6D8C5] bg-white text-[#6E5849]'
                    }`}
                  >
                    {sr.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eligible Products Toggle */}
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Produk Penghasil Stempel
          </h3>
          <p className="mt-1 text-xs text-[#6E5849]">
            Klik produk untuk mengaktifkan atau menonaktifkan kelayakan stempel.
          </p>
          {allProducts.length === 0 ? (
            <p className="mt-3 text-xs text-[#6E5849]">Belum ada produk terdaftar.</p>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {allProducts.map((p) => {
                const eligible = p.isStampEligible !== false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleToggleProductStampEligible(p)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-xs transition-colors ${
                      eligible
                        ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                        : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#6E5849]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-[11px] opacity-80">{p.productCode || p.id}</p>
                    </div>
                    <span className="shrink-0 font-bold">
                      {eligible ? 'Dapat Stempel' : 'Nonaktif'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stamp Redemptions & History */}
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
            Log Stempel &amp; Penukaran Hadiah
          </h3>
          {stampHistory.length === 0 ? (
            <p className="mt-3 text-xs text-[#6E5849]">Belum ada aktivitas stempel.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {stampHistory.slice(0, 12).map((sh) => {
                const cust = customers.find((c) => c.id === sh.customerId);
                return (
                  <div
                    key={sh.id}
                    className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#2C1810]">
                        {cust?.name || sh.customerId} — {sh.description}
                      </p>
                      <p className="text-[11px] text-[#6E5849]">{formatDateTimeId(sh.createdAt)}</p>
                    </div>
                    <span className="font-mono-tabular font-bold text-[#8E2E49]">
                      {sh.stampsDelta > 0 ? `+${sh.stampsDelta}` : sh.stampsDelta} Stempel
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'referral') {
    const publicClicksSum = referralClicks.reduce((s, r) => s + r.clicks, 0);
    const recordClicksSum = referrals.reduce((s, r) => s + r.clicks, 0);
    const totalClicks = Math.max(publicClicksSum, recordClicksSum);
    const totalRegistered = referrals.filter((r) => Boolean(r.registeredCustomerId)).length;
    const totalSuccess = referrals.filter((r) => r.status === 'Berhasil').length;
    const totalPointsGiven = referrals.reduce((s, r) => s + r.referrerRewardPoints, 0);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Program Referral Customer Club
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Reward referral (+{clubConfig.referralReferrerPoints} poin pengajak &amp; Voucher{' '}
            {formatRupiah(clubConfig.referralNewCustomerVoucherValue)} teman) hanya diberikan
            setelah transaksi pertama yang sah berstatus Selesai &amp; Lunas.
          </p>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {feedback}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">Total Klik Link</p>
            <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#2C1810]">{totalClicks}</p>
          </div>
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">Teman Terdaftar</p>
            <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#2C1810]">
              {totalRegistered}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">Referral Berhasil</p>
            <p className="font-mono-tabular mt-2 text-2xl font-bold text-emerald-700">
              {totalSuccess}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4">
            <p className="text-[11px] font-bold uppercase text-[#6E5849]">Total Poin Dibagikan</p>
            <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#8E2E49]">
              {totalPointsGiven}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
          <div className="flex items-center gap-2 font-bold text-[#2C1810]">
            <Users className="h-4 w-4 text-[#8E2E49]" />
            <span>Aturan Reward Referral</span>
          </div>
          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-[#3B2316]">
                Poin untuk Pengajak (Referrer)
              </label>
              <input
                type="number"
                value={refPoints}
                onChange={(e) => setRefPoints(e.target.value)}
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#3B2316]">
                Voucher Diskon Teman Baru (Rp)
              </label>
              <input
                type="number"
                value={refVoucherVal}
                onChange={(e) => setRefVoucherVal(e.target.value)}
                className="font-mono-tabular mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              saveConfig(
                `Memperbarui reward referral: +${refPoints} poin pengajak & voucher Rp${refVoucherVal}.`,
              )
            }
            className="rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            Simpan Pengaturan Referral
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] font-semibold uppercase text-[#6E5849]">
                <tr>
                  <th className="px-4 py-3">Kode Referral</th>
                  <th className="px-4 py-3">Pengajak</th>
                  <th className="px-4 py-3">Teman Diajak</th>
                  <th className="px-4 py-3 text-right">Klik</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Hadiah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4D2]">
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#6E5849]">
                      Belum ada aktivitas referral tercatat.
                    </td>
                  </tr>
                ) : (
                  referrals.map((r) => {
                    const referrer = customers.find((c) => c.id === r.referrerCustomerId);
                    const liveClicks =
                      referralClicks.find((rc) => rc.code === r.referrerCode.toUpperCase())?.clicks || 0;
                    return (
                      <tr key={r.id}>
                        <td className="font-mono-tabular px-4 py-3 font-bold text-[#8E2E49]">
                          {r.referrerCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2C1810]">
                          {referrer?.name || r.referrerCustomerId}
                        </td>
                        <td className="px-4 py-3 text-[#5C4435]">
                          {r.registeredCustomerName || 'Menunggu pendaftaran'}
                        </td>
                        <td className="font-mono-tabular px-4 py-3 text-right">
                          {Math.max(r.clicks, liveClicks)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              r.status === 'Berhasil'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-[#FBF6EE] text-[#6E5849]'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="font-mono-tabular px-4 py-3 text-right font-bold text-[#2C1810]">
                          +{r.referrerRewardPoints} pts
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // section === 'product_codes'
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
          Kode Produk &amp; Statistik Bagikan Produk
        </h2>
        <p className="mt-1 text-sm text-[#5C4435]">
          Pantau kode produk (mis. CK001) serta konversi klik dan pembelian dari tautan Bagikan
          Produk (<span className="font-mono-tabular">?product=KODE&amp;ref=REF</span>).
        </p>
      </div>

      {/* Product Code Directory */}
      <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5">
        <div className="flex items-center gap-2 font-bold text-[#2C1810]">
          <QrCode className="h-4 w-4 text-[#8E2E49]" />
          <span>Daftar Kode Produk Aktif</span>
        </div>
        {allProducts.length === 0 ? (
          <p className="mt-3 text-xs text-[#6E5849]">Belum ada produk terdaftar.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-mono-tabular font-bold text-[#8E2E49]">
                    {p.productCode || 'TANPA KODE'}
                  </span>
                  <p className="truncate font-semibold text-[#2C1810]">{p.name}</p>
                </div>
                <span className="font-mono-tabular shrink-0 font-bold text-[#3B2316]">
                  {formatRupiah(p.promoPrice || p.price)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Link Analytics */}
      <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E6D8C5] px-5 py-4">
          <Share2 className="h-4 w-4 text-[#8E2E49]" />
          <h3 className="font-serif-display text-base font-bold text-[#2C1810]">
            Statistik Tautan Produk Dibagikan
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] font-semibold uppercase text-[#6E5849]">
              <tr>
                <th className="px-4 py-3">Kode &amp; Produk</th>
                <th className="px-4 py-3">Pengirim</th>
                <th className="px-4 py-3 text-right">Jumlah Klik</th>
                <th className="px-4 py-3 text-right">Pembelian Terkait</th>
                <th className="px-4 py-3 text-right">Total Penjualan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E4D2]">
              {mergedProductShareRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6E5849]">
                    Belum ada tautan produk yang dibagikan.
                  </td>
                </tr>
              ) : (
                mergedProductShareRows.map((ps) => (
                  <tr key={ps.id} className="hover:bg-[#FBF6EE]/60">
                    <td className="px-4 py-3">
                      <span className="font-mono-tabular font-bold text-[#8E2E49]">
                        {ps.productCode}
                      </span>{' '}
                      · <span className="font-semibold text-[#2C1810]">{ps.productName}</span>
                    </td>
                    <td className="px-4 py-3 text-[#5C4435]">
                      {ps.senderName} (<span className="font-mono-tabular">{ps.referralCode}</span>)
                    </td>
                    <td className="font-mono-tabular px-4 py-3 text-right font-semibold">
                      {ps.clicks}
                    </td>
                    <td className="font-mono-tabular px-4 py-3 text-right font-semibold text-emerald-700">
                      {ps.purchases}
                    </td>
                    <td className="font-mono-tabular px-4 py-3 text-right font-bold text-[#2C1810]">
                      {formatRupiah(ps.totalSales)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs text-[#5C4435]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <p>
          <strong>Anti Klik Palsu:</strong> Klik tautan saja tidak pernah menghasilkan poin atau
          komisi. Hadiah hanya dihitung dari pembelian selesai &amp; lunas yang valid.
        </p>
      </div>
    </div>
  );
};
