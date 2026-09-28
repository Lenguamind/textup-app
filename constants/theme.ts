/**
 * Design tokens for the TEXTUP! application.
 * Centralizing colors, spacing, and other constants for visual consistency.
 */

export const THEME = {
  colors: {
    primary: {
      indigo: '#6366f1',
      violet: '#7c3aed',
      purple: '#8b5cf6',
    },
    accent: {
      yellow: '#facc15',
      green: '#10b981',
      pink: '#ec4899',
      blue: '#3b82f6',
      orange: '#f59e0b',
    },
    neutral: {
      bg: '#f8fafc',
      dark: '#1e293b',
      black: '#000000',
      white: '#ffffff',
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
      }
    }
  },
  spacing: {
    shadow: {
      neo: '4px 4px 0px #1e293b',
      neoSm: '2px 2px 0px #1e293b',
      neoLg: '8px 8px 0px #1e293b',
    },
    border: {
      width: '3px',
      radius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        full: '9999px',
      }
    }
  },
  animation: {
    speed: {
      fast: 0.2,
      normal: 0.3,
      slow: 0.5,
    }
  }
};

export const UI_VARIANTS = {
  button: {
    neo: "border-3 border-pop-dark shadow-neo btn-press active:translate-x-1 active:translate-y-1 active:shadow-none transition-all",
    neoPrimary: "bg-pop-dark text-white border-3 border-pop-dark shadow-neo btn-press",
    neoSecondary: "bg-white text-pop-dark border-3 border-pop-dark shadow-neo btn-press",
  },
  card: {
    neo: "bg-white border-3 border-pop-dark shadow-neo rounded-3xl p-6",
    neoFloating: "bg-white border-3 border-pop-dark shadow-neo rounded-3xl p-6 hover:-translate-y-1 transition-transform",
  }
};
