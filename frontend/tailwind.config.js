/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#F4F6F4",
        paper: "#FFFFFF",
        ink: { DEFAULT: "#17211C", soft: "#3A4640" },
        muted: "#64716A",
        line: "#E2E7E3",
        brand: { DEFAULT: "#12805C", dark: "#0C6447", tint: "#E6F3EE" },
        amber: { DEFAULT: "#A86B12", tint: "#FBF1E1" },
        danger: { DEFAULT: "#BE3B2A", tint: "#FBE9E6" },
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23,33,28,0.06), 0 0 0 1px rgba(23,33,28,0.05)",
        pop: "0 12px 32px -8px rgba(23,33,28,0.22)",
      },
    },
  },
  plugins: [],
};
