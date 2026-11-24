import React from 'react';
import { WebsiteContentConfig } from '../types';
import { ResilientImage } from './ResilientImage';

interface ExtraSectionsRendererProps {
  website: WebsiteContentConfig;
}

export const ExtraSectionsRenderer: React.FC<ExtraSectionsRendererProps> = ({ website }) => {
  const activeSections = [...website.extraSections]
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (activeSections.length === 0) return null;

  const cardRadiusClass =
    website.cardRadius === 'md'
      ? 'rounded-lg'
      : website.cardRadius === 'lg'
        ? 'rounded-xl'
        : 'rounded-2xl';

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 pb-12 sm:px-6">
      {activeSections.map((sec) => {
        if (sec.type === 'testimonial') {
          return (
            <div
              key={sec.id}
              className={`border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm ${cardRadiusClass}`}
            >
              <p
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: website.accentColor }}
              >
                Testimoni Cakeers
              </p>
              <h3
                className="mt-1 text-lg font-bold"
                style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
              >
                {sec.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed opacity-85">&ldquo;{sec.content}&rdquo;</p>
              {sec.authorOrLabel && (
                <p className="mt-3 text-xs font-semibold opacity-75">— {sec.authorOrLabel}</p>
              )}
            </div>
          );
        }

        if (sec.type === 'banner' || sec.type === 'promo_image') {
          return (
            <div
              key={sec.id}
              className={`grid items-center gap-6 overflow-hidden border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm md:grid-cols-12 ${cardRadiusClass}`}
            >
              {sec.imageUrl && (
                <div className="aspect-[16/9] overflow-hidden rounded-xl bg-[#F2E7D6] md:col-span-5">
                  <ResilientImage
                    src={sec.imageUrl}
                    alt={sec.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className={sec.imageUrl ? 'md:col-span-7' : 'md:col-span-12'}>
                {sec.authorOrLabel && (
                  <p
                    className="text-xs font-semibold tracking-wider uppercase"
                    style={{ color: website.accentColor }}
                  >
                    {sec.authorOrLabel}
                  </p>
                )}
                <h3
                  className="mt-1 text-xl font-bold"
                  style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
                >
                  {sec.title}
                </h3>
                {sec.content && (
                  <p className="mt-2 text-sm leading-relaxed opacity-85 whitespace-pre-line">
                    {sec.content}
                  </p>
                )}
              </div>
            </div>
          );
        }

        return (
          <div
            key={sec.id}
            className={`border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm ${cardRadiusClass}`}
          >
            {sec.authorOrLabel && (
              <p
                className="text-xs font-semibold tracking-wider uppercase"
                style={{ color: website.accentColor }}
              >
                {sec.authorOrLabel}
              </p>
            )}
            <h3
              className="mt-1 text-lg font-bold"
              style={{ fontFamily: `'${website.fontFamily}', Georgia, serif` }}
            >
              {sec.title}
            </h3>
            {sec.content && (
              <p className="mt-2 text-sm leading-relaxed opacity-85 whitespace-pre-line">
                {sec.content}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
};
