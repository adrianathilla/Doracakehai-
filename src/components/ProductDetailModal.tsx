import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus, Share2, ShoppingBag, Stamp, X } from 'lucide-react';
import { CartItem, Product, SelectedVariants, VariantOption } from '../types';
import { formatRupiah } from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  product: Product | null;
  categoryName?: string;
  editingCartItem?: CartItem | null;
  onClose: () => void;
  onSubmitToCart: (item: CartItem, replaceCartItemId?: string) => void;
  onShareProduct?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  categoryName,
  editingCartItem,
  onClose,
  onSubmitToCart,
  onShareProduct,
}) => {
  const [selectedFlavor, setSelectedFlavor] = useState<VariantOption | null>(null);
  const [selectedTopping, setSelectedTopping] = useState<VariantOption | null>(null);
  const [selectedGlaze, setSelectedGlaze] = useState<VariantOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!product) return;
    const activeFlavors = product.variants.flavors.filter((v) => v.isActive);
    const activeToppings = product.variants.toppings.filter((v) => v.isActive);
    const activeGlazes = product.variants.glazes.filter((v) => v.isActive);

    if (editingCartItem) {
      setSelectedFlavor(
        activeFlavors.find((f) => f.id === editingCartItem.selectedVariants.flavor?.id) || null,
      );
      setSelectedTopping(
        activeToppings.find((t) => t.id === editingCartItem.selectedVariants.topping?.id) || null,
      );
      setSelectedGlaze(
        activeGlazes.find((g) => g.id === editingCartItem.selectedVariants.glaze?.id) || null,
      );
      setQuantity(editingCartItem.quantity);
      setNotes(editingCartItem.notes || '');
    } else {
      setSelectedFlavor(activeFlavors[0] || null);
      setSelectedTopping(null);
      setSelectedGlaze(null);
      setQuantity(1);
      setNotes('');
    }
  }, [product, editingCartItem]);

  if (!product) return null;

  const activeFlavors = product.variants.flavors.filter((v) => v.isActive);
  const activeToppings = product.variants.toppings.filter((v) => v.isActive);
  const activeGlazes = product.variants.glazes.filter((v) => v.isActive);

  const hasPromo =
    product.promoPrice !== null && product.promoPrice > 0 && product.promoPrice < product.price;
  const baseUnitPrice = hasPromo ? product.promoPrice! : product.price;
  const extraPrice =
    (selectedFlavor?.additionalPrice || 0) +
    (selectedTopping?.additionalPrice || 0) +
    (selectedGlaze?.additionalPrice || 0);
  const unitPrice = baseUnitPrice + extraPrice;
  const totalPrice = unitPrice * quantity;

  const isAvailable = product.isAvailable && product.stock > 0;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable) return;

    const selectedVariants: SelectedVariants = {
      flavor: selectedFlavor,
      topping: selectedTopping,
      glaze: selectedGlaze,
    };

    const variantKey = [
      selectedFlavor?.id || 'none',
      selectedTopping?.id || 'none',
      selectedGlaze?.id || 'none',
    ].join('-');

    const cartItem: CartItem = {
      cartItemId: editingCartItem?.cartItemId || `${product.id}_${variantKey}_${Date.now()}`,
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      productImage: product.imageUrl,
      baseUnitPrice,
      selectedVariants,
      unitPrice,
      quantity: Math.min(50, Math.max(1, quantity)),
      notes: notes.trim(),
    };

    onSubmitToCart(cartItem, editingCartItem?.cartItemId);
  };

  const renderVariantGroup = (
    title: string,
    options: VariantOption[],
    selected: VariantOption | null,
    onSelect: (opt: VariantOption | null) => void,
    allowNone = true,
  ) => {
    if (options.length === 0) return null;
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-[#3B2316] uppercase">
            {title}
          </span>
          {allowNone && selected && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs font-medium text-[#9E7840] hover:underline"
            >
              Reset pilihan
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt) => {
            const isSelected = selected?.id === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(isSelected && allowNone ? null : opt)}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                    : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#2C1810] hover:border-[#C89D54]'
                }`}
              >
                <span className="flex items-center gap-2 font-medium truncate">
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#E7CFA2]" />}
                  <span className="truncate">{opt.name}</span>
                </span>
                <span
                  className={`ml-2 shrink-0 text-xs tabular-nums ${
                    isSelected ? 'text-[#E7CFA2]' : 'text-[#6E5849]'
                  }`}
                >
                  {opt.additionalPrice > 0 ? `+${formatRupiah(opt.additionalPrice)}` : 'Gratis'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl md:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9]/90 p-2 text-[#2C1810] shadow-sm transition-colors hover:bg-[#F6EFE4]"
          aria-label="Tutup detail produk"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left Image */}
        <div className="w-full shrink-0 bg-[#FBF6EE] md:w-5/12">
          <div className="aspect-[4/3] h-full w-full md:aspect-auto">
            <ResilientImage
              src={product.imageUrl}
              alt={product.name}
              fallbackLabel={product.name}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Right Details & Variants */}
        <form
          onSubmit={handleConfirm}
          className="flex flex-1 flex-col justify-between overflow-y-auto p-6"
        >
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 pr-10">
                <p className="text-xs font-medium text-[#9E7840]">
                  {categoryName || 'DoraCake Bakery'} · {isAvailable ? 'Tersedia' : 'Habis'}
                </p>
                {product.productCode && (
                  <span className="font-mono-tabular rounded-md border border-[#EAB8C6] bg-[#FDF2F5] px-2 py-0.5 text-[11px] font-bold text-[#8E2E49]">
                    {product.productCode}
                  </span>
                )}
              </div>
              <h2 className="font-serif-display mt-1 text-2xl font-bold text-[#2C1810]">
                {product.name}
              </h2>

              <div className="mt-2.5 flex flex-wrap items-baseline gap-2.5">
                <span className="text-xl font-bold text-[#3B2316] tabular-nums">
                  {formatRupiah(unitPrice)}
                </span>
                {hasPromo && (
                  <span className="text-sm text-[#8C7362] line-through tabular-nums">
                    {formatRupiah(product.price + extraPrice)}
                  </span>
                )}
                {extraPrice > 0 && (
                  <span className="text-xs font-medium text-[#9E7840] tabular-nums">
                    (Termasuk varian +{formatRupiah(extraPrice)})
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {product.isStampEligible !== false && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1 text-[11px] font-medium text-[#5C4435]">
                    <Stamp className="h-3.5 w-3.5 text-[#8E2E49]" />
                    <span>Produk Penghasil Stempel (Subtotal &gt; Rp15.000)</span>
                  </span>
                )}
                {onShareProduct && (
                  <button
                    type="button"
                    onClick={() => onShareProduct(product)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAB8C6] bg-[#FDF2F5] px-3 py-1 text-[11px] font-semibold text-[#8E2E49] hover:bg-[#FCE7EE] whitespace-nowrap"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>BAGIKAN PRODUK</span>
                  </button>
                )}
              </div>

              {product.description && (
                <p className="mt-3 text-sm leading-relaxed text-[#5C4435]">{product.description}</p>
              )}
            </div>

            {renderVariantGroup(
              'Pilihan Rasa',
              activeFlavors,
              selectedFlavor,
              setSelectedFlavor,
              false,
            )}
            {renderVariantGroup('Pilihan Topping', activeToppings, selectedTopping, setSelectedTopping)}
            {renderVariantGroup('Pilihan Glaze', activeGlazes, selectedGlaze, setSelectedGlaze)}

            <div>
              <label
                htmlFor="product-notes"
                className="block text-xs font-semibold tracking-wider text-[#3B2316] uppercase"
              >
                Catatan Khusus (Opsional)
              </label>
              <textarea
                id="product-notes"
                rows={2}
                maxLength={250}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Ucapan selamat ulang tahun, tingkat kemanisan sedang..."
                className="mt-2 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810] placeholder:text-[#8C7362] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#E6D8C5] pt-5">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#3B2316] transition-colors hover:bg-[#FFFDF9]"
                aria-label="Kurangi jumlah"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-[#2C1810] tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#3B2316] transition-colors hover:bg-[#FFFDF9]"
                aria-label="Tambah jumlah"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!isAvailable}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#3B2316] px-5 py-3 text-sm font-semibold text-[#FBF6EE] transition-colors hover:bg-[#4F3020] disabled:bg-[#C6B6A6] whitespace-nowrap"
            >
              <ShoppingBag className="h-4 w-4 text-[#E7CFA2]" />
              <span>
                {editingCartItem ? 'Simpan Perubahan' : 'Tambah ke Keranjang'} ·{' '}
                {formatRupiah(totalPrice)}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
