# MSN ERP Web — Design System (Color Tokens)

> **Single Source of Truth**: `src/styles/globals.css` defines every color token. `tailwind.config.js` exposes them as utilities. Do not introduce new colors anywhere else.

---

## 1. Source of Truth

All colors live as HSL CSS custom properties in `src/styles/globals.css`. The file has two blocks:

- `:root` — light theme values
- `.dark` — dark theme overrides (applied by `next-themes` via the `class` strategy)

`tailwind.config.js` maps each CSS variable to a Tailwind utility using the pattern `hsl(var(--token-name))`. This follows the shadcn/ui convention, so every shadcn primitive (Button, Card, Dialog, etc.) picks up the correct color automatically.

The theme provider is `next-themes` only. No parallel theme system exists. See Section 5 for details.

---

## 2. Token Reference

### 2.1 Brand Scale

The brand scale is a set of navy-based hues used for branded surfaces, primary actions, and chart accents. These values are identical in light and dark modes.

| Token | HSL | Hex (approx) | Tailwind Utility | Example Use |
|-------|-----|-------------|-----------------|-------------|
| `--brand-50` | `244 60% 97%` | `#f0eeff` | `bg-brand-50` | Subtle branded tint, highlight rows |
| `--brand-100` | `244 55% 92%` | `#d9d5f5` | `bg-brand-100` | Branded background sections |
| `--brand-200` | `244 50% 84%` | `#b8b1eb` | `bg-brand-200` | Hover states on brand-100 |
| `--brand-500` | `247 52% 25%` | `#1f1b5e` | `bg-brand-500` | Primary brand color (light mode `--primary`) |
| `--brand-600` | `244 52% 31%` | `#262375` | `bg-brand-600` | Hover on primary (light), primary itself (dark) |
| `--brand-700` | `247 52% 18%` | `#16133d` | `bg-brand-700` | Deep brand emphasis |
| `--brand-900` | `247 53% 8%` | `#070619` | `bg-brand-900` | Near-black brand, footer backgrounds |

### 2.2 Semantic Tokens

Semantic tokens describe the *purpose* of a color, not the color itself. They adapt between light and dark themes.

| Token | Tailwind Utility | Example Use |
|-------|-----------------|-------------|
| `--background` | `bg-background` | Page background |
| `--foreground` | `text-foreground` | Default text color |
| `--surface` | `bg-surface` | Card surfaces, panels |
| `--surface-muted` | `bg-surface-muted` | Tinted sections, grouped areas |
| `--surface-elevated` | `bg-surface-elevated` | Elevated cards, modals |
| `--card` | `bg-card` | Card component (aliases `--surface`) |
| `--card-foreground` | `text-card-foreground` | Text inside cards |
| `--popover` | `bg-popover` | Tooltip, dropdown surfaces |
| `--popover-foreground` | `text-popover-foreground` | Text inside popovers |
| `--primary` | `bg-primary`, `text-primary` | Primary actions, active states |
| `--primary-foreground` | `text-primary-foreground` | Text on primary backgrounds |
| `--primary-hover` | `hover:bg-primary-hover` | Primary button hover |
| `--secondary` | `bg-secondary` | Secondary actions, chips |
| `--secondary-foreground` | `text-secondary-foreground` | Text on secondary |
| `--muted` | `bg-muted` | Disabled backgrounds, subtle fills |
| `--muted-foreground` | `text-muted-foreground` | Secondary text, placeholders |
| `--accent` | `bg-accent` | Accent highlights |
| `--accent-foreground` | `text-accent-foreground` | Text on accent |
| `--border` | `border-border` | Default borders, dividers |
| `--border-strong` | `border-border-strong` | Stronger borders, table headers |
| `--input` | `border-input` | Form input borders |
| `--ring` | `ring-ring` | Focus rings |
| `--destructive` | `bg-destructive` | Destructive actions (delete, error) |
| `--destructive-foreground` | `text-destructive-foreground` | Text on destructive |
| `--radius` | N/A (CSS variable) | Base border-radius: `0.5rem` |

