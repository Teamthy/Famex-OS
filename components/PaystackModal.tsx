"use client";

import { useState } from "react";
import { X, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  amount: number;
  email: string;
  /** When provided, Pay Now redirects to Paystack hosted checkout (production). */
  authorizationUrl?: string | null;
  busy?: boolean;
  onClose: () => void;
  /** Optional legacy callback — unused when authorizationUrl is set. */
  onSuccess?: (_ref: string) => void;
  onPaystackRedirect?: () => void;
}

/**
 * Production modal: never collects card numbers.
 * Redirects the parent to Paystack hosted checkout.
 */
export default function PaystackModal({
  open,
  amount,
  email,
  authorizationUrl,
  busy,
  onClose,
  onPaystackRedirect,
}: Props) {
  const [leaving, setLeaving] = useState(false);

  const handlePay = () => {
    if (!authorizationUrl) return;
    setLeaving(true);
    onPaystackRedirect?.();
    window.location.href = authorizationUrl;
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={busy || leaving ? undefined : onClose}
        >
          <m.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-[#0ea5e9] p-6 text-brand-navy">
              {!busy && !leaving && (
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 text-brand-navy/70 hover:text-brand-navy"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              )}
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-[#0369a1]">
                  P
                </div>
                <span className="text-lg font-bold">Paystack Checkout</span>
              </div>
              <div className="text-xs text-white/70">{email}</div>
              <div className="mt-4">
                <div className="text-xs text-white/70">You are paying</div>
                <div className="font-display text-3xl">₦{amount.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-4 p-6 text-gray-800">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                <ShieldCheck className="mt-0.5 shrink-0 text-[#2b8a2b]" size={18} />
                <p>
                  Card details are entered only on Paystack&apos;s secure page. Ykay College never
                  stores or processes raw card numbers.
                </p>
              </div>

              <button
                onClick={handlePay}
                disabled={!authorizationUrl || busy || leaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0ea5e9] py-4 font-bold text-brand-navy transition-all hover:bg-[#0284c7] disabled:opacity-50"
              >
                {busy || leaving ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <ExternalLink size={18} />
                )}
                {authorizationUrl ? "Continue to Paystack" : "Preparing checkout…"}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={busy || leaving}
                className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
