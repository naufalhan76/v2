---
name: MSN ERP
description: Admin dashboard and technician PWA for B2B AC service operations
colors:
  primary: "#2563eb"
  primary-foreground: "#ffffff"
  secondary: "#f1f5f9"
  secondary-foreground: "#0f172a"
  destructive: "#ef4444"
  destructive-foreground: "#fafafa"
  muted: "#f1f5f9"
  muted-foreground: "#64748b"
  accent: "#f1f5f9"
  accent-foreground: "#0f172a"
  background: "#ffffff"
  foreground: "#0f172a"
  card: "#ffffff"
  card-foreground: "#0f172a"
  popover: "#ffffff"
  popover-foreground: "#0f172a"
  border: "#e2e8f0"
  input: "#e2e8f0"
  ring: "#2563eb"
  chart-1: "#2563eb"
  chart-2: "#60a5fa"
  chart-3: "#22c55e"
  chart-4: "#f59e0b"
  chart-5: "#ef4444"
  status-pending: "#f59e0b"
  status-assigned: "#2563eb"
  status-en-route: "#6366f1"
  status-in-progress: "#8b5cf6"
  status-completed: "#22c55e"
  status-invoiced: "#06b6d4"
  status-paid: "#059669"
  status-cancelled: "#ef4444"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.01em"
rounded:
  lg: "0.75rem"
  md: "0.625rem"
  sm: "0.4375rem"
spacing:
  default: "1rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#1d4ed8"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  sidebar-item-active:
    backgroundColor: "rgba(37, 99, 235, 0.1)"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: MSN ERP

## 1. Overview

**Creative North Star: "The Precision Operations Room"**

MSN ERP is a technical workspace, not a marketing surface. The design system treats every pixel as operational infrastructure: the admin needs to assign a technician in seconds, the finance user needs to trace an invoice instantly, and the field technician needs to update a job status with one thumb while holding a toolbox. There is no decoration without function.

The personality is **Modern, Premium, Technical** — clean but not sterile, considered but not ornate. The interface earns trust through consistency: the same button shape on every screen, the same status color meaning across every module, the same loading pattern for every async action. Users should never pause to decode the UI; they should pause only to make a business decision.

This system explicitly rejects the visual language of generic ERP admin templates. No sidebar fatigue. No default blue-gray corporate blandness. No "dashboard widget" clutter. MSN ERP looks like a tool built for people who know what they're doing.

**Key Characteristics:**
- One accent color (brand blue) carries identity; everything else is functional
- Flat surfaces at rest; shadows appear only on hover or focus
- Status colors are semantic, consistent, and icon-augmented (never color-alone)
- All motion conveys state change, not decoration
- Mobile-first for the technician PWA; desktop-optimized for admin and finance
- Indonesian language for all user-facing labels

## 2. Colors

The palette is intentionally restrained: one primary accent, a neutral zinc family, and a carefully calibrated semantic status spectrum.

