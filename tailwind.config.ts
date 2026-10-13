export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0D0D0D",
        foreground: "#FFFFFF",
        muted: "rgba(255,255,255,0.5)",
        "muted-foreground": "rgba(255,255,255,0.4)",
        crimson: "#C2185B",
        purple: "#7B1FA2",
        deepPurple: "#4A148C",
        "card-bg": "rgba(255,255,255,0.03)",
        "border-subtle": "rgba(255,255,255,0.1)",
      },
      fontFamily: {
        display: ['"Anton"', "system-ui", "sans-serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      spacing: {
        128: "32rem",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "3rem",
      },
      animation: {
        "rotate-ring": "rotate-ring 30s linear infinite",
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "fade-in": "fade-in 0.6s ease-out forwards",
      },
      keyframes: {
        "rotate-ring": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      letterSpacing: {
        widest: "0.25em",
        "extra-wide": "0.2em",
      },
    },
  },
  plugins: [],
};
