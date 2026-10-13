import React, { createContext, useContext } from "react";
import { Colors } from "./colors";
import { Spacing } from "./spacing";
import { Radius } from "./radius";
import { Shadows } from "./shadows";
import { Gradients } from "./gradients";
import { Typography } from "./typography";

type ThemeValue = {
  colors: typeof Colors;
  spacing: typeof Spacing;
  radius: typeof Radius;
  shadows: typeof Shadows;
  gradients: typeof Gradients;
  typography: typeof Typography;
  mode: "dark";
};

const defaultTheme: ThemeValue = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  shadows: Shadows,
  gradients: Gradients,
  typography: Typography,
  mode: "dark",
};

const ThemeContext = createContext<ThemeValue>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={defaultTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
