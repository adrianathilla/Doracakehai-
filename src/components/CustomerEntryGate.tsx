import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { CustomerAccount } from '../types';
import {
  buildCustomerRegistrationWaLink,
  buildForgotPasswordWaLink,
} from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface CustomerEntryGateProps {
  logoUrl: string;
  referralNotice?: string | null;
  forcedChangeCustomer?: CustomerAccount | null;
  onLoginSubmit: (
    username: string,
    password: string,
  ) => Promise<{ ok: true; customer: CustomerAccount } | { ok: false; error: string }>;
  onCompleteFirstPasswordChange: (
    customerId: string,
    newPassword: string,
  ) => Promise<{ ok: true; customer: CustomerAccount } | { ok: false; error: string }>;
  onContinueAsGuest: () => void;
  onOpenAdminLogin: () => void;
}

type EntrySubView = 'welcome' | 'login' | 'forgot' | 'force_password_change';

export const CustomerEntryGate: React.FC<CustomerEntryGateProps> = ({
  logoUrl,
  referralNotice,
  forcedChangeCustomer = null,
  onLoginSubmit,
  onCompleteFirstPasswordChange,
  onContinueAsGuest,
  onOpenAdminLogin,
}) => {
  const [subView, setSubView] = useState<EntrySubView>('welcome');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forced password change state
  const [pendingCustomer, setPendingCustomer] = useState<CustomerAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (forcedChangeCustomer?.mustChangePassword) {
      setPendingCustomer(forcedChangeCustomer);
      setSubView('force_password_change');
    }
  }, [forcedChangeCustomer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onLoginSubmit(username, password);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      if (res.customer.mustChangePassword) {
        setPendingCustomer(res.customer);
        setNewPassword('');
        setConfirmNewPassword('');
        setSubView('force_password_change');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFirstPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!pendingCustomer) return;
    if (newPassword.trim().length < 6) {
      setErrorMsg('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onCompleteFirstPasswordChange(pendingCustomer.id, newPassword);
      if (!res.ok) {
        setErrorMsg(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F6EFE4] text-[#2C1810]">
      {/* Live Club Header Strip */}
      <div className="border-b border-[#F2CFD8] bg-[#FDF2F5] px-4 py-2 text-xs text-[#6B2137]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#8E2E49]">
            <Sparkles className="h-3.5 w-3.5 text-[#D46282]" />
            <span>DoraCake Bakery &amp; Pastry · Customer Club</span>
          </span>
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B2316] px-3 py-1 text-[11px] font-semibold text-[#FBF6EE] hover:bg-[#4F3020] whitespace-nowrap"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#E7CFA2]" />
            <span>Portal Admin</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl">
          {referralNotice && (
            <div className="mb-5 rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] px-4 py-3 text-center text-xs font-medium text-[#8E2E49]">
              {referralNotice}
            </div>
          )}

          {subView === 'welcome' && (
            <div className="grid overflow-hidden rounded-3xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-lg lg:grid-cols-12">
              {/* Left Brand Story Panel */}
              <div className="flex flex-col justify-between bg-[#FBF6EE] p-7 sm:p-10 lg:col-span-5 lg:border-r lg:border-[#E6D8C5]">
                <div>
                  <div className="flex items-center gap-3.5">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
                      <ResilientImage
                        src={logoUrl}
                        alt="DoraCake"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h1 className="font-serif-display text-2xl font-bold text-[#2C1810]">
                        DoraCake
                      </h1>
                      <p className="text-xs font-medium text-[#8E2E49]">Customer Club</p>
                    </div>
                  </div>

                  <h2 className="font-serif-display mt-8 text-3xl font-bold leading-tight text-[#2C1810] text-balance">
                    Welcome, Cakeers!
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#5C4435]">
                    Belanja lebih menyenangkan dengan DoraCake Customer Club.
                  </p>
                </div>

                <div className="mt-8 space-y-2.5 border-t border-[#E6D8C5] pt-6 text-xs text-[#5C4435]">
                  <p className="font-semibold text-[#2C1810]">Keuntungan Cakeers Member:</p>
                  <p>· Kumpulkan DoraCake Points dari setiap belanja homemade cake</p>
                  <p>· Digital Stamp Card berhadiah produk gratis &amp; diskon spesial</p>
                  <p>· Voucher member, ajak teman referral &amp; lacak pesanan mudah</p>
                </div>
              </div>

              {/* Right 3-Option Entry Gate */}
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:col-span-7">
                <p className="text-xs font-semibold tracking-wider text-[#8E2E49] uppercase">
                  Pilih Akses Masuk
                </p>
                <p className="mt-1 text-sm text-[#5C4435]">
                  Masuk sebagai member Customer Club atau lanjutkan belanja sebagai tamu.
                </p>

                <div className="mt-6 space-y-3.5">
                  {/* Option 1: LOGIN PELANGGAN */}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSubView('login');
                    }}
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-[#3B2316] px-5 py-4 text-left text-[#FBF6EE] shadow-sm transition-colors hover:bg-[#4F3020]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBF6EE]/10 text-[#F4B8C6]">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-sm font-bold tracking-wide">
                          LOGIN PELANGGAN
                        </span>
                        <span className="mt-0.5 block text-xs text-[#E7D8C9]">
                          Masuk menggunakan username &amp; password member
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Option 2: DAFTAR AKUN (WhatsApp Admin) */}
                  <a
                    href={buildCustomerRegistrationWaLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-[#EAB8C6] bg-[#FDF2F5] px-5 py-4 text-left text-[#2C1810] transition-colors hover:bg-[#FCE6EC]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#EAB8C6] bg-[#FFFDF9] text-[#8E2E49]">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-sm font-bold tracking-wide text-[#8E2E49]">
                          DAFTAR AKUN
                        </span>
                        <span className="mt-0.5 block text-xs text-[#6B2137]">
                          Hubungi Admin via WhatsApp (+62 857-7368-0571) untuk aktivasi akun
                        </span>
                      </div>
                    </div>
                    <MessageCircle className="h-4 w-4 shrink-0 text-[#8E2E49]" />
                  </a>

                  {/* Option 3: LANJUTKAN SEBAGAI TAMU */}
                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] px-5 py-4 text-left text-[#2C1810] transition-colors hover:border-[#C89D54] hover:bg-[#F6EFE4]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316]">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block text-sm font-bold tracking-wide">
                          LANJUTKAN SEBAGAI TAMU
                        </span>
                        <span className="mt-0.5 block text-xs text-[#5C4435]">
                          Lihat katalog produk &amp; pesan langsung tanpa login
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                <p className="mt-5 text-[11px] leading-relaxed text-[#6E5849]">
                  Pendaftaran akun dilakukan oleh Admin toko untuk menjaga keakuratan data member, poin, dan stempel.
                </p>
              </div>
            </div>
          )}

          {subView === 'login' && (
            <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-lg">
              <div className="border-b border-[#E6D8C5] bg-[#FBF6EE] px-6 py-5">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSubView('welcome');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C4435] hover:text-[#2C1810]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Halaman Utama</span>
                </button>
                <h2 className="font-serif-display mt-3 text-2xl font-bold text-[#2C1810]">
                  Login Pelanggan
                </h2>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Masuk ke DoraCake Customer Club dengan akun yang dibuat Admin.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 p-6">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">Username</label>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username Anda"
                      className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2.5 pl-10 pr-4 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#3B2316]">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setForgotIdentifier(username);
                        setSubView('forgot');
                      }}
                      className="text-xs font-semibold text-[#8E2E49] hover:underline"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2.5 pl-10 pr-10 text-sm text-[#2C1810] focus:border-[#C89D54] focus:bg-[#FFFDF9] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7362] hover:text-[#2C1810]"
                      aria-label="Tampilkan atau sembunyikan password"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#3B2316] px-5 py-3 text-sm font-semibold text-[#FBF6EE] transition-colors hover:bg-[#4F3020] disabled:opacity-60"
                >
                  {submitting ? 'Memverifikasi...' : 'Masuk ke Customer Club'}
                </button>
              </form>
            </div>
          )}

          {subView === 'forgot' && (
            <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-lg">
              <div className="border-b border-[#E6D8C5] bg-[#FBF6EE] px-6 py-5">
                <button
                  type="button"
                  onClick={() => setSubView('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C4435] hover:text-[#2C1810]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Login</span>
                </button>
                <h2 className="font-serif-display mt-3 text-2xl font-bold text-[#2C1810]">
                  Lupa Password
                </h2>
                <p className="mt-1 text-xs text-[#5C4435]">
                  Bantuan pemulihan akun dilakukan oleh Admin DoraCake demi menjaga keamanan saldo poin dan stempel Anda.
                </p>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Username atau Nomor HP Anda
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="Masukkan username atau nomor HP terdaftar"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                </div>

                <div className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] p-3.5 text-xs leading-relaxed text-[#5C4435]">
                  <p className="font-semibold text-[#2C1810]">Alur Pemulihan Password:</p>
                  <p className="mt-1">
                    1. Hubungi Admin WhatsApp (+62 857-7368-0571) dengan pesan otomatis.
                    <br />
                    2. Admin memverifikasi akun Anda via Username, No. HP, atau ID Pelanggan.
                    <br />
                    3. Admin mengirimkan tautan reset ke email akun atau mereset akses akun Anda.
                  </p>
                </div>

                <a
                  href={buildForgotPasswordWaLink(forgotIdentifier)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B2316] px-5 py-3 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020]"
                >
                  <MessageCircle className="h-4 w-4 text-[#E7CFA2]" />
                  <span>Hubungi Admin WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          {subView === 'force_password_change' && pendingCustomer && (
            <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-lg">
              <div className="border-b border-[#E6D8C5] bg-[#FDF2F5] px-6 py-5">
                <div className="flex items-center gap-2 text-[#8E2E49]">
                  <KeyRound className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Wajib Ganti Password Pertama Kali
                  </span>
                </div>
                <h2 className="font-serif-display mt-2 text-xl font-bold text-[#2C1810]">
                  Halo, {pendingCustomer.name}!
                </h2>
                <p className="mt-1 text-xs text-[#6B2137]">
                  Demi keamanan akun ({pendingCustomer.id}), silakan ganti password sementara Anda dengan password pribadi yang baru sebelum masuk ke dashboard.
                </p>
              </div>

              <form onSubmit={handleFirstPasswordSubmit} className="space-y-4 p-6">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Password Baru (Min. 6 karakter) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3B2316]">
                    Konfirmasi Password Baru *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2.5 text-sm text-[#2C1810]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#3B2316] px-5 py-3 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Password & Masuk Dashboard'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
