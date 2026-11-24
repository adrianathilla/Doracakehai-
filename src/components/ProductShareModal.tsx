import React, { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Share2, X } from 'lucide-react';
import { CustomerAccount, Product } from '../types';
import { buildWhatsAppLink, formatRupiah } from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface ProductShareModalProps {
  product: Product | null;
  activeCustomer: CustomerAccount | null;
  onClose: () => void;
  onRecordShareClick: (product: Product, referralCodeUsed?: string) => void;
}

export const ProductShareModal: React.FC<ProductShareModalProps> = ({
  product,
  activeCustomer,
  onClose,
  onRecordShareClick,
}) => {
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const productCode = product.productCode || product.id.slice(-5).toUpperCase();
  const refCode = activeCustomer?.referralCode || '';

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://doracake.id';
  const shareUrl = refCode
    ? `${baseOrigin}/?product=${encodeURIComponent(productCode)}&ref=${encodeURIComponent(refCode)}`
    : `${baseOrigin}/?product=${encodeURIComponent(productCode)}`;

  const displayPrice =
    product.promoPrice !== null && product.promoPrice > 0 && product.promoPrice < product.price
      ? product.promoPrice
      : product.price;

  const waMessage = [
    `Hai! Cobain ${product.name} (${productCode}) dari DoraCake Bakery & Pastry yuk — harga ${formatRupiah(displayPrice)}.`,
    refCode ? `Pakai tautan referral aku ya (${refCode})!` : '',
    `Lihat & pesan di sini: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6D8C5] bg-[#FDF2F5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="h-5 w-5 text-[#8E2E49]" />
            <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">
              Bagikan Produk &amp; Promosi
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#6E5849] hover:bg-[#FFFDF9]"
            aria-label="Tutup bagikan produk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3.5 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E6D8C5] bg-[#FFFDF9]">
              <ResilientImage
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono-tabular text-xs font-semibold text-[#8E2E49]">
                Kode Produk: {productCode}
                {refCode ? ` · Referral: ${refCode}` : ''}
              </p>
              <h3 className="font-serif-display truncate text-base font-bold text-[#2C1810]">
                {product.name}
              </h3>
              <p className="text-sm font-bold text-[#3B2316] tabular-nums">
                {formatRupiah(displayPrice)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Tautan Produk {refCode ? '(Terkait dengan Kode Referral Anda)' : '(Mode Tamu)'}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="font-mono-tabular flex-1 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-xs text-[#2C1810]"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#3B2316] hover:bg-[#F6EFE4] whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin Tautan'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[#6E5849]">
              Kode produk (<span className="font-mono-tabular font-semibold">{productCode}</span>) dan kode referral (
              <span className="font-mono-tabular font-semibold">{refCode || 'tidak ada'}</span>) dipisahkan otomatis oleh sistem untuk pelacakan penjualan yang akurat. Hadiah hanya dihitung dari transaksi valid yang selesai &amp; lunas.
            </p>
          </div>

          <a
            href={buildWhatsAppLink('', waMessage).replace('https://wa.me/62?', 'https://wa.me/?')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onRecordShareClick(product, refCode || 'TAMU')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B2316] px-4 py-3 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
          >
            <MessageCircle className="h-4 w-4 text-[#E7CFA2]" />
            <span>Bagikan ke WhatsApp</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        </div>
      </div>
    </div>
  );
};
