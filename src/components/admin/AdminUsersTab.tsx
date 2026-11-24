import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, LogOut, MailPlus, Shield, Trash2 } from 'lucide-react';
import { AdminInvite, AdminRole, AdminUserPublic } from '../../types';
import {
  deleteAdminUserFirebase,
  inviteAdminFirebase,
  revokeAdminInviteFirebase,
  updateAdminUserFirebase,
  updateMyAdminProfileFirebase,
} from '../../services/firebaseService';
import { formatDateTimeId } from '../../utils/format';
import { ConfirmModal } from '../ConfirmModal';

interface AdminUsersTabProps {
  currentAdmin: AdminUserPublic;
  adminUsers: AdminUserPublic[];
  adminInvites: AdminInvite[];
  onProfileUpdated: (admin: AdminUserPublic) => void;
  onLogout: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  currentAdmin,
  adminUsers,
  adminInvites,
  onProfileUpdated,
  onLogout,
}) => {
  const [name, setName] = useState(currentAdmin.name);
  const [savingMe, setSavingMe] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('ADMIN');
  const [addingUser, setAddingUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserPublic | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminInvite | null>(null);

  useEffect(() => {
    setName(currentAdmin.name);
  }, [currentAdmin.name]);

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingMe(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await updateMyAdminProfileFirebase(currentAdmin, name.trim());
      onProfileUpdated({ ...currentAdmin, name: name.trim() });
      setStatusMsg('Nama tampilan profil admin berhasil diperbarui.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui akun.');
    } finally {
      setSavingMe(false);
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await inviteAdminFirebase({
        actor: currentAdmin,
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
        role: newAdminRole,
      });
      setStatusMsg(
        `Undangan admin untuk ${newAdminEmail.trim().toLowerCase()} berhasil disimpan. Minta admin tersebut login lewat Portal Admin menggunakan tombol "Masuk dengan Google".`,
      );
      setNewAdminName('');
      setNewAdminEmail('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menambahkan undangan admin.');
    } finally {
      setAddingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Pengaturan Admin (Google Auth)
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Autentikasi admin terhubung langsung dengan Google Sign-In &amp; aturan keamanan
            Cloud Firestore.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Keluar dari Sesi</span>
        </button>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* My Account Form */}
      <form
        onSubmit={handleSaveMyProfile}
        className="space-y-4 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">Akun Saya</h3>
          <span className="rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1 text-xs font-bold text-[#3B2316]">
            Role: {currentAdmin.role}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">Nama Tampilan</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3B2316]">
              Email Akun Google (Read-Only)
            </label>
            <input
              type="email"
              readOnly
              value={currentAdmin.email}
              className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-[#E6D8C5] bg-[#F2EAE0] px-3.5 py-2 text-sm text-[#6E5849]"
            />
          </div>
        </div>

        <p className="text-xs text-[#6E5849]">
          Keamanan kata sandi dan verifikasi login admin dikelola langsung oleh akun Google Anda
          melalui Firebase Authentication.
        </p>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingMe}
            className="rounded-xl bg-[#3B2316] px-5 py-2.5 text-sm font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
          >
            {savingMe ? 'Menyimpan...' : 'Perbarui Nama Profil'}
          </button>
        </div>
      </form>

      {/* Additional Admins (SUPERADMIN only) */}
      {currentAdmin.role === 'SUPERADMIN' && (
        <div className="space-y-6 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#9E7840]" />
              <h3 className="font-serif-display text-lg font-bold text-[#2C1810]">
                Undang &amp; Kelola Admin Tambahan
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#5C4435]">
              Masukkan alamat email Google calon admin/staf toko. Setelah diundang, calon admin
              cukup membuka <strong>Portal Admin</strong> lalu klik{' '}
              <strong>Masuk dengan Google</strong> memakai email tersebut.
            </p>
          </div>

          <form onSubmit={handleInviteAdmin} className="grid gap-3 sm:grid-cols-4">
            <input
              type="text"
              required
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="Nama staf / admin"
              className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
            />
            <input
              type="email"
              required
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Email Google (contoh: staf@gmail.com)"
              className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
            />
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
              className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
            >
              <option value="ADMIN">ADMIN (Operasional)</option>
              <option value="SUPERADMIN">SUPERADMIN (Penuh)</option>
            </select>
            <button
              type="submit"
              disabled={addingUser}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3B2316] px-4 py-2 text-xs font-semibold text-[#FBF6EE] hover:bg-[#4F3020] disabled:opacity-60"
            >
              <MailPlus className="h-4 w-4" />
              <span>{addingUser ? 'Mengundang...' : 'Undang Email Admin'}</span>
            </button>
          </form>

          {/* Pending / Registered Invites */}
          {adminInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6E5849]">
                Daftar Undangan Email Admin ({adminInvites.length})
              </p>
              <div className="divide-y divide-[#F0E4D2] rounded-xl border border-[#E6D8C5]">
                {adminInvites.map((inv) => (
                  <div
                    key={inv.email}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#2C1810]">
                        {inv.name} ·{' '}
                        <span className="rounded bg-[#FBF6EE] px-1.5 py-0.5 text-[10px] font-bold text-[#3B2316]">
                          {inv.role}
                        </span>
                      </p>
                      <p className="text-[#6E5849]">
                        {inv.email} · Diundang {formatDateTimeId(inv.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        <Clock className="h-3 w-3" />
                        <span>Siap Login Google</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(inv)}
                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                        title="Cabut undangan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Admin Accounts */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6E5849]">
              Akun Admin Aktif Terdaftar ({adminUsers.length})
            </p>
            <div className="divide-y divide-[#F0E4D2] rounded-xl border border-[#E6D8C5]">
              {adminUsers.length === 0 ? (
                <p className="px-4 py-4 text-center text-xs text-[#6E5849]">
                  Belum ada daftar admin lain.
                </p>
              ) : (
                adminUsers.map((u) => {
                  const isSelf = u.id === currentAdmin.id;
                  return (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#2C1810]">
                          {u.name} {isSelf && '(Anda)'}
                        </p>
                        <p className="text-[#6E5849]">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={async (e) => {
                            setErrorMsg(null);
                            try {
                              await updateAdminUserFirebase(currentAdmin, u, {
                                role: e.target.value as AdminRole,
                              });
                              setStatusMsg(`Role ${u.email} diperbarui.`);
                            } catch (err) {
                              setErrorMsg(
                                err instanceof Error ? err.message : 'Gagal mengubah role admin.',
                              );
                            }
                          }}
                          className="rounded-lg border border-[#E6D8C5] bg-[#FBF6EE] px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPERADMIN">SUPERADMIN</option>
                        </select>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={async () => {
                            setErrorMsg(null);
                            try {
                              await updateAdminUserFirebase(currentAdmin, u, {
                                isActive: !u.isActive,
                              });
                              setStatusMsg(`Status akses ${u.email} diperbarui.`);
                            } catch (err) {
                              setErrorMsg(
                                err instanceof Error ? err.message : 'Gagal mengubah status admin.',
                              );
                            }
                          }}
                          className={`rounded-lg border px-2.5 py-1 font-semibold disabled:opacity-40 ${
                            u.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-rose-200 bg-rose-50 text-rose-800'
                          }`}
                        >
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Akun Admin?"
        message={`Hapus akses admin untuk ${deleteTarget?.email}?`}
        confirmLabel="Ya, Hapus"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteAdminUserFirebase(currentAdmin, deleteTarget);
            setStatusMsg(`Akses admin ${deleteTarget.email} dihapus.`);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus admin.');
          } finally {
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        title="Cabut Undangan Admin?"
        message={`Email ${revokeTarget?.email} tidak akan bisa login sebagai admin jika undangan ini dihapus.`}
        confirmLabel="Ya, Cabut Undangan"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeAdminInviteFirebase(currentAdmin, revokeTarget.email);
            setStatusMsg(`Undangan untuk ${revokeTarget.email} dicabut.`);
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Gagal mencabut undangan.');
          } finally {
            setRevokeTarget(null);
          }
        }}
      />
    </div>
  );
};
