import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[80] mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-950 px-4 py-2.5 text-xs font-semibold text-amber-100 shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-300" />
      <span>Anda sedang offline. Perubahan akan disinkronkan saat internet kembali.</span>
    </div>
  );
};
