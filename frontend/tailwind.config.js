/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "brand-red": "#D32F2F",
        "soft-red": "#FFEAEA",
        "brand-green": "#2E7D32",
        "soft-green": "#E8F5E9",
        "brand-orange": "#F57C00",
        "soft-orange": "#FFF3E0",
        surface: "#F5F5F5",
        "border-soft": "#E5E5E5",
        "text-dark": "#1F1F1F",
        "text-secondary": "#666666",
        "text-muted": "#999999",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,0.09), 0 2px 4px -1px rgba(0,0,0,0.06)",
        "card-lg": "0 8px 24px 0 rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      animation: {
        "processing-pulse": "processingPulse 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        processingPulse: {
          "0%, 100%": { borderColor: "#E5E5E5", boxShadow: "none" },
          "50%": {
            borderColor: "#4472C4",
            boxShadow: "0 0 0 3px rgba(68,114,196,0.12)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
