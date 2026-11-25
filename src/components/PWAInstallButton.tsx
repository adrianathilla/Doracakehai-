import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { canNativeInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canNativeInstall) {
      const ok = await promptInstall();
      if (ok) return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-[#C89D54]/50 bg-[#FFFDF9] px-4 py-3 text-left transition-colors hover:bg-[#FBF6EE] ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2C1810] text-[#E7CFA2]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2C1810]">
                Install Aplikasi DoraCake di HP
              </p>
              <p className="mt-0.5 text-[11px] text-[#5C4435]">
                Pasang ke layar utama agar cepat dibuka &amp; mudah pantau notifikasi
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#8E2E49] px-3 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap">
            <Download className="h-3.5 w-3.5" />
            <span>Install</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-[#C89D54] bg-[#FFFDF9] px-3 py-1.5 text-xs font-semibold text-[#3B2316] transition-colors hover:bg-[#FBF6EE] whitespace-nowrap shrink-0 ${className}`}
          title="Pasang Aplikasi DoraCake di Layar Utama HP"
        >
          <Download className="h-3.5 w-3.5 text-[#8E2E49]" />
          <span>Install App</span>
        </button>
      )}

      {guideOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2C1810]/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2C1810] text-[#E7CFA2]">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                    Pasang Aplikasi DoraCake
                  </h3>
                  <p className="text-xs text-[#6E5849]">Tampil seperti aplikasi native di HP Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-lg p-1.5 text-[#6E5849] hover:bg-[#F6EFE4]"
                aria-label="Tutup panduan install"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs leading-relaxed text-[#3B2316]">
              {isIOS ? (
                <>
                  <p className="font-bold text-[#8E2E49]">Untuk iPhone / iPad (Safari):</p>
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>
                      Ketuk tombol <strong>Bagikan (Share)</strong> di bagian bawah browser Safari.
                    </li>
                    <li>
                      Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-bold text-[#8E2E49]">Untuk Android (Google Chrome):</p>
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>
                      Ketuk ikon menu <strong>titik tiga (⋮)</strong> di pojok kanan atas Chrome.
                    </li>
                    <li>
                      Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Install aplikasi</strong>.
                    </li>
                    <li>
                      Konfirmasi <strong>Install</strong> — ikon DoraCake akan muncul di menu aplikasi HP Anda.
                    </li>
                  </ol>
                </>
              )}
              <p className="border-t border-[#E6D8C5] pt-2 text-[11px] text-[#6E5849]">
                Setelah terpasang, aktifkan izin Notifikasi pada ikon lonceng agar kabar pesanan dan promo langsung muncul di HP.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-4 w-full rounded-xl bg-[#3B2316] px-4 py-2.5 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
