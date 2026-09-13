/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // סקאלה סמנטית במקום גדלים שרירותיים - כולם נוזליים ומוגדרים ב-index.css
      fontSize: {
        micro: ['var(--fs-micro)', { lineHeight: '1.25' }],
        tiny: ['var(--fs-tiny)', { lineHeight: '1.3' }],
        caption: ['var(--fs-caption)', { lineHeight: '1.4' }],
        label: ['var(--fs-label)', { lineHeight: '1.4' }],
        body: ['var(--fs-body)', { lineHeight: '1.5' }],
        title: ['var(--fs-title)', { lineHeight: '1.3' }],
        heading: ['var(--fs-heading)', { lineHeight: '1.2' }],
        display: ['var(--fs-display)', { lineHeight: '1.1' }],
        daynum: ['var(--fs-daynum)', { lineHeight: '1' }],
      },
      colors: {
        // נקראים מ-CSS variables כדי שמעבר בין מצב יום/לילה יהיה חלק
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        well: 'rgb(var(--c-well) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
          ink: 'rgb(var(--c-brand-ink) / <alpha-value>)',
        },
        shabbat: 'rgb(var(--c-shabbat) / <alpha-value>)',
      },
      borderRadius: {
        '4xl': '2rem',
        sheet: '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 18 40 / 0.04), 0 8px 24px -8px rgb(16 18 40 / 0.10)',
        lift: '0 2px 6px rgb(16 18 40 / 0.06), 0 18px 40px -12px rgb(16 18 40 / 0.18)',
        sheet: '0 -8px 40px -12px rgb(16 18 40 / 0.22)',
        chip: '0 1px 2px rgb(16 18 40 / 0.05)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
