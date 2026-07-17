import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e12",
        panel: "#12161c",
        border: "#232a33",
        text: "#e8ecf1",
        muted: "#7c8896",
        accent: "#ffb454",
        diffadd: "#2ea043",
        diffaddbg: "#0d2818",
        diffrem: "#f85149",
        diffrembg: "#2a1315",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
