import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { AdminUserPublic, Category, Product } from '../../types';
import {
  deleteCategoryFirebase,
  upsertCategoryFirebase,
  upsertProductFirebase,
} from '../../services/firebaseService';
import { ConfirmModal } from '../ConfirmModal';
import { ResilientImage } from '../ResilientImage';

interface AdminCategoriesTabProps {
  currentAdmin: AdminUserPublic;
  categories: Category[];
  products: Product[];
  onUpdated?: () => Promise<void> | void;
}

export const AdminCategoriesTab: React.FC<AdminCategoriesTabProps> = ({
  currentAdmin,
  categories,
  products,
  onUpdated,
}) => {
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const openNew = () => {
    setEditingCat(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setIsActive(true);
    setSelectedProductIds([]);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setDescription(cat.description);
    setImageUrl(cat.imageUrl || '');
    setIsActive(cat.isActive);
    setSelectedProductIds(products.filter((p) => p.categoryId === cat.id).map((p) => p.id));
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
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
          setImageUrl(canvas.toDataURL('image/jpeg', 0.82));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setErrorMsg('Nama kategori minimal 2 karakter.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const targetCatId = await upsertCategoryFirebase(
        currentAdmin,
        {
          name: name.trim(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          sortOrder: editingCat?.sortOrder || sortedCategories.length + 1,
          isActive,
        },
        editingCat?.id,
      );

      if (targetCatId) {
        for (const prod of products) {
          const shouldBelong = selectedProductIds.includes(prod.id);
          if (shouldBelong && prod.categoryId !== targetCatId) {
            await upsertProductFirebase(
              currentAdmin,
              { categoryId: targetCatId, name: prod.name },
              prod.id,
            ).catch(() => {});
          } else if (!shouldBelong && prod.categoryId === targetCatId) {
            await upsertProductFirebase(
              currentAdmin,
              { categoryId: '', name: prod.name },
              prod.id,
            ).catch(() => {});
          }
        }
      }
      if (onUpdated) await onUpdated();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;
    const current = sortedCategories[index];
    const target = sortedCategories[swapIndex];
    await upsertCategoryFirebase(
      currentAdmin,
      { sortOrder: target.sortOrder, name: current.name },
      current.id,
    );
    await upsertCategoryFirebase(
      currentAdmin,
      { sortOrder: current.sortOrder, name: target.name },
      target.id,
    );
    if (onUpdated) await onUpdated();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Kelola Kategori Menu
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Atur nama, gambar kategori, urutan tampil, status aktif, serta daftar produk di
            dalamnya.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3B2316] px-4 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
        >
          <Plus className="h-4 w-4 text-[#E7CFA2]" />
          <span>Tambah Kategori</span>
        </button>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-12 text-center">
          <p className="font-serif-display text-lg font-bold text-[#2C1810]">
            Belum Ada Kategori Menu
          </p>
          <p className="mt-1 text-sm text-[#5C4435]">
            Buat kategori seperti Roti Cokelat, Croissant, atau Birthday Cake agar katalog tertata
            rapi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCategories.map((cat, idx) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 shadow-sm"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E6D8C5] bg-[#FBF6EE]">
                    <ResilientImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-xs font-semibold text-[#9E7840]">
                        #{idx + 1}
                      </span>
                      <h3 className="font-serif-display truncate text-base font-bold text-[#2C1810]">
                        {cat.name}
                      </h3>
                      <span
                        className={`text-xs font-semibold ${
                          cat.isActive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        · {cat.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5C4435]">
                      {cat.description || 'Tidak ada deskripsi'} ·{' '}
                      <span className="font-semibold tabular-nums">{count} produk</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveOrder(idx, -1)}
                    className="rounded-lg border border-[#E6D8C5] p-2 text-[#3B2316] hover:bg-[#F6EFE4] disabled:opacity-40"
                    aria-label="Naikkan urutan"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sortedCategories.length - 1}
                    onClick={() => handleMoveOrder(idx, 1)}
                    className="rounded-lg border border-[#E6D8C5] p-2 text-[#3B2316] hover:bg-[#F6EFE4] disabled:opacity-40"
                    aria-label="Turunkan urutan"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="rounded-lg border border-[#E6D8C5] p-2 text-[#3B2316] hover:bg-[#F6EFE4]"
                    aria-label={`Edit ${cat.name}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(cat)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                    aria-label={`Hapus ${cat.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
              <h3 className="font-serif-display text-xl font-bold text-[#2C1810]">
                {editingCat ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-2 text-[#6E5849] hover:bg-[#F6EFE4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 space-y-4 overflow-y-auto p-6">
              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Birthday Cake"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">Deskripsi</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat kategori"
                  className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3B2316]">
                  Gambar Kategori (URL atau Unggah)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="min-w-0 flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F2E7D6]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Unggah</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-[#2C1810]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Tampilkan kategori ini di katalog pelanggan</span>
              </label>

              {products.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#3B2316]">Produk dalam Kategori Ini</p>
                  <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3">
                    {products.map((prod) => {
                      const checked = selectedProductIds.includes(prod.id);
                      return (
                        <label
                          key={prod.id}
                          className="flex items-center gap-2 text-xs text-[#2C1810]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedProductIds((prev) =>
                                e.target.checked
                                  ? [...prev, prod.id]
                                  : prev.filter((id) => id !== prod.id),
                              )
                            }
                          />
                          <span className="truncate">{prod.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[#E6D8C5] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#E6D8C5] px-4 py-2 text-sm text-[#3B2316]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#3B2316] px-5 py-2 text-sm font-semibold text-[#FBF6EE]"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Kategori?"
        message={`Anda yakin ingin menghapus kategori "${deleteTarget?.name}"?`}
        confirmLabel="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteCategoryFirebase(currentAdmin, deleteTarget);
            if (onUpdated) await onUpdated();
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
