"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-6">
      <Link href="/" className="hover:text-brand-green transition-colors flex items-center gap-1">
        <Home size={12} /> Home
      </Link>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <ChevronRight size={12} />
          {item.href ? (
            <Link href={item.href} className="hover:text-brand-green transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--text-primary)] font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
