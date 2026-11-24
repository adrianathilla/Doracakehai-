import React, { useMemo, useState } from 'react';
import { History, Info, Search, ShieldAlert } from 'lucide-react';
import {
  AuditLogEntry,
  CustomerAccount,
  FraudAlert,
  FraudStatus,
} from '../../types';
import { updateFraudAlertFirebase } from '../../services/firebaseService';
import { formatDatePartId, formatTimePartId } from '../../utils/format';

interface AdminSecurityAndAuditTabProps {
  section: 'antifraud' | 'audit';
  fraudAlerts: FraudAlert[];
  auditLogs: AuditLogEntry[];
  customers: CustomerAccount[];
  actorName: string;
}

const FRAUD_STATUSES: FraudStatus[] = [
  'Normal',
  'Perlu Ditinjau',
  'Dibatasi',
  'Dinonaktifkan',
];

export const AdminSecurityAndAuditTab: React.FC<AdminSecurityAndAuditTabProps> = ({
  section,
  fraudAlerts,
  auditLogs,
  customers,
  actorName,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredFraud = useMemo(() => {
    return fraudAlerts.filter((a) =>
      statusFilter === 'ALL' ? true : a.status === statusFilter,
    );
  }, [fraudAlerts, statusFilter]);

  const filteredLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (auditTypeFilter !== 'ALL' && l.activityType !== auditTypeFilter) return false;
      if (!q) return true;
      return (
        l.actorName.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.activityType.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditQuery, auditTypeFilter]);

  if (section === 'antifraud') {
    const handleUpdateFraudStatus = async (alert: FraudAlert, nextStatus: FraudStatus) => {
      setFeedback(null);
      setErrorMsg(null);
      try {
        const customer = customers.find((c) => c.id === alert.customerId);
        await updateFraudAlertFirebase({
          actorName,
          alert,
          nextStatus,
          customer,
        });
        setFeedback(`Status tinjauan keamanan untuk ${alert.customerName} diubah ke ${nextStatus}.`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui status anti-fraud.');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">
            Anti-Fraud Monitoring (Tinjauan Manual)
          </h2>
          <p className="mt-1 text-sm text-[#5C4435]">
            Deteksi anomali: Banyak Akun Perangkat Sama, Referral Tidak Wajar, Klaim Transaksi
            Ganda, Voucher Berulang, Login Mencurigakan, dan Percobaan Reward Tidak Wajar.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-[#C89D54]/50 bg-[#FFFDF9] p-4 text-xs text-[#3B2316]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9E7840]" />
          <div>
            <strong>Kebijakan Pemeriksaan Adil:</strong> Sistem tidak langsung memblokir akun hanya
            karena kesamaan jaringan Wi-Fi atau alamat keluarga. Catatan aktivitas di bawah membantu
            admin melakukan tinjauan manual secara objektif.
          </div>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {feedback}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(['ALL', ...FRAUD_STATUSES] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
                statusFilter === st
                  ? 'bg-[#3B2316] text-[#FBF6EE]'
                  : 'border border-[#E6D8C5] bg-[#FFFDF9] text-[#3B2316]'
              }`}
            >
              {st === 'ALL' ? 'Semua Indikasi' : st}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFraud.length === 0 ? (
            <div className="rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-10 text-center text-xs text-[#6E5849]">
              Tidak ada indikasi anomali yang tercatat pada filter status ini.
            </div>
          ) : (
            filteredFraud.map((alert) => (
              <div
                key={alert.id}
                className="space-y-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#8E2E49]">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {alert.indicator}
                      </span>
                      <span className="rounded bg-[#FBF6EE] px-2 py-0.5 text-[11px] font-semibold text-[#5C4435]">
                        Risiko: {alert.severity}
                      </span>
                    </div>
                    <h4 className="mt-1 text-base font-bold text-[#2C1810]">
                      {alert.customerName}{' '}
                      <span className="font-mono-tabular text-xs font-normal text-[#6E5849]">
                        ({alert.customerId})
                      </span>
                    </h4>
                  </div>

                  <span
                    className={`rounded-lg border px-3 py-1 text-xs font-bold ${
                      alert.status === 'Normal'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : alert.status === 'Perlu Ditinjau'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-[#3B2316]">{alert.reason}</p>
                <p className="text-[11px] text-[#6E5849]">
                  {alert.simulatedDeviceNote} · Dicatat: {formatDatePartId(alert.createdAt)} pukul{' '}
                  {formatTimePartId(alert.createdAt)} WIB
                </p>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#F0E4D2] pt-3">
                  <span className="text-[11px] font-semibold text-[#6E5849]">Tindakan Admin:</span>
                  {FRAUD_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateFraudStatus(alert, st)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        alert.status === st
                          ? 'border-[#3B2316] bg-[#3B2316] text-[#FBF6EE]'
                          : 'border-[#E6D8C5] bg-[#FBF6EE] text-[#3B2316] hover:bg-[#F2E7D6]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // section === 'audit'
  const activityTypes = Array.from(new Set(auditLogs.map((l) => l.activityType)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif-display text-2xl font-bold text-[#2C1810]">Audit Log Aktivitas</h2>
        <p className="mt-1 text-sm text-[#5C4435]">
          Rekam jejak seluruh pembuatan akun, reset password, mutasi poin/stempel, voucher,
          klaim pesanan tamu, dan perubahan pesanan di Cloud Firestore.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7362]" />
          <input
            type="search"
            value={auditQuery}
            onChange={(e) => setAuditQuery(e.target.value)}
            placeholder="Cari pelaku atau keterangan aktivitas..."
            className="w-full rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] py-2 pl-10 pr-3.5 text-sm"
          />
        </div>
        <select
          value={auditTypeFilter}
          onChange={(e) => setAuditTypeFilter(e.target.value)}
          className="rounded-xl border border-[#E6D8C5] bg-[#FBF6EE] px-3 py-2 text-sm"
        >
          <option value="ALL">Semua Jenis Aktivitas</option>
          {activityTypes.map((at) => (
            <option key={at} value={at}>
              {at}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E6D8C5] bg-[#FFFDF9] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E6D8C5] px-5 py-3.5">
          <History className="h-4 w-4 text-[#9E7840]" />
          <span className="text-xs font-bold text-[#2C1810]">
            Menampilkan {filteredLogs.length} catatan aktivitas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E6D8C5] bg-[#FBF6EE] font-semibold uppercase text-[#6E5849]">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jam</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Jenis Aktivitas</th>
                <th className="px-4 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E4D2]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6E5849]">
                    Belum ada catatan aktivitas di Audit Log.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FBF6EE]/60">
                    <td className="font-mono-tabular whitespace-nowrap px-4 py-3 text-[#5C4435]">
                      {formatDatePartId(log.createdAt)}
                    </td>
                    <td className="font-mono-tabular whitespace-nowrap px-4 py-3 text-[#5C4435]">
                      {formatTimePartId(log.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#2C1810]">
                      {log.actorName}{' '}
                      <span className="text-[10px] font-normal text-[#6E5849]">({log.actorRole})</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-md bg-[#FBF6EE] px-2 py-0.5 font-semibold text-[#8E2E49]">
                        {log.activityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#3B2316]">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
