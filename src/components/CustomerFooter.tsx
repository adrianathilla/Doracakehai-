import React from 'react';
import { Clock, MapPin, Phone } from 'lucide-react';
import { StoreSettings, WebsiteContentConfig } from '../types';
import { buildWhatsAppLink } from '../utils/format';

interface CustomerFooterProps {
  website: WebsiteContentConfig;
  settings: StoreSettings;
  onOpenTracking: () => void;
  onOpenAdmin: () => void;
}

export const CustomerFooter: React.FC<CustomerFooterProps> = ({
  website,
  settings,
  onOpenTracking,
  onOpenAdmin,
}) => {
  const waConfirmLink = buildWhatsAppLink(
    website.footerWhatsapp || settings.whatsappNumber,
    `Halo Admin ${website.footerStoreName}, saya ingin mengonfirmasi pembayaran pesanan saya.`,
  );

  const hasSocials =
    Boolean(website.socialLinks.instagram) ||
    Boolean(website.socialLinks.tiktok) ||
    Boolean(website.socialLinks.facebook);

  return (
    <footer className="bg-[#2C1810] text-[#F2E7D6]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Column 1: Store Identity */}
          <div>
            <h3
              className="text-xl font-bold text-[#FFFDF9]"
              style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
            >
              {website.footerStoreName}
            </h3>
            <div className="mt-4 space-y-2.5 text-sm text-[#D7C5B4]">
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
                <span>{website.footerAddress}</span>
              </p>
              <p className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
                <span>{website.footerHours}</span>
              </p>
              <p className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: website.accentColor }} />
                <span>WhatsApp: {website.footerWhatsapp}</span>
              </p>
            </div>

            {hasSocials && (
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-[#E7CFA2]">
                {website.socialLinks.instagram && (
                  <a
                    href={website.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Instagram
                  </a>
                )}
                {website.socialLinks.tiktok && (
                  <a
                    href={website.socialLinks.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    TikTok
                  </a>
                )}
                {website.socialLinks.facebook && (
                  <a
                    href={website.socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Column 2: Layanan Pelanggan */}
          <div>
            <h4
              className="text-base font-bold text-[#FFFDF9]"
              style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
            >
              {website.footerServiceTitle}
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-[#D7C5B4]">
              <li>
                <button
                  type="button"
                  onClick={onOpenTracking}
                  className="text-left transition-colors hover:text-[#E7CFA2] hover:underline"
                >
                  Lacak Status Pesanan
                </button>
              </li>
              <li>
                <a
                  href={waConfirmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[#E7CFA2] hover:underline"
                >
                  Konfirmasi Pembayaran via WhatsApp
                </a>
              </li>
              {website.showAdminButton && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="text-left transition-colors hover:text-[#E7CFA2] hover:underline"
                  >
                    Dashboard Pengelola (Admin)
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Metode Pembayaran */}
          <div>
            <h4
              className="text-base font-bold text-[#FFFDF9]"
              style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
            >
              {website.footerPaymentTitle}
            </h4>
            <p className="mt-4 text-sm leading-relaxed text-[#D7C5B4]">
              {website.footerPaymentText}
            </p>
            <p className="mt-3 text-xs text-[#A8927E]">{settings.cancellationPolicy}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-[#FBF6EE]/10 pt-6 text-center text-xs text-[#A8927E]">
          {website.footerCopyright}
        </div>
      </div>
    </footer>
  );
};
