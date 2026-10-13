"use client";

import { MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function WhatsAppFloat() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const message = encodeURIComponent(
    "Hello Ykay College, I'd like to learn more about admissions.",
  );

  return (
    <a
      href={`https://wa.me/2347015374411?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-40 group"
      aria-label="Chat on WhatsApp"
    >
      <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
      <div className="relative w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110">
        <MessageCircle size={26} strokeWidth={2} />
      </div>
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-4 py-2 rounded-xl bg-brand-navy text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Chat with us
      </div>
    </a>
  );
}
