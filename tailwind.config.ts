import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        acme: {
          50: "#fff1f7",
          100: "#ffd5e7",
          200: "#ffb3d3",
          400: "#ff66ad",
          600: "#FF0083",
          700: "#c4006a",
          900: "#4a0028",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "soft-pulse": "soft-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
