import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2A1C13", espresso: "#2B1D14", "espresso-2": "#3C2A1D",
        cream: "#F4EDE1", card: "#FCF8F0",
        copper: "#A96E52", "copper-d": "#8A5A42", rose: "#E4A884", soft: "#C9A088",
        muted: "#7A675A",
        stockin: "#3C7A4E", stocklow: "#B57A1B", stockout: "#A24B3C", wa: "#25D366",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
