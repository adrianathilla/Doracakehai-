import React from 'react';
import { Edit3, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { CartItem, StoreSettings } from '../types';
import { formatRupiah } from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onEditVariant: (item: CartItem) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  items,
  settings,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onEditVariant,
  onProceedToCheckout,
}) => {
  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const qualifiesFreeShipping = subtotal >= settings.minFreeShipping;
  const estimatedShipping =
    items.length === 0 ? 0 : qualifiesFreeShipping ? 0 : settings.defaultShippingCost;
  const estimatedTotal = subtotal + estimatedShipping;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#2C1810]/60 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-md flex-col bg-[#FFFDF9] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6D8C5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#9E7840]" />
            <h2 className="font-serif-display text-xl font-bold text-[#2C1810]">
              Keranjang Belanja
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#6E5849] transition-colors hover:bg-[#F6EFE4] hover:text-[#2C1810]"
            aria-label="Tutup keranjang"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6EFE4] text-[#9E7840]">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <h3 className="font-serif-display mt-4 text-lg font-bold text-[#2C1810]">
                Keranjang Masih Kosong
              </h3>
              <p className="mt-1.5 max-w-xs text-sm text-[#5C4435]">
                Yuk pilih roti, pastry, atau cake favoritmu dari katalog DoraCake!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const variantTags: string[] = [];
                if (item.selectedVariants.flavor)
                  variantTags.push(`Rasa: ${item.selectedVariants.flavor.name}`);
                if (item.selectedVariants.topping)
                  variantTags.push(`Topping: ${item.selectedVariants.topping.name}`);
                if (item.selectedVariants.glaze)
                  variantTags.push(`Glaze: ${item.selectedVariants.glaze.name}`);

                return (
                  <div
                    key={item.cartItemId}
                    className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-4"
                  >
                    <div className="flex gap-3.5">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E6D8C5] bg-[#FFFDF9]">
                        <ResilientImage
                          src={item.productImage}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-serif-display truncate text-sm font-bold text-[#2C1810]">
                            {item.productName}
                          </h4>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.cartItemId)}
                            className="rounded-lg p-1 text-[#8C7362] transition-colors hover:bg-rose-50 hover:text-rose-700"
                            aria-label={`Hapus ${item.productName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {variantTags.length > 0 && (
                          <p className="mt-1 text-xs text-[#5C4435]">
                            {variantTags.join(' · ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="mt-1 text-xs italic text-[#6E5849]">
                            Catatan: &ldquo;{item.notes}&rdquo;
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onEditVariant(item)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#9E7840] hover:underline"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit varian</span>
                          </button>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] p-0.5">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#3B2316] hover:bg-[#F6EFE4]"
                                aria-label="Kurangi"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                                className="flex h-6 w-6 items-center justify-center rounded text-[#3B2316] hover:bg-[#F6EFE4]"
                                aria-label="Tambah"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-[#2C1810] tabular-nums">
                              {formatRupiah(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary & Checkout CTA */}
        {items.length > 0 && (
          <div className="border-t border-[#E6D8C5] bg-[#FBF6EE] p-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-[#5C4435]">
                <span>Subtotal</span>
                <span className="font-semibold text-[#2C1810] tabular-nums">
                  {formatRupiah(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#5C4435]">
                <span>Estimasi Pengiriman (Antar)</span>
                <span className="font-semibold text-[#2C1810] tabular-nums">
                  {qualifiesFreeShipping ? 'Gratis' : formatRupiah(estimatedShipping)}
                </span>
              </div>
              {!qualifiesFreeShipping && (
                <p className="text-xs text-[#9E7840]">
                  Tambah {formatRupiah(settings.minFreeShipping - subtotal)} lagi untuk gratis ongkir
                  (khusus metode Antar) atau pilih Ambil di Toko (Gratis).
                </p>
              )}
              <div className="flex items-center justify-between border-t border-[#E6D8C5] pt-3 text-base font-bold text-[#2C1810]">
                <span>Estimasi Total</span>
                <span className="tabular-nums">{formatRupiah(estimatedTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="mt-4 w-full rounded-xl bg-[#3B2316] px-5 py-3.5 text-sm font-semibold text-[#FBF6EE] shadow-sm transition-colors hover:bg-[#4F3020]"
            >
              Lanjut ke Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
