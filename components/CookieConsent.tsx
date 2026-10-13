"use client";

import { useState, useEffect } from "react";
import { Cookie, Check } from "lucide-react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [, setAccepted] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("ykay_cookie_consent");
    if (!consent) {
      setTimeout(() => setVisible(true), 1000);
    } else {
      setAccepted(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("ykay_cookie_consent", "accepted");
    setAccepted(true);
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("ykay_cookie_consent", "rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F1F2E] border-t border-white/10 p-6 md:p-8 shadow-2xl shadow-black/40">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-ykay-green/10 flex items-center justify-center text-ykay-green shrink-0">
            <Cookie size={22} strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-display text-base tracking-[2px] text-white mb-1">
              Cookie Preferences
            </h3>
            <p className="font-body text-xs text-white/60 leading-relaxed max-w-xl">
              We use cookies to enhance your experience, remember preferences, and analyze site
              traffic. Essential cookies are always active. You can manage analytics and preference
              cookies below.
            </p>
            <div className="flex gap-4 mt-3">
              {["Essential", "Analytics", "Preferences"].map((label) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${label === "Essential" ? "bg-ykay-green/15 text-ykay-green" : "bg-white/5 text-white/20"}`}
                >
                  {label === "Essential" ? (
                    <Check size={8} strokeWidth={3} />
                  ) : (
                    <Cookie size={8} strokeWidth={2} />
                  )}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleReject}
            className="rounded-full px-5 py-2.5 bg-white/[0.05] border border-white/10 text-white/70 font-body text-xs font-bold hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Reject Optional
          </button>
          <button
            onClick={handleAccept}
            className="rounded-full px-6 py-2.5 bg-ykay-green text-white font-body text-xs font-bold hover:bg-ykay-green-dark transition-all shadow-lg shadow-ykay-green-20"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
