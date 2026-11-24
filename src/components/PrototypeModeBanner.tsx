import React from 'react';
import { ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { CustomerAccount } from '../types';

interface PrototypeModeBannerProps {
  mode: 'entry' | 'guest' | 'customer' | 'admin';
  activeCustomer: CustomerAccount | null;
  onOpenEntry: () => void;
  onOpenCustomerDashboard?: () => void;
  onOpenAdminLogin?: () => void;
}

export const PrototypeModeBanner: React.FC<PrototypeModeBannerProps> = ({
  mode,
  activeCustomer,
  onOpenEntry,
  onOpenCustomerDashboard,
  onOpenAdminLogin,
}) => {
  return (
    <div className="border-b border-[#F2CFD8] bg-[#FDF2F5] px-3 py-2 text-xs text-[#6B2137] no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAB8C6] bg-[#FFFDF9] px-2.5 py-0.5 font-semibold tracking-wide text-[#8E2E49]">
            <Sparkles className="h-3.5 w-3.5 text-[#D46282]" />
            <span>DoraCake Customer Club</span>
          </span>
          <span className="hidden text-[11px] text-[#7D4B59] sm:inline">
            Belanja homemade cake &amp; pastry segar dengan poin, stempel digital, dan voucher member.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'guest' && (
            <>
              <span className="text-[11px] font-medium text-[#7D4B59]">Mode Tamu</span>
              <button
                type="button"
                onClick={onOpenEntry}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E6D8C5] bg-[#FFFDF9] px-2.5 py-1 text-[11px] font-semibold text-[#3B2316] hover:bg-[#FBF6EE] whitespace-nowrap"
              >
                <UserCheck className="h-3 w-3 text-[#C85A79]" />
                <span>Masuk / Member Club</span>
              </button>
            </>
          )}

          {mode === 'customer' && activeCustomer && (
            <>
              <span className="text-[11px] font-medium text-[#7D4B59]">
                Member: <strong className="text-[#2C1810]">{activeCustomer.name}</strong> ({activeCustomer.id})
              </span>
              {onOpenCustomerDashboard && (
                <button
                  type="button"
                  onClick={onOpenCustomerDashboard}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#8E2E49] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#75233A] whitespace-nowrap"
                >
                  <span>Dashboard Club</span>
                </button>
              )}
            </>
          )}

          {mode !== 'admin' && onOpenAdminLogin && (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3B2316]/25 bg-[#3B2316] px-2.5 py-1 text-[11px] font-semibold text-[#FBF6EE] hover:bg-[#4F3020] whitespace-nowrap"
            >
              <ShieldCheck className="h-3 w-3 text-[#E7CFA2]" />
              <span>Portal Admin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
