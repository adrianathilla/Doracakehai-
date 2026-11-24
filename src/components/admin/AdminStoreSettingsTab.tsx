import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AdminUserPublic, StoreSettings } from '../../types';
import { updateStoreSettingsFirebase } from '../../services/firebaseService';

interface AdminStoreSettingsTabProps {
  currentAdmin: AdminUserPublic;
  settings: StoreSettings;
  onUpdated?: () => Promise<void> | void;
}

export const AdminStoreSettingsTab: React.FC<AdminStoreSettingsTabProps> = ({
  currentAdmin,
  settings,
  onUpdated,
}) => {
  const [form, setForm] = useState<StoreSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    setErrorMsg(null);
    try {
      await updateStoreSettingsFirebase(currentAdmin, form);
      if (onUpdated) await onUpdated();
      setSaveMsg('Pengaturan toko berhasil disimpan dan disinkronkan ke Cloud Firestore.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan toko.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">Pengaturan Toko</h2>
        <p className="mt-1 text-sm text-[#5C4435]">
          Atur identitas operasional, kontak WhatsApp, ongkos kirim, jam pengiriman, serta kebijakan
          pembatalan dan pembayaran.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-5 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm"
      >
        {saveMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">Nama Toko</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">Nomor WhatsApp</label>
            <input
              type="text"
              value={form.whatsappNumber}
              onChange={(e) => setForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">Alamat Toko</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">Jam Operasional</label>
            <input
              type="text"
              value={form.operationalHours}
              onChange={(e) => setForm((p) => ({ ...p, operationalHours: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Minimum Gratis Ongkir (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={form.minFreeShipping}
              onChange={(e) =>
                setForm((p) => ({ ...p, minFreeShipping: Number(e.target.value) || 0 }))
              }
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Ongkir Standar di Bawah Minimum (Rp)
            </label>
            <input
              type="number"
              min={0}
              value={form.defaultShippingCost}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultShippingCost: Number(e.target.value) || 0 }))
              }
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Jam Mulai Pickup / Delivery (WIB)
            </label>
            <input
              type="time"
              value={form.pickupDeliveryStartHour}
              onChange={(e) =>
                setForm((p) => ({ ...p, pickupDeliveryStartHour: e.target.value }))
              }
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Jam Tutup Pickup / Delivery (WIB)
            </label>
            <input
              type="time"
              value={form.pickupDeliveryEndHour}
              onChange={(e) => setForm((p) => ({ ...p, pickupDeliveryEndHour: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3B2316]">Aturan Pengiriman</label>
          <textarea
            rows={2}
            value={form.shippingRules}
            onChange={(e) => setForm((p) => ({ ...p, shippingRules: e.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3B2316]">Kebijakan Pembatalan</label>
          <textarea
            rows={2}
            value={form.cancellationPolicy}
            onChange={(e) => setForm((p) => ({ ...p, cancellationPolicy: e.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3B2316]">
            Informasi Pembayaran
          </label>
          <textarea
            rows={2}
            value={form.paymentInfoText}
            onChange={(e) => setForm((p) => ({ ...p, paymentInfoText: e.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3B2316]">Informasi Kontak</label>
          <input
            type="text"
            value={form.contactInfo}
            onChange={(e) => setForm((p) => ({ ...p, contactInfo: e.target.value }))}
            className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#3B2316] px-6 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan Toko'}
          </button>
        </div>
      </form>
    </div>
  );
};
