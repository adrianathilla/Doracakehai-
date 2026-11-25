import React from 'react';
import { CakeSlice, ChevronDown, Plus, Share2, Sparkles } from 'lucide-react';
import { Category, Product, WebsiteContentConfig } from '../types';
import { formatRupiah } from '../utils/format';
import { ResilientImage } from './ResilientImage';

export type CatalogSortOption =
  | 'recommended'
  | 'newest'
  | 'bestseller'
  | 'price_asc'
  | 'price_desc';

interface CatalogSectionProps {
  website: WebsiteContentConfig;
  products: Product[];
  categories: Category[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  sortBy: CatalogSortOption;
  onSortChange: (sort: CatalogSortOption) => void;
  searchQuery: string;
  onResetFilters: () => void;
  onSelectProduct: (product: Product) => void;
  onShareProduct?: (product: Product) => void;
  isLoading: boolean;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  website,
  products,
  categories,
  activeTab,
  onTabChange,
  sortBy,
  onSortChange,
  searchQuery,
  onResetFilters,
  onSelectProduct,
  onShareProduct,
  isLoading,
}) => {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const spacingClass =
    website.sectionSpacing === 'compact'
      ? 'py-8 lg:py-10'
      : website.sectionSpacing === 'relaxed'
        ? 'py-16 lg:py-20'
        : 'py-12 lg:py-16';

  const cardRadiusClass =
    website.cardRadius === 'md'
      ? 'rounded-lg'
      : website.cardRadius === 'lg'
        ? 'rounded-xl'
        : 'rounded-2xl';

  const gridColsClass =
    website.cardColumns === 2
      ? 'sm:grid-cols-2'
      : website.cardColumns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section
      id="katalog"
      className={`mx-auto max-w-7xl px-4 sm:px-6 ${spacingClass}`}
      style={{ color: website.textColor }}
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-[#E6D8C5] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          {website.catalogKicker && (
            <p
              className="text-xs font-semibold tracking-[0.12em] uppercase"
              style={{ color: website.accentColor }}
            >
              {website.catalogKicker}
            </p>
          )}
          <h2
            className="mt-1 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
          >
            {website.catalogTitle}
          </h2>
          <p className="mt-1.5 text-sm opacity-80">
            {website.catalogDescription} ·{' '}
            <span className="font-semibold tabular-nums">{products.length}</span> menu tersedia.
          </p>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="catalog-sort"
            className="text-xs font-medium opacity-75 whitespace-nowrap"
          >
            Urutkan:
          </label>
          <div className="relative">
            <select
              id="catalog-sort"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as CatalogSortOption)}
              className="appearance-none rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] py-2 pl-3.5 pr-9 text-sm font-medium text-[#2C1810] focus:border-[#C89D54] focus:outline-none"
            >
              <option value="recommended">Rekomendasi</option>
              <option value="newest">Terbaru</option>
              <option value="bestseller">Terlaris</option>
              <option value="price_asc">Harga: Terendah</option>
              <option value="price_desc">Harga: Tertinggi</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E5849]" />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs (with optional Category Image thumbnails) */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onTabChange('all')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'all' ? 'shadow-sm' : 'border border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#FBF6EE]'
          }`}
          style={
            activeTab === 'all'
              ? { backgroundColor: website.buttonBgColor, color: website.buttonTextColor }
              : { color: website.textColor }
          }
        >
          {website.tabAllLabel}
        </button>

        {website.showFavoriteTab && (
          <button
            type="button"
            onClick={() => onTabChange('favorite')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'favorite'
                ? 'shadow-sm'
                : 'border border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#FBF6EE]'
            }`}
            style={
              activeTab === 'favorite'
                ? { backgroundColor: website.buttonBgColor, color: website.buttonTextColor }
                : { color: website.textColor }
            }
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: website.accentColor }} />
            <span>{website.tabFavoriteLabel}</span>
          </button>
        )}

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onTabChange(cat.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === cat.id
                ? 'shadow-sm'
                : 'border border-[#E6D8C5] bg-[#FFFDF9] hover:bg-[#FBF6EE]'
            }`}
            style={
              activeTab === cat.id
                ? { backgroundColor: website.buttonBgColor, color: website.buttonTextColor }
                : { color: website.textColor }
            }
          >
            {cat.imageUrl && (
              <span className="h-5 w-5 overflow-hidden rounded-md bg-[#F2E7D6]">
                <ResilientImage
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="h-full w-full object-cover"
                />
              </span>
            )}
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Loading / Empty / Grid */}
      {isLoading ? (
        <div className={`mt-8 grid gap-6 ${gridColsClass}`}>
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={`animate-pulse overflow-hidden border border-[#E6D8C5] bg-[#FFFDF9] p-4 ${cardRadiusClass}`}
            >
              <div className="aspect-[4/3] w-full rounded-xl bg-[#EFE5D6]" />
              <div className="mt-4 h-5 w-2/3 rounded bg-[#EFE5D6]" />
              <div className="mt-2 h-4 w-1/2 rounded bg-[#EFE5D6]" />
              <div className="mt-4 h-10 w-full rounded-xl bg-[#EFE5D6]" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div
          className={`mt-8 flex flex-col items-center justify-center border border-[#E6D8C5] bg-[#FFFDF9] px-6 py-16 text-center shadow-sm ${cardRadiusClass}`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6EFE4] text-[#9E7840]">
            <CakeSlice className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h3
            className="mt-4 text-xl font-bold"
            style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
          >
            Tidak Ada Produk Ditemukan
          </h3>
          <p className="mt-2 max-w-md text-sm opacity-80">
            {searchQuery
              ? `Tidak ada menu yang cocok dengan pencarian "${searchQuery}".`
              : 'Belum ada produk aktif pada kategori ini.'}
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{
              backgroundColor: website.buttonBgColor,
              color: website.buttonTextColor,
            }}
          >
            {website.tabAllLabel}
          </button>
        </div>
      ) : (
        <div className={`mt-8 grid gap-6 ${gridColsClass}`}>
          {products.map((product) => {
            const hasPromo =
              product.promoPrice !== null &&
              product.promoPrice > 0 &&
              product.promoPrice < product.price;
            const displayPrice = hasPromo ? product.promoPrice! : product.price;
            const categoryName = categoryMap.get(product.categoryId) || 'Menu Spesial';
            const outOfStock = !product.isAvailable || product.stock <= 0;
            const highlightLabel = product.isBestSeller
              ? 'Terlaris'
              : product.isNewest
                ? 'Terbaru'
                : product.isFavorite
                  ? 'Favorit'
                  : null;

            return (
              <article
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className={`group flex cursor-pointer flex-col overflow-hidden border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cardRadiusClass}`}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FBF6EE]">
                  <ResilientImage
                    src={product.imageUrl}
                    alt={product.name}
                    fallbackLabel={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#2C1810]/55">
                      <span className="rounded-lg bg-[#FFFDF9] px-3 py-1 text-xs font-bold text-[#2C1810]">
                        Habis
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    {(website.showProductCategory || website.showProductAvailability) && (
                      <div className="flex items-center justify-between gap-2 text-xs text-[#6E5849]">
                        {website.showProductCategory ? (
                          <span className="truncate font-medium">
                            {categoryName}
                            {highlightLabel ? ` · ${highlightLabel}` : ''}
                          </span>
                        ) : (
                          <span />
                        )}
                        {website.showProductAvailability && (
                          <span
                            className={`shrink-0 font-medium ${
                              outOfStock ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {outOfStock ? 'Habis' : 'Tersedia'}
                          </span>
                        )}
                      </div>
                    )}

                    <h3
                      className="mt-1.5 text-lg font-bold line-clamp-1"
                      style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
                    >
                      {product.name}
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6E5849]">
                      {product.productCode && (
                        <span className="font-mono-tabular font-semibold text-[#8E2E49]">
                          #{product.productCode}
                        </span>
                      )}
                      {product.isStampEligible !== false && (
                        <span>{product.productCode ? '· ' : ''}Berhadiah Stempel</span>
                      )}
                      <span className="font-mono-tabular font-medium text-[#5C4435]">
                        · Terjual {(product.soldCount ?? 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {website.showProductDescription && product.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed opacity-80">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#F0E4D2] pt-4">
                    <div className="min-w-0">
                      <div className="text-base font-bold tabular-nums">
                        {formatRupiah(displayPrice)}
                      </div>
                      {hasPromo && website.showPromoStrikePrice && (
                        <div className="text-xs text-[#8C7362] line-through tabular-nums">
                          {formatRupiah(product.price)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onShareProduct && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShareProduct(product);
                          }}
                          title="Bagikan Produk"
                          aria-label={`Bagikan ${product.name}`}
                          className="inline-flex items-center justify-center rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] p-2 text-[#8E2E49] transition-colors hover:bg-[#FCE7EE]"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: website.buttonBgColor,
                          color: website.buttonTextColor,
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" style={{ color: website.accentColor }} />
                        <span>{outOfStock ? 'Habis' : 'Pesan'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
