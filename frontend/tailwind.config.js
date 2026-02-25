/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic design tokens (new — use these going forward)
        primary: {
          DEFAULT: 'var(--gm-primary)',
          hover: 'var(--gm-primary-hover)',
          light: 'var(--gm-primary-light)',
        },
        accent: {
          DEFAULT: 'var(--gm-accent)',
          light: 'var(--gm-accent-light)',
        },
        surface: {
          DEFAULT: 'var(--gm-surface)',
          raised: 'var(--gm-surface-raised)',
          sunken: 'var(--gm-surface-sunken)',
        },
        sidebar: {
          DEFAULT: 'var(--gm-sidebar)',
          hover: 'var(--gm-sidebar-hover)',
          active: 'var(--gm-sidebar-active)',
        },
        border: {
          DEFAULT: 'var(--gm-border)',
          strong: 'var(--gm-border-strong)',
        },
        // Semantic text colors (used as text-text, text-text-secondary, etc.)
        text: {
          DEFAULT: 'var(--gm-text)',
          secondary: 'var(--gm-text-secondary)',
          muted: 'var(--gm-text-muted)',
        },

        // Legacy aliases (kept for backwards compatibility during migration)
        'grove-green': 'var(--gm-primary)',
        'grove-green-light': 'var(--gm-primary-hover)',
        'citrus-orange': 'var(--gm-accent)',
        'citrus-gold': 'var(--gm-accent)',
        'bark-brown': 'var(--gm-text)',
      },
      fontFamily: {
        'body': ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
        'button': '6px',
        'modal': '12px',
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
