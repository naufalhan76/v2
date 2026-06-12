const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
      extend: {
      fontFamily: {
        heading: ['Lexend', ...defaultTheme.fontFamily.sans],
        body: ['Lexend', ...defaultTheme.fontFamily.sans],
      },
     colors: {
        'navy-deep': 'hsl(var(--navy-deep))',
        'navy-light': 'hsl(var(--navy-light))',
        'bg-gray-faded': 'hsl(var(--bg-gray-faded))',
        'success-green': 'hsl(var(--success-green))',
        'status-red-bg': 'hsl(var(--status-red-bg))',
        'status-red-text': 'hsl(var(--status-red-text))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))'
        },
        chart: {
            '1': 'hsl(var(--chart-1))',
            '2': 'hsl(var(--chart-2))',
            '3': 'hsl(var(--chart-3))',
            '4': 'hsl(var(--chart-4))',
            '5': 'hsl(var(--chart-5))'
        },
        'violet-soft': 'hsl(var(--violet-soft))',
        'teal-deep': 'hsl(var(--teal-deep))',
        'teal-mid': 'hsl(var(--teal-mid))',
        'canvas-soft': 'hsl(var(--canvas-soft))',
        'ink-mute': 'hsl(var(--ink-mute))',
        'ink-faint': 'hsl(var(--ink-faint))',
        hairline: 'hsl(var(--hairline))',
        'hairline-dark': 'hsl(var(--hairline-dark))',
        'tech-primary': '#211c59',
        'tech-bg': '#F8FAFC',
        'tech-card': '#ffffff',
        'tech-text': '#1e1b4b',
        'tech-text-secondary': '#4B5563',
        status: {
            pending: 'hsl(var(--status-pending))',
            assigned: 'hsl(var(--status-assigned))',
            'en-route': 'hsl(var(--status-en-route))',
            'in-progress': 'hsl(var(--status-in-progress))',
            completed: 'hsl(var(--status-completed))',
            invoiced: 'hsl(var(--status-invoiced))',
            paid: 'hsl(var(--status-paid))',
            cancelled: 'hsl(var(--status-cancelled))'
        }
    },
    borderRadius: {
            xs: '4px',
            sm: '6px',
            md: '8px',
            lg: '12px',
            xl: '16px',
            full: '9999px'
        },
        spacing: {
            xxs: '2px',
            xs: '4px',
            sm: '8px',
            md: '12px',
            lg: '16px',
            xl: '24px',
            xxl: '32px',
            huge: '64px'
        },
        fontSize: {
            xs: ['0.75rem', { lineHeight: '1rem' }],
            sm: ['0.8125rem', { lineHeight: '1.25rem' }],
            base: ['0.875rem', { lineHeight: '1.5rem' }],
            md: ['0.9375rem', { lineHeight: '1.5rem' }],
            lg: ['1rem', { lineHeight: '1.5rem' }],
            xl: ['1.125rem', { lineHeight: '1.75rem' }],
            '2xl': ['1.25rem', { lineHeight: '1.75rem' }],
            '3xl': ['1.5rem', { lineHeight: '2rem' }],
            '4xl': ['1.875rem', { lineHeight: '2.25rem' }],
            '5xl': ['2.25rem', { lineHeight: '2.5rem' }],
            '6xl': ['3rem', { lineHeight: '1' }],
            '7xl': ['3.75rem', { lineHeight: '1' }]
        },
        keyframes: {
  			'accordion-down': {
  				from: {
  					height: 0
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: 0
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
