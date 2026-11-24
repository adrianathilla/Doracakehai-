import React, { useState } from 'react';
import { Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { AdminUserPublic, Category, Product, VariantOption } from '../../types';
import { deleteProductFirebase, upsertProductFirebase } from '../../services/firebaseService';
import { formatRupiah } from '../../utils/format';
import { ConfirmModal } from '../ConfirmModal';
import { ResilientImage } from '../ResilientImage';

interface AdminProductsTabProps {
  currentAdmin: AdminUserPublic;
  products: Product[];
  categories: Category[];
  openCreateImmediately?: boolean;
  onProductsUpdated?: () => Promise<void> | void;
}

interface ProductFormState {
  id?: string;
  productCode: string;
  isStampEligible: boolean;
  name: string;
  description: string;
  categoryId: string;
  price: string;
  promoPrice: string;
  stock: string;
  isAvailable: boolean;
  imageUrl: string;
  isActive: boolean;
  isFavorite: boolean;
  isNewest: boolean;
  isBestSeller: boolean;
  flavors: VariantOption[];
  toppings: VariantOption[];
  glazes: VariantOption[];
}

const emptyForm = (defaultCatId: string): ProductFormState => ({
  productCode: '',
  isStampEligible: true,
  name: '',
  description: '',
  categoryId: defaultCatId,
  price: '',
  promoPrice: '',
  stock: '10',
  isAvailable: true,
  imageUrl: '',
  isActive: true,
  isFavorite: false,
  isNewest: true,
  isBestSeller: false,
  flavors: [],
  toppings: [],
  glazes: [],
});

export const AdminProductsTab: React.FC<AdminProductsTabProps> = ({
  currentAdmin,
  products,
  categories,
  openCreateImmediately = false,
  onProductsUpdated,
}) => {
  const [modalOpen, setModalOpen] = useState(openCreateImmediately);
  const [form, setForm] = useState<ProductFormState>(() => emptyForm(categories[0]?.id || ''));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const openAddModal = () => {
    setErrorMsg(null);
    setForm(emptyForm(categories[0]?.id || ''));
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setErrorMsg(null);
    setForm({
      id: product.id,
      productCode: product.productCode || '',
      isStampEligible: product.isStampEligible !== false,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId || categories[0]?.id || '',
      price: String(product.price),
      promoPrice: product.promoPrice ? String(product.promoPrice) : '',
      stock: String(product.stock),
      isAvailable: product.isAvailable,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      isFavorite: product.isFavorite,
      isNewest: product.isNewest,
      isBestSeller: product.isBestSeller,
      flavors: [...product.variants.flavors],
      toppings: [...product.variants.toppings],
      glazes: [...product.variants.glazes],
    });
    setModalOpen(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar (JPG, PNG, atau WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
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
          setForm((prev) => ({ ...prev, imageUrl: canvas.toDataURL('image/jpeg', 0.82) }));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const addVariantOption = (group: 'flavors' | 'toppings' | 'glazes') => {
    const newOpt: VariantOption = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      additionalPrice: 0,
      isActive: true,
    };
    setForm((prev) => ({ ...prev, [group]: [...prev[group], newOpt] }));
  };

  const updateVariantOption = (
    group: 'flavors' | 'toppings' | 'glazes',
    id: string,
    patch: Partial<VariantOption>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [group]: prev[group].map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  };

  const removeVariantOption = (group: 'flavors' | 'toppings' | 'glazes', id: string) => {
    setForm((prev) => ({
      ...prev,
      [group]: prev[group].filter((v) => v.id !== id),
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const priceNum = Number(form.price);
    const promoNum = form.promoPrice.trim() ? Number(form.promoPrice) : null;
    const stockNum = Number(form.stock);

    if (form.name.trim().length < 2) {
      setErrorMsg('Nama produk minimal 2 karakter.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setErrorMsg('Harga normal harus lebih dari Rp0.');
      return;
    }
    if (promoNum !== null && (promoNum <= 0 || promoNum >= priceNum)) {
      setErrorMsg('Harga promo harus lebih kecil dari harga normal.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Product> = {
        productCode: form.productCode.trim().toUpperCase() || undefined,
        isStampEligible: form.isStampEligible,
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        price: priceNum,
        promoPrice: promoNum,
        stock: Number.isFinite(stockNum) ? Math.max(0, stockNum) : 0,
        isAvailable: form.isAvailable,
        imageUrl: form.imageUrl.trim(),
        isActive: form.isActive,
        isFavorite: form.isFavorite,
        isNewest: form.isNewest,
        isBestSeller: form.isBestSeller,
        variants: {
          flavors: form.flavors.filter((v) => v.name.trim().length > 0),
          toppings: form.toppings.filter((v) => v.name.trim().length > 0),
          glazes: form.glazes.filter((v) => v.name.trim().length > 0),
        },
      };

      await upsertProductFirebase(currentAdmin, payload, form.id);
      if (onProductsUpdated) await onProductsUpdated();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    await upsertProductFirebase(
      currentAdmin,
      { isActive: !product.isActive, name: product.name },
      product.id,
    );
    if (onProductsUpdated) await onProductsUpdated();
  };

  const handleToggleAvailable = async (product: Product) => {
    await upsertProductFirebase(
      currentAdmin,
      { isAvailable: !product.isAvailable, name: product.name },
      product.id,
    );
    if (onProductsUpdated) await onProductsUpdated();
  };

  const renderVariantSection = (
    title: string,
    group: 'flavors' | 'toppings' | 'glazes',
    items: VariantOption[],
  ) => (
    <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-[#3B2316] uppercase">{title}</span>
        <button
          type="button"
          onClick={() => addVariantOption(group)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#3B2316] px-2.5 py-1 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
        >
          <Plus className="h-3 w-3" />
          <span>Tambah Opsi</span>
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[#6E5849]">Belum ada opsi {title.toLowerCase()}.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((opt) => (
            <div key={opt.id} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={opt.name}
                onChange={(e) => updateVariantOption(group, opt.id, { name: e.target.value })}
                placeholder={`Nama ${title.toLowerCase()}`}
                className="min-w-[140px] flex-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1.5 text-xs text-[#2C1810]"
              />
              <input
                type="number"
                min={0}
                value={opt.additionalPrice}
                onChange={(e) =>
                  updateVariantOption(group, opt.id, {
                    additionalPrice: Number(e.target.value) || 0,
                  })
                }
                placeholder="Tambahan Rp"
                className="w-28 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1.5 text-xs text-[#2C1810] tabular-nums"
              />
              <label className="flex items-center gap-1 text-xs text-[#3B2316]">
                <input
                  type="checkbox"
                  checked={opt.isActive}
                  onChange={(e) =>
                    updateVariantOption(group, opt.id, { isActive: e.target.checked })
                  }
                />
                <span>Aktif</span>
              </label>
              <button
                type="button"
                onClick={() => removeVariantOption(group, opt.id)}
                className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"
                aria-label="Hapus opsi"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Kelola Menu &amp; Produk
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Tambah produk, atur harga promo, stok, status tersedia/habis, serta varian rasa,
            topping, dan glaze.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-4 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
        >
          <Plus className="h-4 w-4 text-[#E7CFA2]" />
          <span>Tambah Produk</span>
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-12 text-center">
          <p className="font-serif-display text-lg font-bold text-[#2C1810]">
            Belum Ada Produk di Katalog
          </p>
          <p className="mt-1 text-sm text-[#5C4435]">
            Tambahkan produk roti atau kue pertama Anda agar langsung tampil di halaman pelanggan.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-5 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Produk Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#FBF6EE]">
                <ResilientImage
                  src={product.imageUrl}
                  alt={product.name}
                  fallbackLabel={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6E5849]">
                    <span className="truncate">
                      {categoryMap.get(product.categoryId) || 'Tanpa Kategori'}
                      {product.productCode ? ` · #${product.productCode}` : ''}
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${
                        product.isActive ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {product.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <h3 className="font-serif-display mt-1 truncate text-base font-bold text-[#2C1810]">
                    {product.name}
                  </h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-sm font-bold text-[#3B2316] tabular-nums">
                      {formatRupiah(product.promoPrice || product.price)}
                    </span>
                    {product.promoPrice && product.promoPrice < product.price && (
                      <span className="text-xs text-[#8C7362] line-through tabular-nums">
                        {formatRupiah(product.price)}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[#6E5849] tabular-nums">
                      Stok: {product.stock}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0E4D2] pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(product)}
                      className="rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1.5 text-xs font-medium text-[#3B2316] hover:bg-[#F2E7D6]"
                    >
                      {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAvailable(product)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        product.isAvailable && product.stock > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {product.isAvailable && product.stock > 0 ? 'Tersedia' : 'Habis'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="rounded-lg border border-[#E6D8C5] p-1.5 text-[#3B2316] hover:bg-[#F6EFE4]"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(product)}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                      aria-label={`Hapus ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Editor Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
              <h3 className="font-serif-display text-xl font-bold text-[#2C1810]">
                {form.id ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 space-y-5 overflow-y-auto p-6">
              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
                  {errorMsg}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Kode Produk (Club)
                  </label>
                  <input
                    type="text"
                    value={form.productCode}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, productCode: e.target.value.toUpperCase() }))
                    }
                    placeholder="Contoh: CK001"
                    className="font-mono-tabular mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Nama Produk *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: Cheesekuit Cokelat"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Kategori Menu</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Deskripsi Produk
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Jelaskan bahan, ukuran, dan keunggulan produk..."
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Harga Normal (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Harga Promo (Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.promoPrice}
                    onChange={(e) => setForm((p) => ({ ...p, promoPrice: e.target.value }))}
                    placeholder="Opsional"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Stok *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Status Ketersediaan
                  </label>
                  <select
                    value={form.isAvailable ? 'available' : 'soldout'}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isAvailable: e.target.value === 'available' }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  >
                    <option value="available">Tersedia</option>
                    <option value="soldout">Habis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Foto Produk (URL Gambar atau Unggah Foto)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://... atau unggah foto lokal"
                    className="min-w-[200px] flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-2.5 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]">
                    <Upload className="h-4 w-4" />
                    <span>Unggah Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-4 py-3 text-xs font-medium text-[#2C1810]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  <span>Aktif di Katalog</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isFavorite}
                    onChange={(e) => setForm((p) => ({ ...p, isFavorite: e.target.checked }))}
                  />
                  <span>Menu Favorit</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isNewest}
                    onChange={(e) => setForm((p) => ({ ...p, isNewest: e.target.checked }))}
                  />
                  <span>Label Terbaru</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isBestSeller}
                    onChange={(e) => setForm((p) => ({ ...p, isBestSeller: e.target.checked }))}
                  />
                  <span>Label Terlaris</span>
                </label>
                <label className="flex items-center gap-2 text-[#8E2E49]">
                  <input
                    type="checkbox"
                    checked={form.isStampEligible}
                    onChange={(e) => setForm((p) => ({ ...p, isStampEligible: e.target.checked }))}
                  />
                  <span>Produk Penghasil Stempel</span>
                </label>
              </div>

              <div className="space-y-3">
                {renderVariantSection('Pilihan Rasa', 'flavors', form.flavors)}
                {renderVariantSection('Pilihan Topping', 'toppings', form.toppings)}
                {renderVariantSection('Pilihan Glaze', 'glazes', form.glazes)}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E6D8C5] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#E6D8C5] px-4 py-2.5 text-sm font-medium text-[#3B2316] hover:bg-[#F6EFE4]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#3B2316] px-6 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Produk?"
        message={`Anda yakin ingin menghapus produk "${deleteTarget?.name}" secara permanen?`}
        confirmLabel="Ya, Hapus Produk"
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteProductFirebase(currentAdmin, deleteTarget);
            if (onProductsUpdated) await onProductsUpdated();
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
};
