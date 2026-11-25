import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  Gift,
  Info,
  Package,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types';
import { formatDateTimeId } from '../utils/format';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/webNotifications';

interface NotificationBellModalProps {
  isOpen: boolean;
  title?: string;
  notifications: Array<AppNotification & { effectiveRead: boolean }>;
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (notif: AppNotification) => void;
  onMarkAllRead: () => void;
}

function getCategoryStyle(category: NotificationCategory) {
  switch (category) {
    case 'Promo':
      return {
        bg: 'bg-[#FDF2F5] text-[#8E2E49] border-[#EAB8C6]',
        icon: <Tag className="h-3.5 w-3.5" />,
      };
    case 'Pesanan':
      return {
        bg: 'bg-sky-50 text-sky-800 border-sky-200',
        icon: <Package className="h-3.5 w-3.5" />,
      };
    case 'Hadiah':
      return {
        bg: 'bg-amber-50 text-amber-900 border-amber-200',
        icon: <Gift className="h-3.5 w-3.5" />,
      };
    default:
      return {
        bg: 'bg-[#FBF6EE] text-[#3B2316] border-[#E6D8C5]',
        icon: <Info className="h-3.5 w-3.5" />,
      };
  }
}

export const NotificationBellModal: React.FC<NotificationBellModalProps> = ({
  isOpen,
  title = 'Pusat Notifikasi',
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [perm, setPerm] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission(),
  );

  useEffect(() => {
    if (isOpen) {
      setPerm(getBrowserNotificationPermission());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnableDeviceNotif = async () => {
    const next = await requestBrowserNotificationPermission();
    setPerm(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#2C1810]/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#E6D8C5] bg-[#FFFDF9] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6D8C5] bg-[#FBF6EE] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B2316] text-[#F4B8C6]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif-display text-lg font-bold text-[#2C1810]">{title}</h2>
              <p className="text-[11px] text-[#6E5849]">
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1.5 text-[11px] font-semibold text-[#3B2316] hover:bg-[#FDF2F5]"
              >
                <CheckCheck className="h-3.5 w-3.5 text-[#8E2E49]" />
                <span>Tandai Dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#6E5849] hover:bg-[#EFE5D6]"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Device / APK Notification Permission Strip */}
        <div className="border-b border-[#F0E4D2] bg-[#FDF2F5] px-5 py-3 text-xs">
          {perm === 'granted' ? (
            <div className="flex items-center gap-2 text-emerald-800">
              <BellRing className="h-4 w-4 shrink-0" />
              <span className="font-medium">
                Notifikasi perangkat aktif — info pesanan &amp; promo muncul langsung di HP/browser.
              </span>
            </div>
          ) : perm === 'denied' ? (
            <div className="text-[#6B2137]">
              Izin notifikasi browser diblokir. Aktifkan lewat pengaturan situs browser HP Anda agar notifikasi pop-up bisa muncul.
            </div>
          ) : perm === 'default' ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#6B2137]">
                Aktifkan pop-up notifikasi di HP agar update pesanan &amp; promo tidak terlewat.
              </span>
              <button
                type="button"
                onClick={handleEnableDeviceNotif}
                className="shrink-0 rounded-lg bg-[#8E2E49] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#75233A] whitespace-nowrap"
              >
                Aktifkan
              </button>
            </div>
          ) : (
            <div className="text-[#6E5849]">
              Notifikasi real-time tersedia langsung di panel ini setiap kali ada pembaruan.
            </div>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-[#E6D8C5] bg-[#FBF6EE] p-8 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-[#C89D54]" />
              <p className="mt-2 text-sm font-bold text-[#2C1810]">Belum Ada Notifikasi</p>
              <p className="mt-1 text-xs text-[#6E5849]">
                Info pesanan, promo voucher, poin, stempel, dan pengumuman toko akan muncul otomatis di sini.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const cat = getCategoryStyle(notif.category);
              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.effectiveRead) onMarkRead(notif);
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                    notif.effectiveRead
                      ? 'border-[#E6D8C5] bg-[#FFFDF9]'
                      : 'border-[#EAB8C6] bg-[#FDF2F5]/75 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${cat.bg}`}
                    >
                      {cat.icon}
                      <span>{notif.category}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {notif.targetType === 'broadcast' && (
                        <span className="rounded bg-[#3B2316]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#3B2316]">
                          Broadcast
                        </span>
                      )}
                      {!notif.effectiveRead && (
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-[#8E2E49]"
                          title="Belum dibaca"
                        />
                      )}
                    </div>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-[#2C1810]">{notif.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#5C4435]">{notif.message}</p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#6E5849]">
                    <span>Dari: {notif.senderName}</span>
                    <span className="font-mono-tabular">{formatDateTimeId(notif.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
