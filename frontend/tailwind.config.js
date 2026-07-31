/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---------------------------------------------------------------
        // Semantic tokens — names kept from the previous system, values
        // now resolve to the Finch palette (see src/index.css :root).
        // ---------------------------------------------------------------
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          light: 'var(--orange-50)',
        },
        accent: {
          DEFAULT: 'var(--accent-yellow)',
          light: 'var(--yellow-100)',
        },
        surface: {
          DEFAULT: 'var(--surface-page)',
          raised: 'var(--surface-card)',
          sunken: 'var(--surface-sunken)',
          inverse: 'var(--surface-inverse)',
        },
        sidebar: {
          DEFAULT: 'var(--surface-inverse)',
          hover: 'rgba(251, 247, 239, 0.08)',
          active: 'rgba(246, 201, 71, 0.14)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        text: {
          DEFAULT: 'var(--text-body)',
          secondary: 'var(--text-muted)',
          muted: 'var(--text-subtle)',
        },
        heading: 'var(--text-heading)',
        link: {
          DEFAULT: 'var(--text-link)',
          hover: 'var(--text-link-hover)',
        },
        ring: 'var(--ring)',

        success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)' },
        warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)' },
        danger: { DEFAULT: 'var(--danger)', bg: 'var(--danger-bg)', hover: '#A93120' },
        info: { DEFAULT: 'var(--info)', bg: 'var(--info-bg)' },

        // ---------------------------------------------------------------
        // Finch palette scales — available as ordinary utilities.
        // ---------------------------------------------------------------
        orange: {
          50: '#FEF5EB',
          100: '#FDE9D4',
          200: '#FBD0A0',
          300: '#F6A94E',
          400: '#F08A2E',
          500: '#E2721B',
          600: '#C85A17',
          700: '#A8480F',
        },
        green: {
          50: '#F2F7EB',
          100: '#E4EED8',
          200: '#C7DBB2',
          300: '#9BBE7E',
          400: '#6B9A54',
          500: '#4A7C43',
          600: '#35633A',
          700: '#274A2B',
          800: '#1C3A21',
          900: '#1C3A21',
        },
        yellow: {
          50: '#FEF7DF',
          100: '#FEF7DF',
          200: '#FCEDBE',
          300: '#FADF8A',
          400: '#F6C947',
          500: '#F2B705',
          600: '#C99304',
          700: '#A17403',
          800: '#7C5A02',
        },
        cream: {
          50: '#FBF7EF',
          100: '#F4ECDD',
        },
        sand: {
          200: '#E7DBC6',
          300: '#D6C6A8',
          400: '#BEA981',
        },
        bark: {
          400: '#8A7A63',
          500: '#6E5E48',
          600: '#5A4B39',
          700: '#3E3324',
          800: '#2E2519',
          900: '#1F1810',
        },

        // ---------------------------------------------------------------
        // Warm guardrail remaps of stock scales. Any straggler utility
        // still renders on-brand. Cool families (blue/indigo/sky/cyan/
        // teal/emerald/violet/purple/fuchsia/pink/rose) are DELIBERATELY
        // left at Tailwind defaults so un-swept spots stay visually
        // obvious during QA.
        // ---------------------------------------------------------------
        gray: {
          50: '#FBF7EF',
          100: '#F4ECDD',
          200: '#E7DBC6',
          300: '#D6C6A8',
          400: '#8A7A63',
          500: '#6E5E48',
          600: '#5A4B39',
          700: '#3E3324',
          800: '#2E2519',
          900: '#1F1810',
        },
        red: {
          50: '#FDF0EC',
          100: '#FBE2DB',
          200: '#F4C0B3',
          300: '#E5937E',
          400: '#D46650',
          500: '#C23A22',
          600: '#C23A22',
          700: '#A93120',
          800: '#8A2819',
          900: '#6B1F13',
        },
        amber: {
          50: '#FEF7DF',
          100: '#FEF7DF',
          200: '#FCEDBE',
          300: '#FADF8A',
          400: '#F6C947',
          500: '#F2B705',
          600: '#C99304',
          700: '#A17403',
          800: '#7C5A02',
          900: '#5C4302',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
      fontFamily: {
        display: ['Sorts Mill Goudy', 'Californian FB', 'Goudy Old Style', 'Georgia', 'serif'],
        sans: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Legacy alias — old `font-body` call sites keep compiling.
        body: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['1.875rem', { lineHeight: '1.15' }],
        'card-title': ['1.375rem', { lineHeight: '1.3' }],
      },
      letterSpacing: {
        caps: '0.14em',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'modal': '12px',
        'pill': '999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(46, 37, 25, 0.06)',
        sm: '0 1px 3px rgba(46, 37, 25, 0.08), 0 1px 2px rgba(46, 37, 25, 0.04)',
        DEFAULT: '0 1px 3px rgba(46, 37, 25, 0.08), 0 1px 2px rgba(46, 37, 25, 0.04)',
        md: '0 4px 12px rgba(46, 37, 25, 0.08), 0 2px 4px rgba(46, 37, 25, 0.05)',
        lg: '0 12px 28px rgba(46, 37, 25, 0.12), 0 4px 8px rgba(46, 37, 25, 0.06)',
        xl: '0 24px 56px rgba(46, 37, 25, 0.16)',
        inset: 'inset 0 1px 2px rgba(46, 37, 25, 0.06)',
      },
      transitionDuration: {
        fast: '120ms',
        DEFAULT: '200ms',
        slow: '360ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        out: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
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
        'slide-in': 'slide-in 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'fade-in': 'fade-in 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
