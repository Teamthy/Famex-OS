"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (_theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Famex's botanical light palette is the default; dark remains an explicit preference.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("famex-theme");
      // Only use saved theme if user explicitly chose one
      if (saved === "light" || saved === "dark") {
        setThemeState(saved as Theme);
      } else {
        // Default to the botanical light workspace.
        setThemeState("light");
      }
    } catch {
      setThemeState("light");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    setResolvedTheme(theme);
    try {
      localStorage.setItem("famex-theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const toggleTheme = () => setTheme(resolvedTheme === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
