const LINKS = [
  { href: "#story", label: "Story" },
  { href: "#academics", label: "Academics" },
  { href: "#stages", label: "Stages" },
  { href: "#campus", label: "Campus" },
  { href: "#admissions", label: "Admissions" },
  { href: "#news", label: "Journal" },
  { href: "#visit", label: "Visit" },
];

/**
 * Floating glass pill navigation that sits over the hero card — the home's
 * own wayfinding (anchor links), while the global Header keeps serving the
 * rest of the public site. "Student Portal" and "Apply Now" are real
 * destinations (/login, /admissions), never dead links.
 */
export default function HomeHeader({ schoolName }: { schoolName: string }) {
  const name = schoolName;
  const initials = (name || "Our School")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-white/40 bg-white/70 py-2 pl-3 pr-2 shadow-[0_8px_30px_rgba(33,29,25,0.12)] backdrop-blur-md">
        <a href="#top" className="flex items-center gap-2" aria-label={`${name} — back to top`}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#20261f] text-[11px] font-bold tracking-wide text-[#f6f1e8]">
            {initials}
          </span>
          <span className="hidden font-[family-name:var(--font-fraunces)] text-lg font-semibold tracking-tight text-[#211d19] md:inline">
            {name}
          </span>
        </a>

        <nav
          aria-label="Home sections"
          className="mx-auto hidden items-center gap-1 rounded-full bg-[#211d19]/5 px-1 py-1 lg:flex"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-sm text-[#4a443c] transition hover:bg-white hover:text-[#211d19]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/login"
            className="hidden rounded-full border border-[#211d19]/15 bg-white/80 px-4 py-2 text-sm font-medium text-[#211d19] transition hover:border-[#211d19]/35 sm:inline-block"
          >
            Student Portal
          </a>
          <a
            href="/admissions"
            className="rounded-full bg-[#7fb069] px-4 py-2 text-sm font-semibold text-[#1d241a] transition hover:bg-[#5d8f4e] hover:text-white"
          >
            Apply Now
          </a>
        </div>
      </div>
    </header>
  );
}
