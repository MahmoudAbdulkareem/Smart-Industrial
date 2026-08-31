/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Control-room base surfaces (dark)
        base: {
          DEFAULT: "#0B0F14",
          panel: "#121822",
          raised: "#182130",
          line: "#26313F",
        },
        // Light-mode surfaces (adaptive theme)
        surface: {
          DEFAULT: "#F5F7FA",
          panel: "#FFFFFF",
          raised: "#FFFFFF",
          line: "#E2E8F0",
        },
        // Telemetry status semantics (from brief)
        status: {
          normal: "#12B886",
          elevated: "#F0A93A",
          critical: "#E6484B",
          info: "#5AA9E6",
        },
        ink: {
          DEFAULT: "#0B0F14",
          dim: "#5B6B7D",
          inverted: "#E8EEF4",
          invertedDim: "#8493A6",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(11,15,20,0.06), 0 8px 24px -12px rgba(11,15,20,0.12)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulseRing 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite",
      },
    },
  },
  plugins: [],
};
