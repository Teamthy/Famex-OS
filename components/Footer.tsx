"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUp, Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";
import { useSchoolProfile } from "@/components/SchoolProfileContext";

const linkGroups = {
  School: [
    { label: "About", href: "/about" },

    { label: "Academics", href: "/academics" },
    { label: "Campus Life", href: "/campus-life" },
  ],
  Community: [
    { label: "Alumni", href: "/alumni" },
    { label: "Testimonials", href: "/testimonials" },
    { label: "News & Events", href: "/news-events" },
    { label: "Gallery", href: "/gallery" },
  ],
  "Get Started": [
    { label: "Admissions", href: "/admissions" },
    { label: "Portal", href: "/portal" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  Resources: [
    { label: "FAQ", href: "/faq" },
    { label: "What's New", href: "/whats-new" },
    { label: "Privacy Policy", href: "/privacy-policy" },
  ],
};

// AUD-F5 / W1: the footer must never show one school's contact details as a
// fallback for another's. Every field comes from the caller's `contact` prop or
// the resolved School profile (F0-21). An empty value HIDES the row rather than
// inventing a phone number or email the school never published.
export type FooterContact = {
  address?: string;
  phone?: string;
  /** tel: href — defaults to the display phone. */
  phoneHref?: string;
  email?: string;
};

export default function Footer({ contact = {} }: { contact?: FooterContact }) {
  // Brand tokens from the resolved School profile — no school-name literals here.
  const profile = useSchoolProfile();
  const schoolName = profile.name || "School";
  const address = contact.address ?? profile.address ?? "";
  const phone = contact.phone ?? profile.phone ?? "";
  const phoneHref = contact.phoneHref ?? phone;
  const email = contact.email ?? profile.email ?? "";
  return (
    <footer className="w-full bg-[var(--footer-bg)] border-t border-[var(--footer-border)] pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt={`${schoolName} logo`}
                  width={60}
                  height={60}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-2xl tracking-[3px] text-white uppercase truncate">
                  {schoolName}
                </h2>
              </div>
            </div>
            <p className="text-sm text-[var(--footer-text-body)] leading-relaxed mb-6">
              A NERDC-aligned day secondary school raising future leaders through excellence in
              education.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                aria-label={`${schoolName} on Facebook`}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand-green text-brand-navy-dark flex items-center justify-center transition-colors"
              >
                <Facebook size={16} aria-hidden="true" />
              </a>
              <a
                href="#"
                aria-label={`${schoolName} on Instagram`}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand-green text-brand-navy-dark flex items-center justify-center transition-colors"
              >
                <Instagram size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          {Object.entries(linkGroups).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-display text-sm text-white mb-4 tracking-widest">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--footer-text-body)] hover:text-brand-green transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 py-8 border-t border-[var(--footer-border)]">
          {address ? (
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-brand-green shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Address</div>
                <div className="text-sm text-white/80">{address}</div>
              </div>
            </div>
          ) : null}
          {phone ? (
            <div className="flex items-start gap-3">
              <Phone size={18} className="text-brand-green shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Phone</div>
                <a
                  href={`tel:${phoneHref}`}
                  className="text-sm text-white/80 hover:text-brand-green"
                >
                  {phone}
                </a>
              </div>
            </div>
          ) : null}
          {email ? (
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-brand-green shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Email</div>
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-white/80 hover:text-brand-green"
                >
                  {email}
                </a>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--footer-border)]">
          <p className="text-xs text-[var(--footer-text-body)]">
            © {new Date().getFullYear()} {schoolName}. All rights reserved.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/70 hover:text-brand-green transition-colors"
          >
            Back to Top <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}
