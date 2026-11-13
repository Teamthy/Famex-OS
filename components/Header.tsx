"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { useSchoolProfile } from "./SchoolProfileContext";
import LiveClock from "./LiveClock";
import dynamic from "next/dynamic";
import { afterLoad } from "@/lib/after-lcp";

// Interactive header widgets (search palette, notifications). No visitor
// needs them in the first viewport, so they load after the LCP paint —
// their chunks stay off the critical path of every page's first paint.
const CommandSearch = dynamic(
  afterLoad(() => import("./CommandSearch")),
  { ssr: false },
);
const NotificationBell = dynamic(
  afterLoad(() => import("./NotificationBell")),
  { ssr: false },
);

const navLinks = [
  { label: "Home", href: "/" },
  {
    label: "About",
    href: "/about",
    dropdown: [
      { label: "Our Story", href: "/about" },
      { label: "Leadership", href: "/about#leadership" },
      { label: "Vision & Mission", href: "/about#vision" },
      { label: "Alumni", href: "/alumni" },
      { label: "Testimonials", href: "/testimonials" },
    ],
  },
  {
    label: "Academics",
    href: "/academics",
    dropdown: [
      { label: "Primary School", href: "/academics/primary" },
      { label: "Junior Secondary", href: "/academics/junior-secondary" },
      { label: "Senior Secondary — Science", href: "/academics/ss-science" },
      { label: "Senior Secondary — Commercial", href: "/academics/ss-commercial" },
      { label: "Senior Secondary — Arts", href: "/academics/ss-arts" },
      { label: "Academic Calendar", href: "/academics/calendar" },
    ],
  },
  { label: "Staff", href: "/staff-directory" },
  { label: "Admissions", href: "/admissions" },
  { label: "Campus Life", href: "/campus-life" },
  { label: "News", href: "/news-events" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "CBT", href: "/login?next=/student/exams" },
  { label: "Portal", href: "/portal" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  // F0-21: the school name in the chrome is a brand token, never a literal.
  const schoolName = useSchoolProfile().name || "School";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-[var(--bg-primary)] transition-all duration-300 ${scrolled ? "py-1.5" : "py-2.5"}`}
    >
      <nav className="mx-auto flex w-[calc(100%-1.5rem)] max-w-[1480px] items-center justify-between gap-4 rounded-full bg-[#f6f4ea] px-4 py-2.5 shadow-[0_12px_35px_rgba(4,27,18,.10)] md:w-[calc(100%-2.5rem)] md:px-6">
        <Link href="/" className="shrink-0 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt={`${schoolName} logo`}
            width={50}
            height={50}
            className="h-12 w-12 object-contain"
            priority
          />
          <div className="hidden sm:block leading-tight">
            <div className="font-display text-lg md:text-xl tracking-[2px] text-[var(--nav-text)] uppercase truncate max-w-[45vw]">
              {schoolName}
            </div>
          </div>
        </Link>

        <ul className="hidden 2xl:flex items-center gap-4 xl:gap-5">
          {navLinks.map((link) => (
            <li
              key={link.href}
              className="relative"
              onMouseEnter={() => link.dropdown && setActiveDropdown(link.label)}
              onMouseLeave={() => link.dropdown && setActiveDropdown(null)}
            >
              {link.dropdown ? (
                <>
                  <button className="flex items-center gap-1 font-body text-xs xl:text-sm text-[var(--nav-text)] hover:text-[var(--nav-text-active)] transition-colors tracking-wide uppercase">
                    {link.label}
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${activeDropdown === link.label ? "rotate-180" : ""}`}
                    />
                  </button>
                  {activeDropdown === link.label && (
                    <div
                      className="anim-slide-down absolute top-full left-1/2 -translate-x-1/2 pt-4"
                      style={{ zIndex: 60 }}
                    >
                      <div
                        className="w-56 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ backgroundColor: "#0C1824" }}
                      >
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block px-5 py-3 font-body text-sm text-white transition-colors hover:bg-white/10 hover:text-[#c9ff45]"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={link.href}
                  className="font-body text-xs xl:text-sm text-[var(--nav-text)] hover:text-[var(--nav-text-active)] transition-colors tracking-wide uppercase whitespace-nowrap"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden md:inline-flex">
            <LiveClock />
          </span>
          <CommandSearch />
          <NotificationBell />

          <Link
            href="/admissions"
            className="hidden md:inline-flex items-center justify-center rounded-full bg-[#b6e618] px-4 py-2 font-body text-[10px] font-bold tracking-[0.15em] uppercase text-[#123a35] shadow-sm transition-all hover:scale-[1.03] hover:bg-[#c8ee53] whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
          >
            Apply Now
          </Link>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="2xl:hidden p-2 text-[var(--nav-text)]"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="anim-slide-down 2xl:hidden mx-auto mt-2 w-[calc(100%-1.5rem)] max-w-[1480px] overflow-hidden rounded-[22px] bg-[#f6f4ea] shadow-[0_16px_40px_rgba(4,27,18,.15)]">
          <div className="flex flex-col gap-1 p-3 sm:p-4">
            {navLinks.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-body text-base text-[var(--nav-text)] hover:text-[var(--nav-text-active)] py-2 uppercase tracking-wide block"
                >
                  {link.label}
                </Link>
                {link.dropdown && (
                  <div className="pl-4 space-y-2 mt-1">
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="font-body text-sm text-[#52645f] hover:text-[#123a35] py-1 block"
                      >
                        — {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/admissions"
              onClick={() => setMobileOpen(false)}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[#b6e618] px-6 py-3 font-body text-sm font-bold tracking-widest uppercase text-[#123a35] shadow-sm transition hover:bg-[#c8ee53] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123a35]"
            >
              Apply Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
