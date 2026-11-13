"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowDown, Mail, Menu, UserRound, X } from "lucide-react";

const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#story", label: "Our school" },
  { href: "#academics", label: "Learning" },
  { href: "#admissions", label: "Admissions" },
  { href: "#news", label: "Journal" },
];

/** Paper-and-forest capsule navigation that stays in flow above the hero. */
export default function HomeHeader({ schoolName }: { schoolName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="relative z-30 px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
      <div className="mx-auto flex max-w-[1480px] items-center gap-2.5 rounded-[24px] bg-[var(--home-paper)] px-3 py-2.5 text-[var(--home-dark)] shadow-[0_12px_35px_rgba(4,27,18,.12)] sm:gap-3 sm:rounded-full sm:px-5">
        <a
          href="#top"
          className="flex min-w-0 shrink-0 items-center gap-2.5"
          aria-label={`${schoolName} home`}
        >
          <Image
            src="/logo-280.webp"
            alt=""
            width={40}
            height={40}
            priority
            className="h-9 w-9 rounded-full bg-white object-contain p-0.5 sm:h-10 sm:w-10"
          />
          <span className="hidden max-w-[160px] truncate text-[10px] font-bold uppercase tracking-[.12em] text-[var(--home-dark)] sm:inline lg:max-w-[210px]">
            {schoolName}
          </span>
        </a>

        <nav aria-label="Home sections" className="mx-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-[11px] font-semibold text-[var(--home-dark)] transition hover:bg-[var(--home-dark)]/[.07] hover:text-[var(--home-dark-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="/login"
            aria-label="Student Portal sign in"
            className="hidden h-9 w-9 place-items-center rounded-full bg-[#e9eee3] text-[var(--home-dark)] transition hover:bg-[var(--home-dark)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] sm:grid"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/contact"
            aria-label="Contact the school"
            className="hidden h-9 w-9 place-items-center rounded-full bg-[#e9eee3] text-[var(--home-dark)] transition hover:bg-[var(--home-dark)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] md:grid"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/admissions"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--home-lime)] px-3.5 py-2.5 text-[11px] font-bold text-[var(--home-dark)] transition hover:bg-[#d9ff7a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] sm:gap-2 sm:px-5 sm:text-xs"
          >
            Apply now <ArrowDown className="h-3.5 w-3.5 -rotate-45" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-home-navigation"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#e9eee3] text-[var(--home-dark)] transition hover:bg-[#dce7d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-dark)] lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          id="mobile-home-navigation"
          aria-label="Mobile home sections"
          className="mx-auto mt-2 grid max-w-[1480px] gap-1 rounded-[22px] bg-[var(--home-paper)] p-3 text-[var(--home-dark)] shadow-[0_16px_40px_rgba(4,27,18,.15)] lg:hidden"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--home-dark)] transition hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--home-dark)]"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--home-dark)] transition hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--home-dark)]"
          >
            Student Portal
          </a>
          <a
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-[var(--home-dark)] transition hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--home-dark)]"
          >
            Contact the school
          </a>
        </nav>
      ) : null}
    </header>
  );
}
