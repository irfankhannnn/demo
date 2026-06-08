/**
 * RealtyFlow Tailwind CSS Configuration
 * Use this config to extend your Tailwind setup with RealtyFlow design tokens
 *
 * Import in your tailwind.config.js:
 * const realtyflowConfig = require('./realestateflow/tailwind.config.realtyflow.js');
 * module.exports = realtyflowConfig;
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: '#0F172A',
        'primary-alt': '#1E293B',

        // Blue
        blue: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          lighter: '#60A5FA',
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
        },

        // Accent (Green)
        accent: {
          DEFAULT: '#22C55E',
          light: '#4ADE80',
          lighter: '#86EFAC',
          50: '#F0FDF4',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },

        // Status Colors
        success: '#22C55E',
        warning: '#EAB308',
        'warning-light': '#FACC15',
        danger: '#EF4444',
        'danger-light': '#F87171',

        // Neutral
        background: '#F8FAFC',
        surface: '#FFFFFF',
        'surface-secondary': '#F1F5F9',
        'surface-tertiary': '#E2E8F0',

        // Text Colors
        text: '#111827',
        'text-secondary': '#475569',
        'text-tertiary': '#64748B',

        // Borders
        border: '#E2E8F0',
        'border-dark': '#CBD5E1',
      },

      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },

      fontSize: {
        h1: ['48px', { lineHeight: '1.2', letterSpacing: '-0.5px' }],
        h2: ['32px', { lineHeight: '1.3', letterSpacing: '-0.25px' }],
        h3: ['20px', { lineHeight: '1.4', letterSpacing: '0px' }],
        h4: ['18px', { lineHeight: '1.4', letterSpacing: '0px' }],
        body: ['16px', { lineHeight: '1.5', letterSpacing: '0px' }],
        small: ['14px', { lineHeight: '1.5', letterSpacing: '0px' }],
        tiny: ['12px', { lineHeight: '1.4', letterSpacing: '0px' }],
      },

      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },

      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px',
        xxl: '80px',
      },

      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        full: '9999px',
      },

      boxShadow: {
        xs: '0 2px 8px rgba(0, 0, 0, 0.04)',
        sm: '0 2px 8px rgba(0, 0, 0, 0.04)',
        md: '0 4px 16px rgba(0, 0, 0, 0.08)',
        lg: '0 10px 30px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 50px rgba(0, 0, 0, 0.15)',
        card: '0 10px 30px rgba(0, 0, 0, 0.05)',
        none: 'none',
      },

      screens: {
        mobile: '0px',
        tablet: '640px',
        desktop: '1024px',
        wide: '1280px',
        ultrawide: '1536px',
      },

      transition: {
        fast: '150ms ease-in-out',
        standard: '300ms ease-in-out',
        slow: '500ms ease-in-out',
      },

      maxWidth: {
        container: '1280px',
      },
    },
  },

  plugins: [
    // Custom button styles
    function({ addComponents, theme }) {
      const buttons = {
        '.btn': {
          '@apply': 'inline-flex items-center justify-center px-5 py-3 rounded-md font-semibold text-base transition-all duration-300 cursor-pointer',
        },
        '.btn-primary': {
          '@apply': 'bg-blue-500 text-white hover:bg-blue-600 active:translate-y-0 hover:-translate-y-0.5',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          '&:hover': {
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.6)',
          },
        },
        '.btn-secondary': {
          '@apply': 'bg-gray-100 text-primary border border-gray-200 hover:bg-gray-200',
        },
        '.btn-outline': {
          '@apply': 'bg-transparent text-blue-500 border-2 border-blue-500 hover:bg-blue-500 hover:text-white',
        },
        '.btn-sm': {
          '@apply': 'px-4 py-2 text-sm',
        },
        '.btn-lg': {
          '@apply': 'px-8 py-4 text-lg',
        },
        '.btn:disabled': {
          '@apply': 'opacity-50 cursor-not-allowed pointer-events-none',
        },
      };

      addComponents(buttons);
    },

    // Custom card styles
    function({ addComponents, theme }) {
      const cards = {
        '.card': {
          '@apply': 'bg-white border border-gray-200 rounded-md p-6',
          boxShadow: theme('boxShadow.card'),
          transition: 'all 300ms ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: theme('colors.border-dark'),
            boxShadow: theme('boxShadow.lg'),
          },
        },
        '.card-header': {
          '@apply': 'flex justify-between items-center mb-4 pb-4 border-b border-gray-200',
        },
        '.card-title': {
          '@apply': 'text-h3 font-bold text-primary',
          margin: 0,
        },
        '.card-body': {
          '@apply': 'mb-4',
        },
        '.card-footer': {
          '@apply': 'pt-4 border-t border-gray-200',
        },
      };

      addComponents(cards);
    },

    // Custom form styles
    function({ addComponents, theme }) {
      const forms = {
        '.form-group': {
          '@apply': 'flex flex-col gap-2 mb-4',
        },
        '.form-label': {
          '@apply': 'text-sm font-semibold text-primary',
        },
        '.form-input': {
          '@apply': 'px-4 py-3 border border-gray-200 rounded-md font-body text-base text-primary transition-all duration-150',
          '&:focus': {
            '@apply': 'outline-none border-blue-500',
            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
          },
          '&:disabled': {
            '@apply': 'bg-gray-100 cursor-not-allowed opacity-60',
          },
        },
        '.form-textarea': {
          '@apply': 'resize-vertical min-h-32',
        },
        '.form-help': {
          '@apply': 'text-xs text-gray-500',
        },
      };

      addComponents(forms);
    },

    // Utility classes
    function({ addUtilities }) {
      const utilities = {
        '.text-h1': {
          '@apply': 'text-h1 font-heading font-extrabold text-primary',
        },
        '.text-h2': {
          '@apply': 'text-h2 font-heading font-bold text-primary',
        },
        '.text-h3': {
          '@apply': 'text-h3 font-heading font-bold text-primary',
        },
        '.text-body': {
          '@apply': 'text-body font-body text-text-secondary',
        },
        '.text-small': {
          '@apply': 'text-small font-body text-text-tertiary',
        },
        '.text-accent': {
          '@apply': 'text-blue-500 font-semibold',
        },
        '.text-success': {
          '@apply': 'text-success font-semibold',
        },
        '.text-warning': {
          '@apply': 'text-warning font-semibold',
        },
        '.text-danger': {
          '@apply': 'text-danger font-semibold',
        },
        '.metric': {
          '@apply': 'flex flex-col gap-2 p-4 bg-background rounded-md text-center',
        },
        '.metric-value': {
          '@apply': 'text-4xl font-extrabold text-primary',
        },
        '.metric-label': {
          '@apply': 'text-sm text-text-secondary font-medium',
        },
        '.badge': {
          '@apply': 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        },
        '.badge-success': {
          '@apply': 'bg-green-100 text-green-900',
        },
        '.badge-warning': {
          '@apply': 'bg-yellow-100 text-yellow-900',
        },
        '.badge-danger': {
          '@apply': 'bg-red-100 text-red-900',
        },
      };

      addUtilities(utilities);
    },
  ],
};
