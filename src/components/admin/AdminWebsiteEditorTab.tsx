import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  History,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AdminUserPublic,
  Category,
  ExtraInfoSection,
  HeaderNavKey,
  HeroElementKey,
  Product,
  StoreSettings,
  WebsiteContentConfig,
  WebsiteSnapshot,
} from '../../types';
import {
  discardWebsiteDraftFirebase,
  publishWebsiteFirebase,
  restoreWebsiteSnapshotFirebase,
  saveWebsiteDraftFirebase,
} from '../../services/firebaseService';
import { formatDateTimeId } from '../../utils/format';
import { ConfirmModal } from '../ConfirmModal';
import { StorefrontView } from '../StorefrontView';

interface AdminWebsiteEditorTabProps {
  currentAdmin: AdminUserPublic;
  websiteDraft: WebsiteContentConfig;
  websitePublished: WebsiteContentConfig;
  websiteHistory: WebsiteSnapshot[];
  settings: StoreSettings;
  products: Product[];
  categories: Category[];
  onUpdated?: () => Promise<void> | void;
}

type EditorSectionId =
  | 'identity'
  | 'header'
  | 'hero'
  | 'promo'
  | 'catalog'
  | 'extra'
  | 'footer'
  | 'appearance';

const SECTION_TABS: { id: EditorSectionId; label: string }[] = [
  { id: 'identity', label: '1. Identitas Toko' },
  { id: 'header', label: '2. Header Website' },
  { id: 'hero', label: '3. Hero Section' },
  { id: 'promo', label: '4. Informasi Promosi' },
  { id: 'catalog', label: '5. Katalog Produk' },
  { id: 'extra', label: '6. Informasi Tambahan' },
  { id: 'footer', label: '7. Footer' },
  { id: 'appearance', label: '8. Pengaturan Tampilan' },
];

const NAV_LABELS: Record<HeaderNavKey, string> = {
  search: 'Kolom Pencarian',
  tracking: 'Tombol Lacak Pesanan',
  cart: 'Tombol Keranjang',
  admin: 'Tombol Portal Admin',
};

const HERO_ELEM_LABELS: Record<HeroElementKey, string> = {
  title: 'Judul Utama',
  description: 'Deskripsi Brand',
  promoLabel: 'Label Promosi',
  badges: 'Badge Keunggulan (3 Kartu)',
  cta: 'Tombol Utama & Jam Operasional',
};

