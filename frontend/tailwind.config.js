/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'grove-green': 'var(--grove-green)',
        'grove-green-light': 'var(--grove-green-light)',
        'citrus-orange': 'var(--citrus-orange)',
        'citrus-gold': 'var(--citrus-gold)',
        'bark-brown': 'var(--bark-brown)',
      },
      fontFamily: {
        'heading': ['Fraunces', 'Georgia', 'serif'],
        'body': ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
