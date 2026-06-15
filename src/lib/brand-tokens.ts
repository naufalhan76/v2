/**
 * Centralized brand color constants for contexts where a hex literal is
 * unavoidable (e.g. Next.js viewport.themeColor static metadata).
 *
 * BRAND_THEME_COLOR mirrors --brand-500 (HSL 247 52% 25%) → #1e1b5e.
 * If --brand-500 changes in src/styles/globals.css, update this constant manually.
 *
 * This file is exempt from the hex grep guard (see scripts/check-colors.sh
 * and .eslintrc.json overrides).
 */
export const BRAND_THEME_COLOR = '#1e1b5e' as const
