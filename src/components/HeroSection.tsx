import React from 'react';
import { ArrowRight, Award, Clock, MessageCircle, Truck } from 'lucide-react';
import { HeroElementKey, StoreSettings, WebsiteContentConfig } from '../types';
import { buildWhatsAppLink } from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface HeroSectionProps {
  website: WebsiteContentConfig;
  settings: StoreSettings;
  onScrollToCatalog: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  website,
  settings,
  onScrollToCatalog,
}) => {
  const feedbackWaLink = buildWhatsAppLink(
    website.footerWhatsapp || settings.whatsappNumber,
    `Halo Admin ${website.brandName}, saya ingin memberikan saran, kritik, atau penilaian mengenai produk:`,
  );

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

  const renderHeroBlock = (key: HeroElementKey) => {
    if (key === 'title') {
      return (
        <h1
          key="title"
          className="mt-2 text-4xl font-bold tracking-tight text-[#FFFDF9] sm:text-5xl text-balance"
          style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
        >
          {website.heroTitle}
        </h1>
      );
    }

    if (key === 'description' && website.heroElements.showDescription) {
      return (
        <div
          key="description"
          className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-[#F2E7D6] sm:text-base whitespace-pre-line"
        >
          {website.heroDescription}
        </div>
      );
    }

    if (key === 'promoLabel' && website.heroElements.showPromoLabel && website.heroPromoLabel) {
      return (
        <p key="promoLabel" className="mt-4 text-sm font-semibold" style={{ color: website.accentColor }}>
          {website.heroPromoLabel}
        </p>
      );
    }

    if (key === 'badges' && website.heroElements.showBadges) {
      return (
        <div key="badges" className="mt-6 grid gap-3 sm:grid-cols-3">
          {website.freeShippingBadgeText && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#FBF6EE]/15 bg-[#FBF6EE]/5 px-3.5 py-2.5">
              <Truck className="h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
              <span className="text-xs font-medium text-[#FBF6EE]">
                {website.freeShippingBadgeText}
              </span>
            </div>
          )}
          {website.orderSpeedBadgeText && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#FBF6EE]/15 bg-[#FBF6EE]/5 px-3.5 py-2.5">
              <Clock className="h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
              <span className="text-xs font-medium text-[#FBF6EE]">
                {website.orderSpeedBadgeText}
              </span>
            </div>
          )}
          {website.qualityBadgeText && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#FBF6EE]/15 bg-[#FBF6EE]/5 px-3.5 py-2.5">
              <Award className="h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
              <span className="text-xs font-medium text-[#FBF6EE]">
                {website.qualityBadgeText}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (key === 'cta' && website.heroElements.showCta && website.heroCtaEnabled) {
      return (
        <div key="cta" className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onScrollToCatalog}
            className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-bold shadow-md transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{
              backgroundColor: website.accentColor,
              color: '#2C1810',
            }}
          >
            <span>{website.heroCtaText}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-xs text-[#D7C5B4]">
            Buka {settings.operationalHours} · Pickup &amp; Delivery{' '}
            {settings.pickupDeliveryStartHour}–{settings.pickupDeliveryEndHour} WIB
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden text-[#FBF6EE]"
      style={{
        backgroundColor: website.heroBgColor,
        backgroundImage: website.heroBgImageUrl
          ? `linear-gradient(rgba(44,24,16,0.82), rgba(44,24,16,0.88)), url("${website.heroBgImageUrl}")`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Optional Promotional Top Strip */}
      {website.promoBannerEnabled && website.promoBannerText && (
        <div
          className="border-b border-[#FBF6EE]/15 px-4 py-2 text-center text-xs font-medium"
          style={{ backgroundColor: website.primaryColor, color: '#FBF6EE' }}
        >
          <span>{website.promoBannerText}</span>
          {website.promoPeriodText && (
            <span className="ml-2 opacity-80">· {website.promoPeriodText}</span>
          )}
        </div>
      )}

      <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${spacingClass}`}>
        <div className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column */}
          <div
            className={`flex flex-col justify-center ${
              website.heroElements.showBannerCard ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <p
              className="text-xs font-semibold tracking-[0.14em] uppercase"
              style={{ color: website.accentColor }}
            >
              {website.brandName} · {website.footerAddress || settings.address}
            </p>
            {website.heroElementOrder.map((key) => renderHeroBlock(key))}
          </div>

          {/* Right Column: Banner & Customer Feedback Card */}
          {website.heroElements.showBannerCard && (
            <div className="lg:col-span-5">
              <div
                className={`flex h-full flex-col justify-between overflow-hidden border border-[#FBF6EE]/15 bg-[#FFFDF9] text-[#2C1810] shadow-lg ${cardRadiusClass}`}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-[#F2E7D6]">
                  <ResilientImage
                    src={website.heroImageUrl}
                    alt={website.heroCardTitle}
                    fallbackLabel={website.brandName}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                  <div>
                    {website.heroCardKicker && (
                      <p
                        className="text-xs font-semibold tracking-wider uppercase"
                        style={{ color: website.accentColor }}
                      >
                        {website.heroCardKicker}
                      </p>
                    )}
                    <h2
                      className="mt-1.5 text-lg font-bold leading-snug text-[#2C1810]"
                      style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
                    >
                      {website.heroCardTitle}
                    </h2>
                    {website.heroCardSubtitle && (
                      <p className="mt-2 text-xs leading-relaxed text-[#5C4435]">
                        {website.heroCardSubtitle}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#E6D8C5] pt-4">
                    <span className="text-xs font-medium text-[#6E5849]">
                      WhatsApp {website.footerWhatsapp || settings.whatsappNumber}
                    </span>
                    <a
                      href={feedbackWaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: website.buttonBgColor,
                        color: website.buttonTextColor,
                      }}
                    >
                      <MessageCircle
                        className="h-3.5 w-3.5"
                        style={{ color: website.accentColor }}
                      />
                      <span>{website.heroCardCtaText || 'Kirim Masukan'}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
