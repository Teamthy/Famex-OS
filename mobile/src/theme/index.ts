export { Colors } from "./colors";
export { Spacing } from "./spacing";
export { Radius } from "./radius";
export { Shadows } from "./shadows";
export { Gradients } from "./gradients";
export { Typography } from "./typography";
export { ThemeProvider, useTheme } from "./ThemeProvider";

import { Colors } from "./colors";
import { Spacing } from "./spacing";
import { Radius } from "./radius";
import { Shadows } from "./shadows";
import { Gradients } from "./gradients";
import { Typography } from "./typography";

/** Combined theme object for direct (non-hook) access. */
export const theme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  shadows: Shadows,
  gradients: Gradients,
  typography: Typography,
} as const;

export type Theme = typeof theme;