### 2.3 Status Tokens (8 states x 2 variants = 16)

Each order lifecycle state has a foreground token and a background companion. Use them together for status badges.

| State | Foreground Token | Background Token | Example Utility Class |
|-------|-----------------|-----------------|----------------------|
| pending | `--status-pending` | `--status-pending-bg` | `bg-status-pending-bg text-status-pending` |
| assigned | `--status-assigned` | `--status-assigned-bg` | `bg-status-assigned-bg text-status-assigned` |
| en-route | `--status-en-route` | `--status-en-route-bg` | `bg-status-en-route-bg text-status-en-route` |
| in-progress | `--status-in-progress` | `--status-in-progress-bg` | `bg-status-in-progress-bg text-status-in-progress` |
| completed | `--status-completed` | `--status-completed-bg` | `bg-status-completed-bg text-status-completed` |
| invoiced | `--status-invoiced` | `--status-invoiced-bg` | `bg-status-invoiced-bg text-status-invoiced` |
| paid | `--status-paid` | `--status-paid-bg` | `bg-status-paid-bg text-status-paid` |
| cancelled | `--status-cancelled` | `--status-cancelled-bg` | `bg-status-cancelled-bg text-status-cancelled` |

**Aliases** for common semantic states:

| Alias | Points To |
|-------|-----------|
| `--success` | `--status-completed` |
| `--warning` | `--status-pending` |
| `--info` | `--status-assigned` |

### 2.4 Chart Tokens

Used by Recharts and other charting libraries. Each maps to an existing token.

| Token | Maps To | Tailwind Utility |
|-------|---------|-----------------|
| `--chart-1` | `--brand-500` | `text-chart-1` |
| `--chart-2` | `--brand-600` | `text-chart-2` |
| `--chart-3` | `--status-in-progress` | `text-chart-3` |
| `--chart-4` | `--status-pending` | `text-chart-4` |
| `--chart-5` | `--status-cancelled` | `text-chart-5` |

---

## 3. Light + Dark Values

Every token's HSL values for both themes. Brand scale tokens (Section 2.1) are identical in both modes and not repeated here.

### Semantic Tokens