### Primary
- **Brand Blue** (#2563eb / hsl(221 83% 53%)): The sole accent. Used for primary actions, active navigation states, focus rings, and the first chart series. It is the visual signature of MSN ERP. Do not introduce a second accent color.

### Neutral
- **White** (#ffffff): Content background, card surface, popover background.
- **Slate 50** (#f8fafc): Secondary backgrounds, hover tints, subtle separators.
- **Slate 100** (#f1f5f9): Muted backgrounds, secondary buttons, badge secondary variants.
- **Slate 400** (#94a3b8): Muted text, placeholders, disabled hints.
- **Slate 500** (#64748b): Muted-foreground text, secondary labels, descriptions.
- **Slate 900** (#0f172a): Primary text, headings, dark mode background.
- **Slate 800** (#1e293b): Dark mode card surfaces, elevated panels.
- **Slate 700** (#334155): Dark mode secondary surfaces.
- **Slate 200** (#e2e8f0): Borders, dividers, input strokes, light mode separators.
- **Slate 600** (#475569): Dark mode muted text.

### Semantic Status
- **Amber** (#f59e0b): Pending / warning / partial-paid states.
- **Blue** (#2563eb): Assigned / sent states.
- **Indigo** (#6366f1): En-route state.
- **Violet** (#8b5cf6): In-progress state.
- **Green** (#22c55e): Completed state.
- **Cyan** (#06b6d4): Invoiced state.
- **Emerald** (#059669): Paid / success state.
- **Red** (#ef4444): Cancelled / overdue / destructive state.

### Named Rules
**The One Voice Rule.** The primary blue is the only accent color. If a screen introduces a new hue for decoration, it is wrong. Status colors are semantic, not decorative — they convey state, not brand.

**The Dark Mode Parity Rule.** Every light-mode token has a dark-mode counterpart. Status badges, borders, and backgrounds all shift together. Never leave a status color unadapted for dark mode.

## 3. Typography

**Display / Body / Label Font:** Inter (with system-ui, -apple-system, sans-serif fallback)

**Character:** Inter is a technical, neutral sans-serif. It reads as precise and modern without calling attention to itself. The weight contrast between regular (400) and semibold (600) is sufficient for hierarchy without introducing a second typeface.

### Hierarchy
- **Display** (600, 2.25rem / 36px, line-height 1.25, letter-spacing -0.02em): Page titles and dashboard headers. Used sparingly — once per screen.
- **Headline** (600, 1.5rem / 24px, line-height 1.33, letter-spacing -0.01em): Section titles, card headers, modal titles.
- **Title** (500, 1.125rem / 18px, line-height 1.4): Subsection headers, list item titles, form group labels.
- **Body** (400, 0.875rem / 14px, line-height 1.6): Descriptions, table cells, form helper text, general content. Cap line length at 75ch for prose.
- **Label** (500, 0.75rem / 12px, line-height 1.5, letter-spacing 0.01em): Form labels, badge text, button labels, status indicators. Uppercase reserved for short status labels only (≤2 words).

### Named Rules
**The No-Display-in-UI Rule.** Display size (2.25rem) is for page titles only. Never use it inside cards, tables, or forms. Product UI requires density, not drama.

## 4. Elevation

The system is **flat by default, layered on demand**. Surfaces rest flat against the background. Shadows emerge only as a response to state: hover, focus, or elevation of a temporary element (popover, dropdown, modal).

There is no persistent "card shadow" as a default style. Cards and tables use a 1px border for definition; the shadow is earned through interaction.

### Shadow Vocabulary
- **Ambient Low** (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)`): Default resting shadow on buttons and small interactive elements. Barely perceptible; provides tactile grounding.
- **Ambient Medium** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08)`): Hover state on cards (`kpi-card`, `data-table-container`) and buttons. Lifts the element without detaching it.
- **Focused Ring** (`box-shadow: 0 0 0 2px hsl(var(--ring) / 0.3)`): Focus-visible treatment on all interactive elements. Replaces the default browser outline with a brand-colored glow.

Dark mode shadows are softer and cooler, using `rgba(0, 0, 0, 0.25)` to account for the darker background.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If a card has a shadow without being hovered or focused, the shadow is too heavy. Use a 1px border (`border-border/50`) for structural separation instead.

## 5. Components

### Buttons
- **Shape:** Gently rounded edges (0.625rem / 10px radius for default and lg sizes; sm size also 0.625rem; icon size is 0.625rem)
- **Primary:** Brand blue background (#2563eb), white text, subtle ambient-low shadow. Hover: background darkens to #1d4ed8, ambient-medium shadow appears. Focus: brand-blue ring glow.
- **Destructive:** Red background (#ef4444), white text. Hover: #dc2626. Used for cancel, delete, and irreversible actions.
- **Outline:** Transparent background, slate-200 border, slate-900 text. Hover: slate-50 background fill. Used for secondary or dismissive actions.
- **Secondary:** Slate-100 background, slate-900 text. Hover: slate-200. Used for non-primary actions within dense UIs.
- **Ghost:** Transparent background. Hover: slate-100 fill. Used for icon buttons and low-priority actions.
- **Link:** Brand blue text, underline on hover. Used for inline navigation or text-based actions.
- **Sizes:** Default (h-9, px-4), Small (h-8, px-3, text-xs), Large (h-10, px-8), Icon (h-9, w-9, square).
- **Transitions:** `transition-colors` on all variants. Disabled state: `pointer-events-none opacity-50`.

### Badges
- **Shape:** Small rounded corners (0.625rem / 10px radius)
- **Default:** Brand blue background, white text. Used for primary labels, counts, and active filters.
- **Secondary:** Slate-100 background, slate-900 text. Used for neutral tags and inactive items.
- **Destructive:** Red background, white text. Used for error states, cancelled items, overdue markers.
- **Outline:** Transparent background, slate-900 text, slate-200 border. Used for filters and selectable tags.
- **Padding:** px-2.5 py-0.5 (compact, readable at small size)

### Cards / Containers
- **Corner Style:** 0.75rem / 12px radius
- **Background:** White in light mode, slate-800 in dark mode
- **Border:** 1px solid slate-200 (`border-border/50`) — subtle but present
- **Shadow Strategy:** No shadow at rest. On hover: ambient-medium shadow (`hover:shadow-md`).
- **Internal Padding:** 24px (p-6) standard; 16px (p-4) for compact lists
- **Custom classes:**
  - `.kpi-card`: Card with hover lift (shadow-md on hover)
  - `.data-table-container`: Card variant with overflow-hidden for table scrolling

### Inputs / Fields
- **Style:** 1px slate-200 border, white background, 0.625rem radius. Height matches default button (h-9) for alignment.
- **Focus:** Border shifts to brand blue, ring glow appears (`focus-visible:ring-1 focus-visible:ring-ring`).
- **Error:** Border turns red, error text below in red-500 at label size.
- **Disabled:** `opacity-50`, `cursor-not-allowed`, no focus ring.
- **Textarea:** Same border and radius, taller default height.

### Navigation
- **Sidebar:** Fixed left panel. Items are horizontal rows with icon + label, 10px vertical padding, 0.625rem radius.
  - **Default:** Muted foreground text (#64748b), no background. Hover: slate-100 background, slate-900 text.
  - **Active:** Brand-blue background at 10% opacity (`bg-primary/10`), brand-blue text, left border accent (2px solid brand blue).
- **Top Navbar:** Present on mobile as a horizontal bar with menu trigger and logo. Hidden on desktop where sidebar dominates.
- **Mobile:** Sidebar becomes a slide-out sheet (shadcn Sheet component) on narrow viewports. Touch targets maintain minimum 44px height.

### Status Badges
- **Signature component.** Every order, invoice, and service record carries a status badge.
- **Style:** Small rounded badge with background tint, dark text, and 1px border. Always includes an icon (clock, user, truck, wrench, check, file, banknote, x-circle) — never color alone.
- **Dark mode:** Background tints become more saturated; text lightens to maintain contrast.

## 6. Do's and Don'ts

### Do:
- **Do** use the brand blue (#2563eb) for primary actions, active navigation, and focus rings only. Its rarity is its power.
- **Do** pair every status color with an icon. Color conveys category; icon conveys meaning. This is mandatory for accessibility.
- **Do** use skeleton loaders for initial page loads and empty tables. Never show a blank screen or a centered spinner in content areas.
- **Do** respect `prefers-reduced-motion` for all transitions and animations. The technician PWA may run on low-end devices.
- **Do** maintain 44px minimum touch targets on all interactive elements in the technician route.
- **Do** use Indonesian for all user-facing labels, button text, and status names.

### Don't:
- **Don't** introduce a second accent color. The One Voice Rule applies everywhere.
- **Don't** rely on color alone to communicate state. A red "Cancelled" badge without an X icon is an accessibility failure.
- **Don't** use gradient text, glassmorphism, or decorative blur effects. This is a tool, not a campaign page.
- **Don't** apply shadows to cards at rest. The Flat-By-Default Rule keeps surfaces grounded. Shadows are for hover and focus only.
- **Don't** use display fonts, uppercase body text, or marketing buzzwords. Inter in sentence case is the only voice.
- **Don't** build custom scrollbars, weird form controls, or non-standard modal behaviors. Standard affordances earn familiarity.
- **Don't** use border-left or border-right greater than 1px as a colored stripe on cards, list items, or alerts. The sidebar active state is the one exception (2px left border on active nav item).
