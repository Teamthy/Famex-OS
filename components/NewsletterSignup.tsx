"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "./Toast";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    toast("Subscribed! Check your email for confirmation.", "success");
    setTimeout(() => {
      setEmail("");
      setSubscribed(false);
    }, 4000);
  };

  return (
    <div className="rounded-[2.5rem] bg-gradient-to-br from-brand-navy to-brand-navy-light p-10 text-white text-center">
      <Mail className="mx-auto text-brand-green mb-4" size={32} />
      <h3 className="font-display text-3xl mb-3">
        STAY <span className="text-brand-green">CONNECTED</span>
      </h3>
      <p className="text-white/60 mb-6 max-w-md mx-auto text-sm">
        Get admission updates, school news, and academic tips delivered to your inbox monthly.
      </p>
      {!subscribed ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-brand-green"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-full bg-brand-orange hover:bg-brand-orange-dark text-brand-navy font-bold text-sm uppercase tracking-widest shadow-lg"
          >
            Subscribe
          </button>
        </form>
      ) : (
        <div className="inline-flex items-center gap-2 text-brand-green">
          <CheckCircle2 size={20} /> You're subscribed!
        </div>
      )}
    </div>
  );
}
