// ponytail: Clerk appearance mapped to project design tokens (globals.css HSL vars)
// Upgrade path: move to Clerk's <Appearance /> component if more granular control needed
export const clerkAppearance = {
  variables: {
    colorPrimary: 'hsl(247 52% 25%)',
    colorPrimaryForeground: 'hsl(0 0% 100%)',
    colorPrimaryHover: 'hsl(244 52% 31%)',
    colorBackground: 'hsl(210 40% 98%)',
    colorForeground: 'hsl(247 53% 12%)',
    colorInputBackground: 'hsl(0 0% 100%)',
    colorInputBorder: 'hsl(40 14% 89%)',
    colorDanger: 'hsl(0 72% 51%)',
    colorSuccess: 'hsl(174 72% 38%)',
    colorWarning: 'hsl(32 95% 43%)',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    fontSizeBase: '14px',
    borderRadius: '0.5rem',
    spacingUnit: '0.25rem',
  },
  elements: {
    rootBox: 'w-full max-w-[400px]',
    cardBox: 'shadow-none border',
    socialButtonsBlockButton: 'border',
    formFieldInput: 'bg-white',
    footerActionLink: 'text-[hsl(247_52%_25%)] hover:text-[hsl(244_52%_31%)]',
    navbarButton: 'text-[hsl(247_53%_12%)]',
  },
  layout: {
    theme: 'auto' as const,
    socialButtonsVariant: 'blockButton' as const,
    friendlyCaptcha: true,
    logoImageUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/logo-msn.svg`,
  },
}