export const AdminWebsiteEditorTab: React.FC<AdminWebsiteEditorTabProps> = ({
  currentAdmin,
  websiteDraft,
  websitePublished,
  websiteHistory,
  settings,
  products,
  categories,
  onUpdated,
}) => {
  const [draft, setDraft] = useState<WebsiteContentConfig>(websiteDraft);
  const [activeSection, setActiveSection] = useState<EditorSectionId>('identity');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // History / Discard Modals
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<WebsiteSnapshot | null>(null);

  useEffect(() => {
    setDraft(websiteDraft);
  }, [websiteDraft]);

  const hasUnpublishedChanges =
    JSON.stringify({ ...draft, updatedAt: '' }) !==
    JSON.stringify({ ...websitePublished, updatedAt: '' });

  const handleImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    onResult: (dataUrl: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          onResult(canvas.toDataURL('image/jpeg', 0.84));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await saveWebsiteDraftFirebase(draft);
      if (onUpdated) await onUpdated();
      setStatusMsg('Draft perubahan tersimpan ke Cloud Firestore. Klik "Pratinjau Website" atau "Publikasikan Perubahan".');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan draft.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await publishWebsiteFirebase(currentAdmin, draft, settings);
      if (onUpdated) await onUpdated();
      setStatusMsg('Perubahan berhasil dipublikasikan ke website pelanggan.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memublikasikan perubahan.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    setSaving(true);
    try {
      await discardWebsiteDraftFirebase(websitePublished);
      if (onUpdated) await onUpdated();
      setDiscardConfirmOpen(false);
      setStatusMsg('Perubahan draft dibatalkan dan dikembalikan ke versi yang sedang tayang.');
    } finally {
      setSaving(false);
    }
  };

  const moveArrayItem = <T,>(arr: T[], idx: number, dir: -1 | 1): T[] => {
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return arr;
    const copy = [...arr];
    const tmp = copy[idx];
    copy[idx] = copy[swap];
    copy[swap] = tmp;
    return copy;
  };

  const addExtraSection = () => {
    const newSec: ExtraInfoSection = {
      id: `sec_${Date.now()}`,
      type: 'announcement',
      title: 'Informasi Baru DoraCake',
      content: 'Tuliskan pesan, testimoni, atau pengumuman untuk pelanggan di sini.',
      authorOrLabel: 'Info Toko',
      imageUrl: '',
      isActive: true,
      sortOrder: draft.extraSections.length + 1,
    };
    setDraft((p) => ({ ...p, extraSections: [...p.extraSections, newSec] }));
  };

  const updateExtraSection = (id: string, patch: Partial<ExtraInfoSection>) => {
    setDraft((p) => ({
      ...p,
      extraSections: p.extraSections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeExtraSection = (id: string) => {
    setDraft((p) => ({
      ...p,
      extraSections: p.extraSections.filter((s) => s.id !== id),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Title + Draft/Published Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                Editor Website
              </h2>
              <span
                className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                  hasUnpublishedChanges
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {hasUnpublishedChanges ? 'Draft Belum Dipublikasikan' : 'Sudah Dipublikasikan'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#5C4435]">
              Kelola seluruh konten dan tampilan panel pelanggan dengan sistem Draft &amp;
              Pratinjau sebelum dipublikasikan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]"
          >
            <History className="h-3.5 w-3.5" />
            <span>Riwayat Versi ({websiteHistory.length})</span>
          </button>
        </div>

        {/* 4 Required Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-[#E6D8C5] pt-4">
          <button
            type="button"
            disabled={saving || publishing}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 rounded-xl border border-[#3B2316] bg-[#FFFDF9] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#C89D54] bg-[#FBF6EE] px-4 py-2.5 text-xs font-semibold text-[#2C1810] hover:bg-[#F2E7D6]"
          >
            <Eye className="h-3.5 w-3.5 text-[#9E7840]" />
            <span>Pratinjau Website</span>
          </button>

          <button
            type="button"
            disabled={saving || publishing}
            onClick={handlePublish}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-5 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5 text-[#E7CFA2]" />
            <span>{publishing ? 'Memublikasikan...' : 'Publikasikan Perubahan'}</span>
          </button>

          <button
            type="button"
            disabled={!hasUnpublishedChanges || saving}
            onClick={() => setDiscardConfirmOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Batalkan Perubahan</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* 8-Section Selector + Form Body */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Section Tabs */}
        <div className="space-y-1.5 lg:col-span-3">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`flex w-full items-center rounded-xl px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                activeSection === tab.id
                  ? 'bg-[#3B2316] text-[#FBF6EE]'
                  : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316] hover:bg-[#FBF6EE]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Form Editor */}
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm lg:col-span-9">
          {activeSection === 'identity' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                1. Identitas Toko
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Nama Toko</label>
                  <input
                    type="text"
                    value={draft.storeName}
                    onChange={(e) => setDraft((p) => ({ ...p, storeName: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Nama Brand</label>
                  <input
                    type="text"
                    value={draft.brandName}
                    onChange={(e) => setDraft((p) => ({ ...p, brandName: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Tagline</label>
                  <input
                    type="text"
                    value={draft.tagline}
                    onChange={(e) => setDraft((p) => ({ ...p, tagline: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Font Website</label>
                  <select
                    value={draft.fontFamily}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        fontFamily: e.target.value as WebsiteContentConfig['fontFamily'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  >
                    <option value="Playfair Display">Playfair Display (Klasik Elegan)</option>
                    <option value="Cormorant Garamond">Cormorant Garamond (Editorial)</option>
                    <option value="Fraunces">Fraunces (Hangat Modern)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Logo Toko (URL atau Unggah)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={draft.logoUrl}
                    onChange={(e) => setDraft((p) => ({ ...p, logoUrl: e.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-xs font-semibold text-[#3B2316]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Unggah</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageFile(e, (url) => setDraft((p) => ({ ...p, logoUrl: url })))
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Warna Utama</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.primaryColor}
                      onChange={(e) => setDraft((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border border-[#E6D8C5]"
                    />
                    <input
                      type="text"
                      value={draft.primaryColor}
                      onChange={(e) => setDraft((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="font-mono-tabular w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Warna Sekunder
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.secondaryColor}
                      onChange={(e) => setDraft((p) => ({ ...p, secondaryColor: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border border-[#E6D8C5]"
                    />
                    <input
                      type="text"
                      value={draft.secondaryColor}
                      onChange={(e) => setDraft((p) => ({ ...p, secondaryColor: e.target.value }))}
                      className="font-mono-tabular w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Warna Aksen</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft.accentColor}
                      onChange={(e) => setDraft((p) => ({ ...p, accentColor: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border border-[#E6D8C5]"
                    />
                    <input
                      type="text"
                      value={draft.accentColor}
                      onChange={(e) => setDraft((p) => ({ ...p, accentColor: e.target.value }))}
                      className="font-mono-tabular w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'header' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                2. Header Website
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Ukuran Logo</label>
                  <select
                    value={draft.logoSize}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        logoSize: e.target.value as WebsiteContentConfig['logoSize'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value="sm">Kecil</option>
                    <option value="md">Sedang</option>
                    <option value="lg">Besar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Warna Header</label>
                  <input
                    type="color"
                    value={draft.headerBgColor}
                    onChange={(e) => setDraft((p) => ({ ...p, headerBgColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Warna Teks Header
                  </label>
                  <input
                    type="color"
                    value={draft.headerTextColor}
                    onChange={(e) => setDraft((p) => ({ ...p, headerTextColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#3B2316]">
                    <input
                      type="checkbox"
                      checked={draft.showSearch}
                      onChange={(e) => setDraft((p) => ({ ...p, showSearch: e.target.checked }))}
                    />
                    <span>Tampilkan Kolom Pencarian</span>
                  </label>
                  <input
                    type="text"
                    value={draft.searchPlaceholder}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, searchPlaceholder: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#3B2316]">
                    <input
                      type="checkbox"
                      checked={draft.showTracking}
                      onChange={(e) => setDraft((p) => ({ ...p, showTracking: e.target.checked }))}
                    />
                    <span>Tampilkan Tombol Tracking</span>
                  </label>
                  <input
                    type="text"
                    value={draft.trackingLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, trackingLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#3B2316]">
                    <input
                      type="checkbox"
                      checked={draft.showCart}
                      onChange={(e) => setDraft((p) => ({ ...p, showCart: e.target.checked }))}
                    />
                    <span>Tampilkan Tombol Keranjang</span>
                  </label>
                  <input
                    type="text"
                    value={draft.cartLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, cartLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#3B2316]">
                    <input
                      type="checkbox"
                      checked={draft.showAdminButton}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, showAdminButton: e.target.checked }))
                      }
                    />
                    <span>Tampilkan Tombol Portal Admin</span>
                  </label>
                  <input
                    type="text"
                    value={draft.adminButtonLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, adminButtonLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
                <p className="text-xs font-bold text-[#3B2316]">Urutan Tombol Navigasi Header</p>
                <div className="mt-2.5 space-y-2">
                  {draft.navOrder.map((key, idx) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[#2C1810]">{NAV_LABELS[key]}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              navOrder: moveArrayItem(p.navOrder, idx, -1),
                            }))
                          }
                          className="rounded border border-[#E6D8C5] p-1 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.navOrder.length - 1}
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              navOrder: moveArrayItem(p.navOrder, idx, 1),
                            }))
                          }
                          className="rounded border border-[#E6D8C5] p-1 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'hero' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                3. Hero Section
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Judul Utama</label>
                  <input
                    type="text"
                    value={draft.heroTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, heroTitle: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Label Promosi
                  </label>
                  <input
                    type="text"
                    value={draft.heroPromoLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, heroPromoLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">Deskripsi</label>
                <textarea
                  rows={5}
                  value={draft.heroDescription}
                  onChange={(e) => setDraft((p) => ({ ...p, heroDescription: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Teks Tombol Utama
                  </label>
                  <input
                    type="text"
                    value={draft.heroCtaText}
                    onChange={(e) => setDraft((p) => ({ ...p, heroCtaText: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Warna Background Hero
                  </label>
                  <input
                    type="color"
                    value={draft.heroBgColor}
                    onChange={(e) => setDraft((p) => ({ ...p, heroBgColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Foto / Banner Kartu Hero
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="text"
                      value={draft.heroImageUrl}
                      onChange={(e) => setDraft((p) => ({ ...p, heroImageUrl: e.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-xs font-semibold">
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFile(e, (url) =>
                            setDraft((p) => ({ ...p, heroImageUrl: url })),
                          )
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Gambar Background Hero (Opsional)
                  </label>
                  <input
                    type="text"
                    value={draft.heroBgImageUrl}
                    onChange={(e) => setDraft((p) => ({ ...p, heroBgImageUrl: e.target.value }))}
                    placeholder="Kosongkan untuk warna solid"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Judul Kartu Informasi Pelanggan
                  </label>
                  <input
                    type="text"
                    value={draft.heroCardTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, heroCardTitle: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Teks Tombol Kartu Pelanggan
                  </label>
                  <input
                    type="text"
                    value={draft.heroCardCtaText}
                    onChange={(e) => setDraft((p) => ({ ...p, heroCardCtaText: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Visibility Toggles & Order */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs">
                  <p className="font-bold text-[#3B2316]">Aktif / Nonaktif Elemen Hero</p>
                  {[
                    { key: 'showDescription', label: 'Tampilkan Deskripsi' },
                    { key: 'showPromoLabel', label: 'Tampilkan Label Promosi' },
                    { key: 'showBadges', label: 'Tampilkan 3 Badge Keunggulan' },
                    { key: 'showCta', label: 'Tampilkan Tombol Utama' },
                    { key: 'showBannerCard', label: 'Tampilkan Kartu Banner Kanan' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-[#2C1810]">
                      <input
                        type="checkbox"
                        checked={
                          draft.heroElements[item.key as keyof typeof draft.heroElements]
                        }
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            heroElements: {
                              ...p.heroElements,
                              [item.key]: e.target.checked,
                            },
                          }))
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs">
                  <p className="font-bold text-[#3B2316]">Urutan Elemen Hero</p>
                  {draft.heroElementOrder.map((key, idx) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5"
                    >
                      <span>{HERO_ELEM_LABELS[key]}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              heroElementOrder: moveArrayItem(p.heroElementOrder, idx, -1),
                            }))
                          }
                          className="rounded border border-[#E6D8C5] p-1 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.heroElementOrder.length - 1}
                          onClick={() =>
                            setDraft((p) => ({
                              ...p,
                              heroElementOrder: moveArrayItem(p.heroElementOrder, idx, 1),
                            }))
                          }
                          className="rounded border border-[#E6D8C5] p-1 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'promo' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                4. Informasi Promosi
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Badge Gratis Ongkir
                  </label>
                  <input
                    type="text"
                    value={draft.freeShippingBadgeText}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, freeShippingBadgeText: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Informasi Pemesanan
                  </label>
                  <input
                    type="text"
                    value={draft.orderSpeedBadgeText}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, orderSpeedBadgeText: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Garansi Produk
                  </label>
                  <input
                    type="text"
                    value={draft.qualityBadgeText}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, qualityBadgeText: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#3B2316]">
                  <input
                    type="checkbox"
                    checked={draft.promoBannerEnabled}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, promoBannerEnabled: e.target.checked }))
                    }
                  />
                  <span>Tampilkan Strip Banner Promosi di Atas Hero</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Teks Banner Promosi
                    </label>
                    <input
                      type="text"
                      value={draft.promoBannerText}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, promoBannerText: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B2316]">
                      Periode Promosi
                    </label>
                    <input
                      type="text"
                      value={draft.promoPeriodText}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, promoPeriodText: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'catalog' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                5. Katalog Produk
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Label Atas Katalog
                  </label>
                  <input
                    type="text"
                    value={draft.catalogKicker}
                    onChange={(e) => setDraft((p) => ({ ...p, catalogKicker: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Judul Katalog
                  </label>
                  <input
                    type="text"
                    value={draft.catalogTitle}
                    onChange={(e) => setDraft((p) => ({ ...p, catalogTitle: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Deskripsi Katalog
                </label>
                <input
                  type="text"
                  value={draft.catalogDescription}
                  onChange={(e) => setDraft((p) => ({ ...p, catalogDescription: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nama Tab Semua Menu
                  </label>
                  <input
                    type="text"
                    value={draft.tabAllLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, tabAllLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nama Tab Menu Favorit
                  </label>
                  <input
                    type="text"
                    value={draft.tabFavoriteLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, tabFavoriteLabel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Kolom Kartu Desktop
                  </label>
                  <select
                    value={draft.cardColumns}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        cardColumns: Number(e.target.value) as 2 | 3 | 4,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value={2}>2 Kolom</option>
                    <option value={3}>3 Kolom (Standar)</option>
                    <option value={4}>4 Kolom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Urutan Default Produk
                  </label>
                  <select
                    value={draft.defaultSort}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        defaultSort: e.target.value as WebsiteContentConfig['defaultSort'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value="recommended">Rekomendasi</option>
                    <option value="newest">Terbaru</option>
                    <option value="bestseller">Terlaris</option>
                    <option value="price_asc">Harga Terendah</option>
                    <option value="price_desc">Harga Tertinggi</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs">
                {[
                  { key: 'showFavoriteTab', label: 'Tampilkan Tab Menu Favorit' },
                  { key: 'showProductCategory', label: 'Tampilkan Kategori di Kartu' },
                  { key: 'showProductDescription', label: 'Tampilkan Deskripsi Singkat' },
                  { key: 'showProductAvailability', label: 'Tampilkan Status Tersedia/Habis' },
                  { key: 'showPromoStrikePrice', label: 'Tampilkan Harga Coret Promo' },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-[#2C1810]">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[opt.key as keyof WebsiteContentConfig])}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [opt.key]: e.target.checked }))
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'extra' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                  6. Bagian Informasi Tambahan
                </h3>
                <button
                  type="button"
                  onClick={addExtraSection}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B2316] px-3.5 py-2 text-xs font-semibold text-[#FBF6EE]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Bagian</span>
                </button>
              </div>

              {draft.extraSections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E6D8C5] bg-[#FBF6EE] p-8 text-center text-xs text-[#6E5849]">
                  Belum ada bagian informasi tambahan. Klik &ldquo;Tambah Bagian&rdquo; untuk
                  menambahkan testimoni, pengumuman, info toko, atau banner promosi.
                </div>
              ) : (
                <div className="space-y-3">
                  {draft.extraSections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="space-y-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <select
                          value={sec.type}
                          onChange={(e) =>
                            updateExtraSection(sec.id, {
                              type: e.target.value as ExtraInfoSection['type'],
                            })
                          }
                          className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold"
                        >
                          <option value="banner">Banner Informasi</option>
                          <option value="testimonial">Testimoni</option>
                          <option value="store_info">Informasi Toko</option>
                          <option value="announcement">Pengumuman</option>
                          <option value="promo_image">Gambar Promosi</option>
                          <option value="text">Teks Informasi</option>
                        </select>

                        <div className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={sec.isActive}
                              onChange={(e) =>
                                updateExtraSection(sec.id, { isActive: e.target.checked })
                              }
                            />
                            <span>Tampil</span>
                          </label>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                extraSections: moveArrayItem(p.extraSections, idx, -1).map(
                                  (item, i) => ({ ...item, sortOrder: i + 1 }),
                                ),
                              }))
                            }
                            className="rounded border border-[#E6D8C5] bg-[#FFFDF9] p-1 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === draft.extraSections.length - 1}
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                extraSections: moveArrayItem(p.extraSections, idx, 1).map(
                                  (item, i) => ({ ...item, sortOrder: i + 1 }),
                                ),
                              }))
                            }
                            className="rounded border border-[#E6D8C5] bg-[#FFFDF9] p-1 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExtraSection(sec.id)}
                            className="rounded border border-rose-200 bg-rose-50 p-1 text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => updateExtraSection(sec.id, { title: e.target.value })}
                          placeholder="Judul bagian"
                          className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={sec.authorOrLabel}
                          onChange={(e) =>
                            updateExtraSection(sec.id, { authorOrLabel: e.target.value })
                          }
                          placeholder="Label / Nama Pelanggan"
                          className="rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={sec.content}
                        onChange={(e) => updateExtraSection(sec.id, { content: e.target.value })}
                        placeholder="Isi teks / testimoni / pengumuman"
                        className="w-full rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={sec.imageUrl}
                        onChange={(e) => updateExtraSection(sec.id, { imageUrl: e.target.value })}
                        placeholder="URL gambar (opsional untuk banner/promo)"
                        className="w-full rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-3 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'footer' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">7. Footer</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Nama Toko</label>
                  <input
                    type="text"
                    value={draft.footerStoreName}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, footerStoreName: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Alamat</label>
                  <input
                    type="text"
                    value={draft.footerAddress}
                    onChange={(e) => setDraft((p) => ({ ...p, footerAddress: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Jam Operasional
                  </label>
                  <input
                    type="text"
                    value={draft.footerHours}
                    onChange={(e) => setDraft((p) => ({ ...p, footerHours: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="text"
                    value={draft.footerWhatsapp}
                    onChange={(e) => setDraft((p) => ({ ...p, footerWhatsapp: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Judul Layanan Pelanggan
                  </label>
                  <input
                    type="text"
                    value={draft.footerServiceTitle}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, footerServiceTitle: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Copyright</label>
                  <input
                    type="text"
                    value={draft.footerCopyright}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, footerCopyright: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Informasi Pembayaran
                </label>
                <textarea
                  rows={2}
                  value={draft.footerPaymentText}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, footerPaymentText: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    URL Instagram
                  </label>
                  <input
                    type="url"
                    value={draft.socialLinks.instagram}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        socialLinks: { ...p.socialLinks, instagram: e.target.value },
                      }))
                    }
                    placeholder="https://instagram.com/..."
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">URL TikTok</label>
                  <input
                    type="url"
                    value={draft.socialLinks.tiktok}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        socialLinks: { ...p.socialLinks, tiktok: e.target.value },
                      }))
                    }
                    placeholder="https://tiktok.com/@..."
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">URL Facebook</label>
                  <input
                    type="url"
                    value={draft.socialLinks.facebook}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        socialLinks: { ...p.socialLinks, facebook: e.target.value },
                      }))
                    }
                    placeholder="https://facebook.com/..."
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="space-y-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                8. Pengaturan Tampilan
              </h3>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Background Halaman
                  </label>
                  <input
                    type="color"
                    value={draft.pageBgColor}
                    onChange={(e) => setDraft((p) => ({ ...p, pageBgColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Warna Tombol</label>
                  <input
                    type="color"
                    value={draft.buttonBgColor}
                    onChange={(e) => setDraft((p) => ({ ...p, buttonBgColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Teks Tombol
                  </label>
                  <input
                    type="color"
                    value={draft.buttonTextColor}
                    onChange={(e) => setDraft((p) => ({ ...p, buttonTextColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Warna Teks</label>
                  <input
                    type="color"
                    value={draft.textColor}
                    onChange={(e) => setDraft((p) => ({ ...p, textColor: e.target.value }))}
                    className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-[#E6D8C5]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Bentuk Sudut Kartu
                  </label>
                  <select
                    value={draft.cardRadius}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        cardRadius: e.target.value as WebsiteContentConfig['cardRadius'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value="md">Halus (Sedang)</option>
                    <option value="lg">Membulat (Besar)</option>
                    <option value="xl">Ekstra Membulat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Ukuran Font</label>
                  <select
                    value={draft.fontSizeScale}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        fontSizeScale: e.target.value as WebsiteContentConfig['fontSizeScale'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value="sm">Ringkas (14px)</option>
                    <option value="md">Standar (15px)</option>
                    <option value="lg">Besar (17px)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Jarak Antarbagian
                  </label>
                  <select
                    value={draft.sectionSpacing}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        sectionSpacing: e.target.value as WebsiteContentConfig['sectionSpacing'],
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
                  >
                    <option value="compact">Padat</option>
                    <option value="normal">Normal</option>
                    <option value="relaxed">Lega</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Preview Modal (Desktop & Mobile Viewports) */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#2C1810]/85 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FBF6EE]/15 bg-[#2C1810] px-6 py-3 text-[#FBF6EE]">
            <div className="flex items-center gap-3">
              <span className="font-serif-display text-base font-bold">
                Pratinjau Draft Website
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-[#FBF6EE]/15 bg-[#3B2316] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium ${
                    previewDevice === 'desktop'
                      ? 'bg-[#C89D54] text-[#2C1810]'
                      : 'text-[#F2E7D6]'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>Tampilan Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium ${
                    previewDevice === 'mobile'
                      ? 'bg-[#C89D54] text-[#2C1810]'
                      : 'text-[#F2E7D6]'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Tampilan Mobile</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handlePublish();
                  setPreviewOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C89D54] px-4 py-2 text-xs font-bold text-[#2C1810]"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Publikasikan Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl border border-[#FBF6EE]/20 p-2 text-[#FBF6EE] hover:bg-[#3B2316]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div
              className={`mx-auto overflow-hidden rounded-2xl border border-[#E6D8C5] shadow-2xl transition-all ${
                previewDevice === 'mobile' ? 'max-w-[390px]' : 'max-w-7xl'
              }`}
            >
              <StorefrontView
                website={draft}
                settings={settings}
                products={products.filter((p) => p.isActive)}
                categories={categories.filter((c) => c.isActive)}
                searchQuery=""
                onSearchChange={() => {}}
                activeTab="all"
                onTabChange={() => {}}
                sortBy={draft.defaultSort}
                onSortChange={() => {}}
                onResetFilters={() => {}}
                onSelectProduct={() => {}}
                cartCount={0}
                onOpenTracking={() => {}}
                onOpenCart={() => {}}
                onOpenAdmin={() => {}}
                isLoading={false}
                isPreview={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Recovery Modal */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                Riwayat Versi Publikasi
              </h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg p-1.5 text-[#6E5849] hover:bg-[#F6EFE4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {websiteHistory.length === 0 ? (
                <p className="text-center text-sm text-[#6E5849]">
                  Belum ada riwayat versi sebelumnya. Riwayat tercipta otomatis setiap kali Anda
                  memublikasikan perubahan.
                </p>
              ) : (
                <div className="space-y-3">
                  {websiteHistory.map((snap) => (
                    <div
                      key={snap.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#2C1810]">{snap.note}</p>
                        <p className="mt-0.5 text-[#6E5849]">
                          {formatDateTimeId(snap.savedAt)} · Oleh {snap.savedBy}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(snap)}
                        className="rounded-lg bg-[#3B2316] px-3 py-1.5 font-semibold text-[#FBF6EE]"
                      >
                        Pulihkan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={discardConfirmOpen}
        title="Batalkan Perubahan Draft?"
        message="Semua editan draft yang belum dipublikasikan akan dikembalikan ke tampilan website yang sedang tayang."
        confirmLabel="Ya, Batalkan Draft"
        onCancel={() => setDiscardConfirmOpen(false)}
        onConfirm={handleDiscard}
      />

      <ConfirmModal
        isOpen={Boolean(restoreTarget)}
        title="Pulihkan Versi Ini?"
        message={`Website pelanggan dan draft akan dikembalikan ke versi tanggal ${formatDateTimeId(restoreTarget?.savedAt || '')}.`}
        confirmLabel="Ya, Pulihkan"
        variant="primary"
        onCancel={() => setRestoreTarget(null)}
        onConfirm={async () => {
          if (!restoreTarget) return;
          await restoreWebsiteSnapshotFirebase(currentAdmin, restoreTarget);
          if (onUpdated) await onUpdated();
          setRestoreTarget(null);
          setHistoryOpen(false);
          setStatusMsg('Versi website berhasil dipulihkan.');
        }}
      />
    </div>
  );
};
