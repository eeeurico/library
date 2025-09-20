/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#161616",
        foreground: "#ffffff",
        muted: {
          DEFAULT: "#262626",
          foreground: "#adadad",
        },
        border: "#404040",
        input: "#404040",
        ring: "#ffffff",
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        button: {
          DEFAULT: "rgba(96, 96, 96, 0.5)",
          hover: "#595959",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
