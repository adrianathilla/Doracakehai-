import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { AdminUserPublic } from '../../types';
import { signInAdminWithGoogle } from '../../services/firebaseService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (admin: AdminUserPublic) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const admin = await signInAdminWithGoogle();
      onAuthenticated(admin);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('Login Google dibatalkan. Silakan coba lagi.');
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          'Domain website ini belum ditambahkan ke Authorized Domains di Firebase Console (Authentication -> Settings).',
        );
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Gagal masuk dengan akun Google Admin.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1810]/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
        <div className="flex items-center justify-between bg-[#2C1810] px-6 py-4 text-[#FBF6EE]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#E7CFA2]" />
            <h2 className="font-serif-display text-lg font-bold">Portal Admin DoraCake</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#D7C5B4] hover:bg-[#3B2316] hover:text-white"
            aria-label="Tutup portal login"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-4 text-xs leading-relaxed text-[#5C4435]">
            <p className="font-semibold text-[#2C1810]">Autentikasi Pengelola &amp; SuperAdmin</p>
            <p className="mt-1">
              Masuk menggunakan akun Google terdaftar untuk mengelola katalog produk, pesanan, pelanggan Customer Club, dan Editor Website.
            </p>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#3B2316] px-5 py-3.5 text-sm font-semibold text-[#FBF6EE] shadow-sm transition-colors hover:bg-[#4F3020] disabled:opacity-60"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.1 0 10 0 12s.6 3.9 1.6 5.6l3.7-2.8z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
              />
            </svg>
            <span>{loading ? 'Menghubungkan ke Google...' : 'Masuk dengan Google Admin'}</span>
          </button>

          <p className="text-center text-[11px] leading-relaxed text-[#6E5849]">
            Hanya akun email Owner utama atau Admin yang telah diundang di menu Manajemen Admin yang dapat mengakses dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};
