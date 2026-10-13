/** Ykay College — brand gradients (stop arrays for LinearGradient). */
export const Gradients = {
  primary: ["#4EC54D", "#3AA93A"],
  accent: ["#4EC54D", "#FF6E00"],
  hero: ["#050C14", "#184B18", "#4EC54D"],
  cta: ["#FF6E00", "#E65F00"],
} as const;

export type Gradients = typeof Gradients;
