import React from 'react';
import { Megaphone } from 'lucide-react';
import {
  Category,
  CustomerAccount,
  Product,
  PromoCampaign,
  StoreSettings,
  WebsiteContentConfig,
} from '../types';
import { CustomerHeader } from './CustomerHeader';
import { HeroSection } from './HeroSection';
import { CatalogSection, CatalogSortOption } from './CatalogSection';
import { ExtraSectionsRenderer } from './ExtraSectionsRenderer';
import { CustomerFooter } from './CustomerFooter';

interface StorefrontViewProps {
  website: WebsiteContentConfig;
  settings: StoreSettings;
  products: Product[];
  categories: Category[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sortBy: CatalogSortOption;
  onSortChange: (sort: CatalogSortOption) => void;
  onResetFilters: () => void;
  onSelectProduct: (product: Product) => void;
  onShareProduct?: (product: Product) => void;
  cartCount: number;
  onOpenTracking: () => void;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
  activeCustomer?: CustomerAccount | null;
  onOpenMemberClub?: () => void;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
  activeCampaigns?: PromoCampaign[];
  isLoading: boolean;
  errorMsg?: string | null;
  isPreview?: boolean;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  website,
  settings,
  products,
  categories,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  sortBy,
  onSortChange,
  onResetFilters,
  onSelectProduct,
  onShareProduct,
  cartCount,
  onOpenTracking,
  onOpenCart,
  onOpenAdmin,
  activeCustomer,
  onOpenMemberClub,
  unreadNotifCount = 0,
  onOpenNotifications,
  activeCampaigns = [],
  isLoading,
  errorMsg,
  isPreview = false,
}) => {
  const fontSizeClass =
    website.fontSizeScale === 'sm'
      ? 'text-[14px]'
      : website.fontSizeScale === 'lg'
        ? 'text-[17px]'
        : 'text-[15px]';

  const handleScrollToCatalog = () => {
    const el = document.getElementById(isPreview ? 'preview-katalog' : 'katalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const featuredCampaign = activeCampaigns.find((c) => c.isActive);

  return (
    <div
      className={`flex min-h-screen flex-col ${fontSizeClass}`}
      style={{
        backgroundColor: website.pageBgColor,
        color: website.textColor,
      }}
    >
      <CustomerHeader
        website={website}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        cartCount={cartCount}
        onOpenTracking={onOpenTracking}
        onOpenCart={onOpenCart}
        onOpenAdmin={onOpenAdmin}
        activeCustomer={activeCustomer}
        onOpenMemberClub={onOpenMemberClub}
        unreadNotifCount={unreadNotifCount}
        onOpenNotifications={onOpenNotifications}
        isPreview={isPreview}
      />

      <main className="flex-1">
        <HeroSection
          website={website}
          settings={settings}
          onScrollToCatalog={handleScrollToCatalog}
        />

        {!isPreview && featuredCampaign && (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] px-5 py-3.5 text-sm text-[#3B2316]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8E2E49] text-white">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#8E2E49] uppercase">
                      {featuredCampaign.badgeText}
                    </span>
                    {featuredCampaign.promoCode && (
                      <span className="font-mono-tabular rounded-md border border-[#EAB8C6] bg-[#FFFDF9] px-2 py-0.5 text-xs font-bold text-[#8E2E49]">
                        Kode: {featuredCampaign.promoCode}
                      </span>
                    )}
                  </div>
                  <p className="font-serif-display font-bold text-[#2C1810]">
                    {featuredCampaign.title}
                  </p>
                  <p className="text-xs text-[#5C4435]">{featuredCampaign.subtitle}</p>
                </div>
              </div>
              {onOpenMemberClub && (
                <button
                  type="button"
                  onClick={onOpenMemberClub}
                  className="rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#8E2E49] hover:bg-[#FCE7EE] whitespace-nowrap shrink-0"
                >
                  {activeCustomer ? 'Buka Customer Club' : 'Gabung Customer Club'}
                </button>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMsg}
            </div>
          </div>
        )}

        <div id={isPreview ? 'preview-katalog' : undefined}>
          <CatalogSection
            website={website}
            products={products}
            categories={categories}
            activeTab={activeTab}
            onTabChange={onTabChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            searchQuery={searchQuery}
            onResetFilters={onResetFilters}
            onSelectProduct={onSelectProduct}
            onShareProduct={isPreview ? undefined : onShareProduct}
            isLoading={isLoading}
          />
        </div>

        <ExtraSectionsRenderer website={website} />
      </main>

      <CustomerFooter
        website={website}
        settings={settings}
        onOpenTracking={onOpenTracking}
        onOpenAdmin={onOpenAdmin}
      />
    </div>
  );
};
