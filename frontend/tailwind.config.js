/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token('c-canvas'),
        surface: {
          DEFAULT: token('c-surface'),
          subtle: token('c-surface-subtle'),
        },
        stage: {
          DEFAULT: token('c-stage'),
          content: token('c-stage-content'),
        },
        line: {
          DEFAULT: token('c-line'),
          strong: token('c-line-strong'),
        },
        content: {
          DEFAULT: token('c-content'),
          secondary: token('c-content-secondary'),
          muted: token('c-content-muted'),
          inverse: token('c-content-inverse'),
        },
        accent: {
          DEFAULT: token('c-accent'),
          hover: token('c-accent-hover'),
          soft: token('c-accent-soft'),
          on: token('c-accent-on'),
        },
        success: {
          DEFAULT: token('c-success'),
          soft: token('c-success-soft'),
          on: token('c-success-on'),
          content: token('c-success-content'),
        },
        warning: {
          DEFAULT: token('c-warning'),
          soft: token('c-warning-soft'),
          on: token('c-warning-on'),
          content: token('c-warning-content'),
        },
        danger: {
          DEFAULT: token('c-danger'),
          soft: token('c-danger-soft'),
          on: token('c-danger-on'),
          content: token('c-danger-content'),
        },
      },
      borderColor: {
        DEFAULT: token('c-line'),
      },
      divideColor: {
        DEFAULT: token('c-line'),
      },
      ringColor: {
        DEFAULT: token('c-accent'),
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        raised: '0 4px 12px -2px rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
}
