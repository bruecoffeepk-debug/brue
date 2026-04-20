import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // v3 chic + clean palette
        terra: {
          DEFAULT: '#C44526',
          soft: '#E08060',
          deep: '#A13418',
        },
        ink: {
          DEFAULT: '#1C1712',
          soft: '#4A3F35',
          muted: '#7A6D5E',
        },
        paper: '#F6EEDF',
        bone: '#FCF7EB',
        cream: '#EFE3CE',
        sage: '#6B7A53',
        mustard: '#D4972E',
        line: {
          DEFAULT: 'rgba(28,23,18,0.10)',
          strong: 'rgba(28,23,18,0.18)',
        },
        // legacy aliases so POS pages still compile
        terracotta: '#C44526',
        sand: '#F6EEDF',
        'deep-sand': '#EFE3CE',
        charcoal: '#1C1712',
        amber: '#D4972E',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Instrument Serif', 'Georgia', 'serif'],
        fraunces: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter Tight', 'system-ui', 'sans-serif'],
        script: ['var(--font-script)', 'Caveat', 'cursive'],
        // legacy aliases
        display: ['var(--font-serif)', 'Instrument Serif', 'serif'],
        body: ['var(--font-sans)', 'Inter Tight', 'sans-serif'],
        accent: ['var(--font-script)', 'Caveat', 'cursive'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tightish: '-0.03em',
        widish: '0.18em',
        widest: '0.22em',
      },
      boxShadow: {
        soft: '0 40px 80px -30px rgba(28,23,18,0.28), 0 20px 40px -25px rgba(28,23,18,0.16)',
        'soft-md': '0 20px 40px -20px rgba(28,23,18,0.18)',
        'soft-sm': '0 10px 30px -12px rgba(28,23,18,0.14)',
      },
      borderRadius: {
        pill: '9999px',
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        marquee: 'marquee 36s linear infinite',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
