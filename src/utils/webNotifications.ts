import { registerSW } from 'virtual:pwa-register';

let swInitialized = false;

export function initPWAServiceWorker(): void {
  if (swInitialized || typeof window === 'undefined') return;
  swInitialized = true;
  try {
    registerSW({
      immediate: true,
    });
  } catch {
    // Abaikan jika lingkungan preview menonaktifkan service worker
  }
}

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function showDeviceNotification(payload: {
  title: string;
  body: string;
  tag?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || `doracake-${Date.now()}`,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(payload.title, options);
        return;
      }
    }
    new Notification(payload.title, options);
  } catch {
    // Non-fatal fallback
  }
}
