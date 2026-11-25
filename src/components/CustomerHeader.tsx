import React, { useState } from 'react';
import { Bell, Crown, Menu, PackageSearch, Search, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { CustomerAccount, HeaderNavKey, WebsiteContentConfig } from '../types';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAInstallButton';

interface CustomerHeaderProps {
  website: WebsiteContentConfig;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenTracking: () => void;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
  activeCustomer?: CustomerAccount | null;
  onOpenMemberClub?: () => void;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
  isPreview?: boolean;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  website,
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenTracking,
  onOpenCart,
  onOpenAdmin,
  activeCustomer,
  onOpenMemberClub,
  unreadNotifCount = 0,
  onOpenNotifications,
  isPreview = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoSizeClass =
    website.logoSize === 'sm'
      ? 'h-8 w-8'
      : website.logoSize === 'lg'
        ? 'h-12 w-12'
        : 'h-10 w-10';

  const renderActionItem = (key: HeaderNavKey) => {
    if (key === 'tracking' && website.showTracking) {
      return (
        <button
          key="tracking"
          type="button"
          onClick={onOpenTracking}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[#F6EFE4] whitespace-nowrap shrink-0"
          style={{ color: website.headerTextColor }}
        >
          <PackageSearch className="h-4 w-4" style={{ color: website.accentColor }} />
          <span>{website.trackingLabel}</span>
        </button>
      );
    }
    if (key === 'cart' && website.showCart) {
      return (
        <button
          key="cart"
          type="button"
          onClick={onOpenCart}
          className="relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          style={{
            backgroundColor: website.buttonBgColor,
            color: website.buttonTextColor,
          }}
        >
          <ShoppingBag className="h-4 w-4" style={{ color: website.accentColor }} />
          <span className="hidden sm:inline">{website.cartLabel}</span>
          <span
            className="inline-flex min-w-[20px] items-center justify-center rounded-lg px-1.5 py-0.5 text-xs font-bold tabular-nums"
            style={{
              backgroundColor: website.accentColor,
              color: '#2C1810',
            }}
          >
            {cartCount}
          </span>
        </button>
      );
    }
    if (key === 'admin' && website.showAdminButton) {
      return (
        <button
          key="admin"
          type="button"
          onClick={onOpenAdmin}
          className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm font-medium transition-colors hover:opacity-90 whitespace-nowrap shrink-0"
          style={{ color: website.headerTextColor }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: website.accentColor }} />
          <span>{website.adminButtonLabel}</span>
        </button>
      );
    }
    return null;
  };

  return (
    <header
      className={`${isPreview ? 'relative' : 'sticky top-0'} z-40 border-b border-[#E6D8C5] backdrop-blur-md`}
      style={{
        backgroundColor: website.headerBgColor,
        color: website.headerTextColor,
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:gap-6">
        {/* Left: Brand Logo & Title */}
        <a
          href="#top"
          onClick={(e) => {
            if (isPreview) e.preventDefault();
          }}
          className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89D54]"
        >
          <div
            className={`${logoSizeClass} shrink-0 overflow-hidden rounded-xl border border-[#E6D8C5] bg-[#FBF6EE]`}
          >
            <ResilientImage
              src={website.logoUrl}
              alt={website.brandName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <span
              className="block truncate text-lg font-bold tracking-tight"
              style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
            >
              {website.brandName}
            </span>
            {website.tagline && (
              <span className="block truncate text-[11px] opacity-75">{website.tagline}</span>
            )}
          </div>
        </a>

        {/* Center: Search Bar (Desktop) */}
        {website.showSearch && (
          <div className="hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={website.searchPlaceholder}
                className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2.5 pl-10 pr-4 text-sm text-[#2C1810] placeholder:text-[#8C7362] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Right: Ordered Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isPreview && <PWAInstallButton className="hidden md:inline-flex" />}
          {!isPreview && activeCustomer && onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative inline-flex items-center justify-center rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] p-2 text-[#8E2E49] transition-colors hover:bg-[#FCE7EE]"
              aria-label="Buka notifikasi"
              title="Notifikasi Akun"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#8E2E49] px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
          )}
          {!isPreview && onOpenMemberClub && (
            <button
              type="button"
              onClick={onOpenMemberClub}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3.5 py-2 text-sm font-semibold text-[#8E2E49] transition-colors hover:bg-[#FCE7EE] whitespace-nowrap shrink-0"
            >
              <Crown className="h-4 w-4 text-[#8E2E49]" />
              <span>
                {activeCustomer ? `Club (${activeCustomer.points} Poin)` : 'Customer Club'}
              </span>
            </button>
          )}
          {website.navOrder.map((key) => renderActionItem(key))}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] p-2 text-[#3B2316] lg:hidden"
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-[#E6D8C5] bg-[#FFFDF9] px-4 py-3 lg:hidden">
          {website.showSearch && (
            <div className="mb-3 md:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={website.searchPlaceholder}
                  className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2.5 pl-10 pr-4 text-sm text-[#2C1810]"
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!isPreview && <PWAInstallButton className="flex-1 justify-center py-2.5" />}
            {!isPreview && onOpenMemberClub && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenMemberClub();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#EAB8C6] bg-[#FDF2F5] px-3 py-2.5 text-sm font-semibold text-[#8E2E49] whitespace-nowrap"
              >
                <Crown className="h-4 w-4" />
                <span>{activeCustomer ? 'Dashboard Club' : 'Customer Club'}</span>
              </button>
            )}
            {website.showTracking && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenTracking();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2.5 text-sm font-medium text-[#3B2316] whitespace-nowrap"
              >
                <PackageSearch className="h-4 w-4 text-[#9E7840]" />
                <span>{website.trackingLabel}</span>
              </button>
            )}
            {website.showAdminButton && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2.5 text-sm font-medium text-[#3B2316] whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4 text-[#9E7840]" />
                <span>{website.adminButtonLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
