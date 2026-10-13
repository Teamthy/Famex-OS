"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
      className="p-2.5 rounded-xl hover:bg-[var(--surface-card-hover)] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm transition-all duration-300 theme-transition"
      title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
    >
      {resolvedTheme === "light" ? (
        <Moon className="w-5 h-5" strokeWidth={2} />
      ) : (
        <Sun className="w-5 h-5" strokeWidth={2} />
      )}
    </button>
  );
}