| Token | Light HSL | Dark HSL |
|-------|-----------|----------|
| `--background` | `210 40% 98%` | `248 37% 8%` |
| `--foreground` | `247 53% 12%` | `40 10% 92%` |
| `--surface` | `0 0% 100%` | `248 37% 12%` |
| `--surface-muted` | `40 20% 98%` | `248 30% 16%` |
| `--surface-elevated` | `0 0% 100%` | `248 37% 14%` |
| `--card` | `var(--surface)` | `var(--surface)` |
| `--card-foreground` | `var(--foreground)` | `var(--foreground)` |
| `--popover` | `var(--surface)` | `var(--surface)` |
| `--popover-foreground` | `var(--foreground)` | `var(--foreground)` |
| `--primary` | `var(--brand-500)` | `var(--brand-600)` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--primary-hover` | `var(--brand-600)` | `244 60% 40%` |
| `--secondary` | `40 20% 96%` | `248 30% 16%` |
| `--secondary-foreground` | `var(--foreground)` | `var(--foreground)` |
| `--muted` | `40 14% 94%` | `248 30% 16%` |
| `--muted-foreground` | `247 15% 38%` | `247 12% 65%` |
| `--accent` | `40 14% 94%` | `248 30% 16%` |
| `--accent-foreground` | `var(--foreground)` | `var(--foreground)` |
| `--border` | `40 14% 89%` | `252 18% 22%` |
| `--border-strong` | `40 14% 80%` | `252 18% 32%` |
| `--input` | `40 14% 89%` | `252 18% 22%` |
| `--ring` | `var(--brand-600)` | `var(--brand-600)` |
| `--destructive` | `0 72% 51%` | `0 84% 70%` |
| `--destructive-foreground` | `0 0% 98%` | `0 0% 98%` |

### Status Tokens

| Token | Light HSL | Dark HSL |
|-------|-----------|----------|
| `--status-pending` | `32 95% 43%` | `32 95% 60%` |
| `--status-pending-bg` | `38 92% 95%` | `32 80% 18%` |
| `--status-assigned` | `217 91% 50%` | `217 91% 70%` |
| `--status-assigned-bg` | `214 95% 95%` | `217 80% 18%` |
| `--status-en-route` | `258 90% 60%` | `258 90% 75%` |
| `--status-en-route-bg` | `258 90% 95%` | `258 70% 20%` |
| `--status-in-progress` | `174 72% 38%` | `174 72% 55%` |
| `--status-in-progress-bg` | `174 72% 94%` | `174 60% 18%` |
| `--status-completed` | `142 71% 38%` | `142 71% 55%` |
| `--status-completed-bg` | `142 71% 94%` | `142 60% 16%` |
| `--status-invoiced` | `189 94% 38%` | `189 94% 55%` |
| `--status-invoiced-bg` | `189 94% 94%` | `189 70% 18%` |
| `--status-paid` | `158 64% 40%` | `158 64% 60%` |
| `--status-paid-bg` | `158 64% 94%` | `158 60% 16%` |
| `--status-cancelled` | `0 72% 51%` | `0 84% 70%` |
| `--status-cancelled-bg` | `0 93% 94%` | `0 60% 22%` |

### Aliases

| Token | Maps To |
|-------|---------|
| `--success` | `var(--status-completed)` |
| `--warning` | `var(--status-pending)` |
| `--info` | `var(--status-assigned)` |

### Chart Tokens

| Token | Maps To |
|-------|---------|
| `--chart-1` | `var(--brand-500)` |
| `--chart-2` | `var(--brand-600)` |
| `--chart-3` | `var(--status-in-progress)` |
| `--chart-4` | `var(--status-pending)` |
| `--chart-5` | `var(--status-cancelled)` |

---

## 4. Usage Guidelines

### Do

- Use Tailwind utility classes: `bg-primary`, `text-foreground`, `border-border`
- Use semantic status tokens for status badges: `bg-status-pending-bg text-status-pending border-status-pending/30`
- Use brand scale for branded surfaces: `bg-brand-50` for highlights, `bg-primary` for emphasis
- Use shadcn conventions: shadcn primitives auto-adapt via CSS vars
- Use `border-border-strong` when you need more visual weight than `border-border`
- Use opacity modifiers for subtle variants: `bg-primary/10`, `border-status-completed/30`

### Don't

- NEVER use arbitrary hex classes: `bg-[#xxx]`, `text-[#xxx]`, `border-[#xxx]`
- NEVER use Tailwind palette numerics: `bg-blue-500`, `text-amber-600`, `border-emerald-500`
- NEVER use Tailwind `gray-*` defaults (use `muted`, `muted-foreground`, `border`, `surface-muted`)
- NEVER add new color definitions outside `src/styles/globals.css`
- NEVER hardcode hex in `.tsx` or `.ts` files (only 2 documented exceptions: `email-template.ts`, `brand-tokens.ts`)
- NEVER use `dark:bg-[#xxx]` arbitrary classes. Use `dark:bg-surface` etc.
- NEVER mix raw Tailwind color scales with semantic tokens in the same component

---

## 5. Theme Provider

- **One library**: `next-themes` (v0.4.6+)
- **Mounted**: at root layout (`src/app/layout.tsx`) ONLY
- **Strategy**: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`
- **localStorage key**: `theme` (next-themes default)
- **FOUC**: handled internally by next-themes. No manual script needed.
- **Toggle UIs**:
  - Dashboard sidebar uses `<DarkModeToggle>` (Switch component)
  - Technician PWA uses `<TechnicianThemeToggle>` (3-button radio: light/dark/system)
  - Both call `useTheme()` from `next-themes`
- **Removed parallel system**: `TechnicianThemeProvider` and `useTechnicianTheme` were deleted in the token migration. Do not reintroduce them.

---

## 6. Status Color Pattern

**Object-based** (preferred for consistency across many sites):

```ts
import { ORDER_STATUS_COLORS } from '@/lib/order-status'
const { bg, text, border } = ORDER_STATUS_COLORS[order.status]
return <Badge className={cn(bg, text, border)} />
```

The constant emits token classes like `'bg-status-pending-bg text-status-pending border-status-pending/30'`.

**Direct utility** (preferred for one-off badges):

```tsx
<span className="bg-status-completed-bg text-status-completed border border-status-completed/30 px-2 py-0.5 rounded text-xs">
  Completed
</span>
```

Both patterns resolve to the same CSS variables and auto-adapt to dark mode.

---

## 7. Deprecated Tokens

Old tokens removed in the migration. Use the new mapping when porting legacy code.

| Old Token | New Token | Notes |
|-----------|-----------|-------|
| `--navy-deep` | `--brand-500` / `--primary` | Brand color consolidation |
| `--navy-light` | `--brand-600` / `--primary-hover` | Lighter navy for hover/secondary brand |
| `--canvas-soft` | `--surface-muted` | Muted surface backgrounds |
| `--ink-mute` | `--muted-foreground` | Secondary text color |
| `--ink-faint` | `--muted-foreground` (or `--foreground/50`) | Very faint text |
| `--hairline` | `--border` | Default border/divider color |
| `--hairline-dark` | `--border-strong` (light) / `--border` (dark) | Stronger border variant |
| `--violet-soft` | `--brand-100` | Branded tint, soft violet backgrounds |
| `--teal-deep` | `--status-in-progress` | In-progress status color |
| `--teal-mid` | `--status-in-progress` | In-progress status color (duplicate) |
| `--bg-gray-faded` | `--background` | Page background |
| `--success-green` | `--success` (alias of `--status-completed`) | Success checkmarks |
| `--status-red-bg` | `--status-cancelled-bg` | Cancelled/error background |
| `--status-red-text` | `--status-cancelled` / `--destructive` | Cancelled/error text |
| `--tech-primary` | `--primary` | Technician PWA unification |
| `--tech-bg` | `--background` | Technician PWA page background |
| `--tech-card` | `--surface` | Technician PWA card surfaces |
| `--tech-text` | `--foreground` | Technician PWA primary text |
| `--tech-text-secondary` | `--muted-foreground` | Technician PWA secondary text |

---

## 8. Migration Footer

- **Plan**: `.omo/plans/unified-color-token-migration.md`
- **ESLint rule**: `no-restricted-syntax` in `.eslintrc.json` blocks `bg-[#xxx]`, `text-[#xxx]`, etc. in JSX className attributes
- **CI guard**: `bun run lint:colors` (script: `scripts/check-colors.sh`) fails build on hex literals in component code
- **Combined check**: `bun run check` runs type-check + lint + lint:colors
- **Exception files** (the only files allowed to contain hex literals):
  1. `src/app/api/invoices/send-email/email-template.ts` — email rendering requires inline styles
  2. `src/lib/brand-tokens.ts` — centralized PWA `viewport.themeColor` constant

---

## 9. Quick Reference

| Question | Answer |
|----------|--------|
| Need brand color? | `bg-primary` / `text-primary` (or `bg-brand-{50..900}` for scale) |
| Need page bg? | `bg-background` |
| Need card surface? | `bg-surface` (or `bg-surface-muted` for tinted sections, `bg-surface-elevated` for elevated cards) |
| Need muted text? | `text-muted-foreground` |
| Need section divider? | `border-border` (or `border-border-strong` for stronger contrast) |
| Need status badge? | `bg-status-{state}-bg text-status-{state} border-status-{state}/30` |
| Need primary button? | `bg-primary text-primary-foreground hover:bg-primary-hover` |
| Need destructive? | `bg-destructive text-destructive-foreground` |
| Need tooltip surface? | `bg-popover text-popover-foreground` |
| Need outline ring? | `ring-2 ring-ring` |
| Need chart colors? | `text-chart-1` through `text-chart-5` (auto-mapped to brand + status tokens) |
| Need success/warning/info? | `text-success`, `text-warning`, `text-info` (aliases for completed/pending/assigned) |
