import { PRODUCT_NAME, getSchoolBrandTokens } from "@/lib/brand";

/** The home's own quiet footer on the paper palette (public pages keep Footer). */
export default function HomeFooter() {
  const { schoolName } = getSchoolBrandTokens();
  const year = new Date().getFullYear();

  const links = [
    { href: "#story", label: "Story" },
    { href: "#academics", label: "Academics" },
    { href: "#stages", label: "Stages" },
    { href: "#campus", label: "Campus" },
    { href: "#admissions", label: "Admissions" },
    { href: "#news", label: "Journal" },
    { href: "/alumni", label: "Alumni" },
    { href: "/careers", label: "Careers" },
  ];

  return (
    <footer className="home-below-fold border-t border-[#211d19]/10 bg-[#efe7d8]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[#211d19]">
            {schoolName}
          </p>
          <p className="mt-2 text-sm italic text-[#6b6459]">
            {process.env.SCHOOL_MOTTO?.trim() || "Raising Role Models"}
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[#4a443c] transition hover:text-[#20261f]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-[#211d19]/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-[#8a8175] sm:px-6">
          © {year} {schoolName}. Powered by {PRODUCT_NAME}.
        </p>
      </div>
    </footer>
  );
}
