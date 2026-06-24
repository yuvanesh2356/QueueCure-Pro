/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        surface: {
          DEFAULT: '#0b1120',
          card:    '#111827',
          raised:  '#1a2436',
          border:  '#1f3048',
          muted:   '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        token:    ['5rem',  { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'token-lg': ['8rem',{ lineHeight: '1', fontWeight: '800', letterSpacing: '-0.02em' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'scale-in':   'scaleIn 0.2s ease-out',
        'ping-once':  'ping 0.6s cubic-bezier(0, 0, 0.2, 1) 1',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        card:          '0 1px 3px 0 rgb(0 0 0 / 0.4)',
        glow:          '0 0 20px -5px rgb(16 185 129 / 0.4)',
        'glow-green':  '0 0 20px -5px rgb(34 197 94 / 0.4)',
        'glow-red':    '0 0 20px -5px rgb(239 68 68 / 0.4)',
      },
    },
  },
  plugins: [],
}