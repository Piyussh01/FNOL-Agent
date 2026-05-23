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
          50: "#f5f7fb",
          100: "#e8edf6",
          200: "#cfdaeb",
          400: "#7c98c8",
          600: "#3a5d99",
          700: "#2d4878",
          900: "#142544",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
      },
    },
  },
  plugins: [],
};

export default config;
