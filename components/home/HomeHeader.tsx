import Image from "next/image";
import { Mail, UserRound } from "lucide-react";

const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#story", label: "Our school" },
  { href: "#academics", label: "Learning" },
  { href: "#admissions", label: "Admissions" },
  { href: "#news", label: "Journal" },
];

/** Floating, glass-finished navigation that sits over the campus hero. */
export default function HomeHeader({ schoolName }: { schoolName: string }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-5">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-white/45 bg-white/75 py-2 pl-3 pr-2 shadow-[0_8px_30px_rgba(10,49,42,0.15)] backdrop-blur-md">
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2"
          aria-label={`${schoolName} home`}
        >
          <Image
            src="/logo-280.webp"
            alt=""
            width={42}
            height={42}
            priority
            className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
          />
          <span className="hidden max-w-[150px] truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--famex-primary)] md:inline">
            {schoolName}
          </span>
        </a>

        <nav
          aria-label="Home sections"
          className="mx-auto hidden items-center gap-1 rounded-full border border-white/50 bg-[var(--famex-primary)]/[0.07] px-1 py-1 md:flex"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--famex-forest-mid)] transition hover:bg-white hover:text-[var(--famex-primary)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href="/login"
            aria-label="Open school portal sign in"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--famex-primary)]/10 bg-white text-[var(--famex-primary)] transition hover:bg-[var(--famex-lime-pale)]"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/contact"
            aria-label="Contact Famex International School"
            className="hidden h-9 w-9 place-items-center rounded-full border border-[var(--famex-primary)]/10 bg-white text-[var(--famex-primary)] transition hover:bg-[var(--famex-lime-pale)] sm:grid"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="/admissions"
            className="rounded-full bg-[var(--famex-lime)] px-4 py-2.5 text-xs font-bold text-[var(--famex-primary)] transition hover:bg-[var(--famex-lime-soft)]"
          >
            Explore Famex
          </a>
        </div>
      </div>
    </header>
  );
}
