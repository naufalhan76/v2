---
name: MSN ERP — Superhuman Design System
description: Admin dashboard and technician PWA for B2B AC service operations. Adapted from Superhuman's design language for operational density.
colors:
  primary:
    indigo-navy:
      hex: "#1b1938"
      hsl: "244 38% 16%"
      usage: "Primary actions, active nav, deep backgrounds, dark mode canvas"
    indigo-navy-hover:
      hex: "#2d2a52"
      hsl: "245 32% 24%"
      usage: "Hover state for indigo-navy surfaces"
  secondary:
    violet-soft:
      hex: "#c9b4fa"
      hsl: "258 87% 84%"
      usage: "Subtle accent, selected states, highlight backgrounds"
    violet-soft-hover:
      hex: "#b8a0f0"
      hsl: "258 73% 78%"
      usage: "Hover state for violet-soft surfaces"
    teal-deep:
      hex: "#0e3030"
      hsl: "180 55% 12%"
      usage: "Deep accent, metric highlights, emphasis cards"
    teal-mid:
      hex: "#3d7a7a"
      hsl: "180 33% 36%"
      usage: "Mid accent, secondary metrics, info states"
  neutrals:
    canvas:
      hex: "#ffffff"
      hsl: "0 0% 100%"
      usage: "Page background, card surface, popover background"
    canvas-soft:
      hex: "#fafaf8"
      hsl: "60 17% 98%"
      usage: "Secondary backgrounds, sidebar surface, hover tints"
    ink:
      hex: "#292827"
      hsl: "30 3% 16%"
      usage: "Primary text, headings, high-emphasis content"
    ink-mute:
      hex: "#73706d"
      hsl: "30 3% 44%"
      usage: "Secondary text, descriptions, placeholder text"
    ink-faint:
      hex: "#9a9794"
      hsl: "30 3% 59%"
      usage: "Disabled text, tertiary labels, non-critical metadata"
  hairlines:
    hairline-light:
      hex: "#e8e4dd"
      hsl: "38 19% 89%"
      usage: "Light mode borders, dividers, input strokes, card edges"
    hairline-dark:
      hex: "#3f3a52"
      hsl: "253 17% 27%"
      usage: "Dark mode borders, dividers, input strokes, card edges"
  status:
    status-pending:
      hex: "#c1914b"
      hsl: "37 49% 53%"
      label: "Pending"
      description: "Order received, awaiting assignment"
    status-assigned:
      hex: "#5b7fbf"
      hsl: "216 44% 55%"
      label: "Assigned"
      description: "Technician assigned, not yet dispatched"
    status-en-route:
      hex: "#5b8faa"
      hsl: "201 32% 51%"
      label: "En-route"
      description: "Technician traveling to site"
    status-in-progress:
      hex: "#9b7fc4"
      hsl: "265 38% 63%"
      label: "In Progress"
      description: "Work being performed on site"
    status-completed:
      hex: "#4a8c6f"
      hsl: "155 31% 42%"
      label: "Completed"
      description: "Service finished, awaiting invoicing"
    status-invoiced:
      hex: "#4a8686"
      hsl: "180 29% 41%"
      label: "Invoiced"
      description: "Invoice issued, awaiting payment"
    status-paid:
      hex: "#3d8c5a"
      hsl: "148 39% 39%"
      label: "Paid"
      description: "Payment received, order closed"
    status-cancelled:
      hex: "#c4625a"
      hsl: "5 48% 56%"
      label: "Cancelled"
      description: "Order terminated before completion"
  destructive:
    destructive:
      hex: "#c4554d"
      hsl: "4 50% 54%"
      usage: "Delete actions, error states, irreversible operations"
    destructive-hover:
      hex: "#a84740"
      hsl: "4 45% 45%"
      usage: "Hover state for destructive actions"
typography:
  level-1-display-xl:
    name: "Display XL"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "3rem"
    fontSizePx: 48
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.04em"
    usage: "Dashboard hero metrics. Maximum one per screen."
  level-2-display:
    name: "Display"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontSizePx: 36
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
    usage: "Page titles, primary KPI values."
  level-3-headline:
    name: "Headline"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontSizePx: 24
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    usage: "Section headers, card titles, modal titles."
  level-4-title-lg:
    name: "Title Large"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontSizePx: 20
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
    usage: "Subsection headers, prominent list group labels."
  level-5-title:
    name: "Title"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontSizePx: 18
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
    usage: "Card sub-headers, form group titles, dialog headings."
  level-6-subtitle:
    name: "Subtitle"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontSizePx: 16
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
    usage: "List item titles, menu section labels, compact headers."
  level-7-body-lg:
    name: "Body Large"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontSizePx: 16
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    usage: "Long-form content, description paragraphs, detail views."
  level-8-body:
    name: "Body"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontSizePx: 14
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
    usage: "Table cells, form fields, general content. Cap at 75ch for prose."
  level-9-body-sm:
    name: "Body Small"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontSizePx: 13
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
    usage: "Dense table cells, secondary metadata, timestamp text."
  level-10-label:
    name: "Label"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontSizePx: 12
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.005em"
    usage: "Form labels, badge text, button text, status indicators."
  level-11-label-sm:
    name: "Label Small"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontSizePx: 11
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.01em"
    usage: "Compact badges, filter chips, tiny UI labels."
  level-12-caption:
    name: "Caption"
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.625rem"
    fontSizePx: 10
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.015em"
    usage: "Footnotes, chart axis labels, legal text, technical IDs."
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
  huge: "96px"
borderRadius:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
elevation:
  ambient-low:
    value: "0 1px 3px rgba(0, 0, 0, 0.08)"
    usage: "Resting state on buttons, interactive chips."
  ambient-medium:
    value: "0 4px 12px rgba(0, 0, 0, 0.08)"
    usage: "Hover state on cards, lifted panels, dropdowns."
  ambient-medium-dark:
    value: "0 4px 12px rgba(0, 0, 0, 0.25)"
    usage: "Dark mode hover on cards and elevated surfaces."
  focused-ring:
    value: "0 0 0 2px hsl(258 87% 84% / 0.5)"
    usage: "Focus-visible ring. Violet-soft glow replacing browser outline."
components:
  button-primary:
    backgroundColor: "{colors.primary.indigo-navy.hex}"
    textColor: "{colors.neutrals.canvas.hex}"
    border: "none"
    borderRadius: "{borderRadius.md}"
    padding: "8px 16px"
    fontSize: "{typography.level-10-label.fontSize}"
    fontWeight: "{typography.level-10-label.fontWeight}"
    height: "36px"
    hover:
      backgroundColor: "{colors.primary.indigo-navy-hover.hex}"
      shadow: "{elevation.ambient-medium.value}"
    focus:
      shadow: "{elevation.focused-ring.value}"
    disabled:
      opacity: "0.5"
      pointerEvents: "none"
  button-primary-pill:
    extends: "button-primary"
    borderRadius: "{borderRadius.full}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.neutrals.ink.hex}"
    border: "1px solid {colors.hairlines.hairline-light.hex}"
    borderRadius: "{borderRadius.md}"
    padding: "8px 16px"
    fontSize: "{typography.level-10-label.fontSize}"
    fontWeight: "{typography.level-10-label.fontWeight}"
    height: "36px"
    hover:
      backgroundColor: "{colors.neutrals.canvas-soft.hex}"
    focus:
      shadow: "{elevation.focused-ring.value}"
    disabled:
      opacity: "0.5"
      pointerEvents: "none"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutrals.ink-mute.hex}"
    border: "none"
    borderRadius: "{borderRadius.md}"
    padding: "8px 12px"
    fontSize: "{typography.level-10-label.fontSize}"
    fontWeight: "{typography.level-10-label.fontWeight}"
    height: "36px"
    hover:
      backgroundColor: "{colors.neutrals.canvas-soft.hex}"
      textColor: "{colors.neutrals.ink.hex}"
    focus:
      shadow: "{elevation.focused-ring.value}"
  button-destructive:
    backgroundColor: "{colors.destructive.destructive.hex}"
    textColor: "{colors.neutrals.canvas.hex}"
    border: "none"
    borderRadius: "{borderRadius.md}"
    padding: "8px 16px"
    fontSize: "{typography.level-10-label.fontSize}"
    fontWeight: "{typography.level-10-label.fontWeight}"
    height: "36px"
    hover:
      backgroundColor: "{colors.destructive.destructive-hover.hex}"
      shadow: "{elevation.ambient-medium.value}"
    focus:
      shadow: "{elevation.focused-ring.value}"
  button-sizes:
    sm:
      height: "32px"
      padding: "4px 12px"
      fontSize: "{typography.level-11-label-sm.fontSize}"
    default:
      height: "36px"
      padding: "8px 16px"
      fontSize: "{typography.level-10-label.fontSize}"
    lg:
      height: "40px"
      padding: "10px 24px"
      fontSize: "{typography.level-10-label.fontSize}"
    icon:
      height: "36px"
      width: "36px"
      padding: "0"
  card:
    backgroundColor: "{colors.neutrals.canvas.hex}"
    border: "1px solid {colors.hairlines.hairline-light.hex}"
    borderRadius: "{borderRadius.lg}"
    padding: "24px"
    shadow: "none"
    hover:
      shadow: "{elevation.ambient-medium.value}"
    darkMode:
      backgroundColor: "{colors.primary.indigo-navy.hex}"
      border: "1px solid {colors.hairlines.hairline-dark.hex}"
  kpi-card:
    extends: "card"
    padding: "20px"
    hover:
      shadow: "{elevation.ambient-medium.value}"
  data-table-container:
    extends: "card"
    padding: "0"
    overflow: "hidden"
  input:
    backgroundColor: "{colors.neutrals.canvas.hex}"
    textColor: "{colors.neutrals.ink.hex}"
    border: "1px solid {colors.hairlines.hairline-light.hex}"
    borderRadius: "{borderRadius.md}"
    padding: "8px 12px"
    fontSize: "{typography.level-8-body.fontSize}"
    height: "36px"
    placeholder:
      textColor: "{colors.neutrals.ink-faint.hex}"
    focus:
      borderColor: "{colors.primary.indigo-navy.hex}"
      shadow: "{elevation.focused-ring.value}"
    error:
      borderColor: "{colors.destructive.destructive.hex}"
    disabled:
      opacity: "0.5"
      cursor: "not-allowed"
    darkMode:
      backgroundColor: "{colors.primary.indigo-navy.hex}"
      border: "1px solid {colors.hairlines.hairline-dark.hex}"
  textarea:
    extends: "input"
    height: "auto"
    minHeight: "80px"
    resize: "vertical"
  select:
    extends: "input"
  badge-default:
    backgroundColor: "{colors.primary.indigo-navy.hex}"
    textColor: "{colors.neutrals.canvas.hex}"
    borderRadius: "{borderRadius.sm}"
    padding: "2px 8px"
    fontSize: "{typography.level-11-label-sm.fontSize}"
    fontWeight: 500
  badge-secondary:
    backgroundColor: "{colors.neutrals.canvas-soft.hex}"
    textColor: "{colors.neutrals.ink-mute.hex}"
    border: "1px solid {colors.hairlines.hairline-light.hex}"
    borderRadius: "{borderRadius.sm}"
    padding: "2px 8px"
    fontSize: "{typography.level-11-label-sm.fontSize}"
    fontWeight: 500
  badge-status:
    borderRadius: "{borderRadius.sm}"
    padding: "2px 8px"
    fontSize: "{typography.level-11-label-sm.fontSize}"
    fontWeight: 500
    icon:
      size: "12px"
      mandatory: true
    lightMode:
      pattern: "Tinted background (status color at 12% opacity), dark text (status color), 1px border (status color at 30% opacity)"
    darkMode:
      pattern: "Tinted background (status color at 18% opacity), light text (status color lightened 20%), 1px border (status color at 40% opacity)"
  sidebar:
    backgroundColor: "{colors.primary.indigo-navy.hex}"
    textColor: "{colors.neutrals.ink-faint.hex}"
    width: "240px"
    position: "fixed left"
    height: "100vh"
    item:
      padding: "10px 16px"
      borderRadius: "{borderRadius.md}"
      fontSize: "{typography.level-8-body.fontSize}"
      fontWeight: 400
      textColor: "{colors.neutrals.ink-faint.hex}"
      hover:
        backgroundColor: "rgba(255, 255, 255, 0.06)"
        textColor: "{colors.neutrals.canvas.hex}"
      active:
        backgroundColor: "rgba(255, 255, 255, 0.1)"
        textColor: "{colors.neutrals.canvas.hex}"
        fontWeight: 500
        borderLeft: "2px solid {colors.secondary.violet-soft.hex}"
    sectionLabel:
      textColor: "rgba(255, 255, 255, 0.4)"
      fontSize: "{typography.level-11-label-sm.fontSize}"
      fontWeight: 500
      letterSpacing: "0.05em"
      textTransform: "uppercase"
      padding: "16px 16px 4px"
  navbar:
    mobile:
      display: "flex"
      backgroundColor: "{colors.primary.indigo-navy.hex}"
      textColor: "{colors.neutrals.canvas.hex}"
      height: "56px"
      padding: "0 16px"
      alignItems: "center"
      justifyContent: "space-between"
    desktop:
      display: "none"
    hamburger:
      color: "{colors.neutrals.canvas.hex}"
      size: "24px"
---

# Design System: MSN ERP

## 1. Overview

**Creative North Star: "The Precision Operations Room"**

MSN ERP is an operational tool, not a marketing surface. This design system adapts Superhuman's design language, a system built for speed, density, and clarity, for the unique demands of an ERP dashboard. Every pixel serves a function: the admin needs to assign a technician in seconds, the finance user needs to trace an invoice instantly, and the field technician needs to update a job status with one thumb while holding a toolbox.

The personality is **Refined, Technical, Quiet**. Clean but not sterile. Considered but not ornate. The interface earns trust through consistency: the same button shape on every screen, the same status color meaning across every module, the same loading pattern for every async action. Users should never pause to decode the UI; they should pause only to make a business decision.

**Key Characteristics:**

- **Indigo navy (#1b1938)** anchors the system as both the primary action color and the dark mode canvas. It is the only color that carries brand identity.
- **Warm neutrals** (canvas, ink family) replace cold corporate grays. The interface feels human, not clinical.
- **Violet-soft (#c9b4fa)** serves as the subtle accent for highlights, selections, and focus rings. It appears sparingly, so when it does, it means something.
- **Flat surfaces at rest; shadows appear only on hover or focus.** Cards use a 1px hairline border for structural separation; lift is earned through interaction.
- **Status colors are semantic, consistent, and icon-augmented.** Never rely on color alone to communicate an order's lifecycle stage.
- **All motion conveys state change, not decoration.** Transitions are fast (150-200ms), purposeful, and respect `prefers-reduced-motion`.
- **Mobile-first for the technician PWA; desktop-optimized for admin and finance.**
- **Indonesian language for all user-facing labels, button text, and status names.**

---

## 2. Color System

The palette is intentionally restrained. One primary, three secondary accents, a warm neutral family, one set of semantic status colors, and two hairline colors for structure. Everything else is a tint or shade of these.

### 2.1 Primary

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `indigo-navy` | `#1b1938` | `hsl(244 38% 16%)` | Primary actions, active navigation, dark mode canvas, deep backgrounds |
| `indigo-navy-hover` | `#2d2a52` | `hsl(245 32% 24%)` | Hover state for indigo-navy surfaces and buttons |

**Rule: The One Accent Rule.** Indigo navy is the only color used for primary CTAs, active states, and brand identity. If a screen introduces a competing accent color for decoration, it is wrong. Status colors are semantic, not decorative.

### 2.2 Secondary

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `violet-soft` | `#c9b4fa` | `hsl(258 87% 84%)` | Subtle highlight, selected states, focus rings, accent touches |
| `violet-soft-hover` | `#b8a0f0` | `hsl(258 73% 78%)` | Hover state for violet-soft surfaces |
| `teal-deep` | `#0e3030` | `hsl(180 55% 12%)` | Deep accent, metric highlights, emphasis cards, chart series |
| `teal-mid` | `#3d7a7a` | `hsl(180 33% 36%)` | Mid accent, secondary metrics, info states, supportive data |

**Rule: Violet is signal, not decoration.** Violet-soft appears only on interactive elements that need attention (focus rings, selected rows, active filters). Every appearance carries meaning.

### 2.3 Neutrals

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `canvas` | `#ffffff` | `hsl(0 0% 100%)` | Page background, card surface, popover background |
| `canvas-soft` | `#fafaf8` | `hsl(60 17% 98%)` | Secondary backgrounds, sidebar surface on light mode, hover tints |
| `ink` | `#292827` | `hsl(30 3% 16%)` | Primary text, headings, high-emphasis content |
| `ink-mute` | `#73706d` | `hsl(30 3% 44%)` | Secondary text, descriptions, placeholder values |
| `ink-faint` | `#9a9794` | `hsl(30 3% 59%)` | Disabled text, tertiary labels, timestamps, non-critical metadata |

Unlike the cold blue-gray neutrals common in shadcn/ui defaults, this neutral family has a subtle warmth (30° hue). The effect is barely perceptible at small sizes but creates a more human, less clinical feeling across full screens.

### 2.4 Hairlines (Borders & Dividers)

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `hairline-light` | `#e8e4dd` | `hsl(38 19% 89%)` | Light mode: borders, dividers, input strokes, card edges, table gridlines |
| `hairline-dark` | `#3f3a52` | `hsl(253 17% 27%)` | Dark mode: borders, dividers, input strokes, card edges, table gridlines |

Hairlines are always 1px. Never use a thicker border for emphasis, use spacing or background contrast instead. The warm tone of the light hairline (`#e8e4dd`) prevents the "cold wireframe" feeling of pure gray borders.

### 2.5 Destructive

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `destructive` | `#c4554d` | `hsl(4 50% 54%)` | Delete actions, error states, cancelled orders, irreversible operations |
| `destructive-hover` | `#a84740` | `hsl(4 45% 45%)` | Hover state for destructive buttons |

The destructive red is muted, not aggressive. A fire-engine red (`#ef4444`) screams "alert" on every screen. The Superhuman approach uses a deeper, more restrained red that signals danger without causing visual fatigue. It is consistently paired with an icon (trash, x-circle, alert-triangle) to ensure accessibility.

### 2.6 Status Colors

The eight order lifecycle states are the most critical semantic colors in the system. Each maps to a specific operational meaning and must be instantly distinguishable from the others.

| Status | Hex | HSL | Operational Meaning |
|--------|-----|-----|---------------------|
| Pending | `#c1914b` | `hsl(37 49% 53%)` | Order received, awaiting assignment. Warm amber suggests "waiting." |
| Assigned | `#5b7fbf` | `hsl(216 44% 55%)` | Technician assigned, not yet dispatched. Trustworthy steel blue suggests "designated." |
| En-route | `#5b8faa` | `hsl(201 32% 51%)` | Technician traveling to site. Cool blue-gray suggests "in transit." |
| In Progress | `#9b7fc4` | `hsl(265 38% 63%)` | Work being performed on site. Violet suggests "active engagement." |
| Completed | `#4a8c6f` | `hsl(155 31% 42%)` | Service finished, awaiting invoicing. Muted teal-green suggests "done, but not closed." |
| Invoiced | `#4a8686` | `hsl(180 29% 41%)` | Invoice issued, awaiting payment. Teal suggests "financial document." |
| Paid | `#3d8c5a` | `hsl(148 39% 39%)` | Payment received, order closed. Deeper green suggests "settled, final." |
| Cancelled | `#c4625a` | `hsl(5 48% 56%)` | Order terminated before completion. Muted red suggests "ended, not failed." |

**Design rationale:** These colors are deliberately muted compared to typical SaaS status palettes. Saturation ranges from 29% to 53%, and lightness from 39% to 56%. This creates a consistent visual weight: no single status screams louder than another. The palette is sophisticated enough that a screen filled with badges does not become a rainbow, yet each color remains clearly distinguishable.

**Status badge pattern (light mode):**
- Background: status color at 12% opacity
- Text: status hex value, full opacity
- Border: status color at 30% opacity, 1px
- Icon: mandatory, 12px, matching text color
- Example: Pending badge = `bg-[#c1914b]/[.12] text-[#c1914b] border border-[#c1914b]/[.30]`

**Status badge pattern (dark mode):**
- Background: status color at 18% opacity
- Text: status color lightened by 20%
- Border: status color at 40% opacity, 1px
- Icon: mandatory, 12px, matching text color

**Rule: Icon augmentation is mandatory.** Every status badge MUST include an icon. Color alone is an accessibility failure. Icon mapping:

| Status | Icon |
|--------|------|
| Pending | `Clock` |
| Assigned | `UserCheck` |
| En-route | `Truck` |
| In Progress | `Wrench` |
| Completed | `CheckCircle` |
| Invoiced | `FileText` |
| Paid | `Banknote` (or `DollarSign`) |
| Cancelled | `XCircle` |

---

## 3. Typography

**Typeface:** Inter (with system-ui, -apple-system, sans-serif fallback). Inter is a technical, neutral sans-serif optimized for screen reading at small sizes. It reads as precise and modern without calling attention to itself.

**Weight palette:** Regular (400) for body, Medium (500) for labels and emphasis, Semibold (600) for headings. Bold (700) is reserved for Display XL only when needed; otherwise, Semibold provides sufficient hierarchy.

### 3.1 12-Level Scale

| Level | Name | Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Usage |
|-------|------|-----------|------------|--------|-------------|----------------|-------|
| 1 | Display XL | 48 | 3rem | 600 | 1.1 | -0.04em | Dashboard hero metrics. Maximum one per screen. |
| 2 | Display | 36 | 2.25rem | 600 | 1.2 | -0.03em | Page titles, primary KPI values. |
| 3 | Headline | 24 | 1.5rem | 600 | 1.25 | -0.02em | Section headers, card titles, modal titles. |
| 4 | Title LG | 20 | 1.25rem | 600 | 1.3 | -0.01em | Subsection headers, prominent list group labels. |
| 5 | Title | 18 | 1.125rem | 600 | 1.35 | normal | Card sub-headers, form group titles, dialog headings. |
| 6 | Subtitle | 16 | 1rem | 500 | 1.4 | normal | List item titles, menu section labels, compact headers. |
| 7 | Body LG | 16 | 1rem | 400 | 1.5 | normal | Long-form content, description paragraphs, detail views. |
| 8 | Body | 14 | 0.875rem | 400 | 1.55 | normal | Table cells, form fields, general content. Cap prose at 75ch. |
| 9 | Body SM | 13 | 0.8125rem | 400 | 1.55 | normal | Dense table cells, secondary metadata, timestamp text. |
| 10 | Label | 12 | 0.75rem | 500 | 1.5 | 0.005em | Form labels, badge text, button text, status indicators. |
| 11 | Label SM | 11 | 0.6875rem | 500 | 1.5 | 0.01em | Compact badges, filter chips, tiny UI labels. |
| 12 | Caption | 10 | 0.625rem | 400 | 1.5 | 0.015em | Footnotes, chart axis labels, legal text, technical IDs. |

**Key distinctions from the marketing-focused Superhuman spec:**

- This is a **12-level scale** optimized for data density. Marketing sites typically use 5-7 levels. An ERP dashboard needs Body (14px) and Body SM (13px) as separate levels because a 1px difference at table scale changes row count significantly.
- **Display XL (48px)** is added for KPI hero numbers (revenue totals, order counts). It is larger than Superhuman's standard display but necessary for dashboard scanning.
- **Negative letter-spacing** is applied only to display sizes (48px, 36px, 24px). Below 20px, tracking stays at normal or slightly positive. Tight tracking on body text reduces readability.
- **Label SM (11px)** and **Caption (10px)** are added for dense UI elements. These sizes are too small for marketing but essential for compact badges, filter chips, and chart annotations.

### 3.2 Named Typography Rules

**The No-Display-in-UI Rule.** Display XL (48px) and Display (36px) are for page-level metrics only. Never use them inside cards, tables, or forms. Operational UI requires density, not drama.

**The One-Weight-Jump Rule.** Hierarchy within a component should use at most one weight step. A card with Semibold title, Medium subtitle, and Regular body is clean. A card with Bold title, Semibold subtitle, Medium metadata, and Regular body is too many weights. Users should perceive groupings, not a weight taxonomy.

**The Monospace Exception.** Technical identifiers (order IDs, AC unit serial numbers, invoice numbers) should use a monospace variant: `font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 0.8125rem;` at the same line-height as Body SM (1.55). Monospace signals "this is a machine identifier, not prose."

---

## 4. Spacing

The spacing system uses an 8px base unit. Multiples of 8 create rhythm across the interface. The system includes tokens from 4px (half-unit for tight spaces) through 96px (for large section breaks).

| Token | Value | rem | Use Case |
|-------|-------|-----|----------|
| `xxs` | 4px | 0.25rem | Icon-to-text gap, tight inline spacing, badge internal padding |
| `xs` | 8px | 0.5rem | Compact gaps, input internal padding, small icon buttons |
| `sm` | 12px | 0.75rem | List item gaps, form field gaps, compact card padding |
| `md` | 16px | 1rem | Default gap, standard card padding, sidebar item padding |
| `lg` | 24px | 1.5rem | Section gaps, card internal padding, modal padding |
| `xl` | 32px | 2rem | Page section gaps, large component separation |
| `2xl` | 48px | 3rem | Major layout sections, page header to content gap |
| `3xl` | 64px | 4rem | Page-level separation, hero section spacing |
| `huge` | 96px | 6rem | Reserved for full-page layouts and extreme whitespace |

**Implementation note:** In the Tailwind config, these map to the default spacing scale (e.g., `p-6` = 24px = `lg`). The design token names are used in documentation and component specs; the actual CSS uses Tailwind utility classes.

---

## 5. Border Radius

The radius scale is deliberately tight. Superhuman uses subtle rounding to feel precise rather than playful. The default interactive element radius is `md` (6px), which provides enough softening to feel modern without the "pillow" effect of larger radii.

| Token | Value | rem | Use Case |
|-------|-------|-----|----------|
| `xs` | 2px | 0.125rem | Sharp corners: code blocks, monospace containers, inner elements |
| `sm` | 4px | 0.25rem | Badges, filter chips, tiny interactive surfaces |
| `md` | 6px | 0.375rem | **Default interactive radius.** Buttons, inputs, selects, sidebar items |
| `lg` | 8px | 0.5rem | Cards, modals, dropdowns, popovers |
| `xl` | 12px | 0.75rem | Large containers, KPI cards, dashboard panels |
| `2xl` | 16px | 1rem | Hero sections, oversized containers |
| `full` | 9999px | — | Pill-shaped buttons, circular avatars, round indicators |

**Button shapes:**
- **Rounded-rect (default):** `md` radius (6px). Used for all standard buttons. This is the primary button shape.
- **Pill:** `full` radius. Reserved for filter chips, toggle groups, and segmented controls. Never use pill shape for a primary CTA, it is too decorative for a single decisive action.

---

## 6. Elevation & Shadows

The system is **flat by default, layered on demand.** Surfaces rest flat against the background. Shadows emerge only as a response to state: hover, focus, or elevation of a temporary element (popover, dropdown, modal).

There is no persistent card shadow as a default style. Cards and tables use a 1px hairline border for structural separation; the shadow is earned through interaction.

### 6.1 Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `ambient-low` | `0 1px 3px rgba(0, 0, 0, 0.08)` | Resting state on buttons and small interactive elements. Barely perceptible; provides tactile grounding. |
| `ambient-medium` | `0 4px 12px rgba(0, 0, 0, 0.08)` | Hover state on cards, KPI cards, data tables, dropdowns. Lifts the element without detaching it from the surface. |
| `ambient-medium-dark` | `0 4px 12px rgba(0, 0, 0, 0.25)` | Dark mode equivalent of ambient-medium. Increased opacity compensates for the darker background. |
| `focused-ring` | `0 0 0 2px hsl(258 87% 84% / 0.5)` | Focus-visible treatment on all interactive elements. Uses violet-soft at 50% opacity instead of the browser's default outline. |

### 6.2 Elevation Rules

**The Flat-by-Default Rule.** Surfaces are flat at rest. If a card has a shadow without being hovered or focused, the shadow is too heavy. Use a 1px hairline border (`border-hairline-light`) for structural separation instead.

**The One-Layer-Up Rule.** Only one element on screen should have an active shadow at any time (the hovered card, the open dropdown, the focused input). Avoid stacking shadows, which creates visual noise and confuses z-index perception.

**The No-Box-Shadow-on-Text Rule.** Text never gets `text-shadow`. If text needs emphasis, use weight, size, or color. Text shadows belong to marketing hero sections, not operational dashboards.

---

## 7. Dark Mode

Dark mode is first-class, not an afterthought. Indigo navy (`#1b1938`) serves as the dark mode canvas, creating a seamless transition from the primary brand color to the dark theme.

### 7.1 Dark Mode Token Mapping

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| Page background | `canvas` (#ffffff) | `indigo-navy` (#1b1938) |
| Card surface | `canvas` (#ffffff) | `indigo-navy` (#1b1938) with `hairline-dark` border |
| Secondary background | `canvas-soft` (#fafaf8) | `#24213d` (indigo-navy lightened 8%) |
| Primary text | `ink` (#292827) | `canvas` (#ffffff) |
| Secondary text | `ink-mute` (#73706d) | `#b8b5b2` (ink-faint lightened) |
| Disabled text | `ink-faint` (#9a9794) | `#6b6870` (ink-mute darkened) |
| Borders | `hairline-light` (#e8e4dd) | `hairline-dark` (#3f3a52) |
| Focus ring | `violet-soft` at 50% | `violet-soft` at 40% (slightly more transparent on dark) |
| Status badges | Status color at 12% bg | Status color at 18% bg, lightened text |
| Shadows | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.25)` |

### 7.2 Dark Mode Rules

**The Parity Rule.** Every light-mode token has a dark-mode counterpart. Status badges, borders, and backgrounds all shift together. Never leave a status color unadapted for dark mode.

**The Deep Navy Rule.** The dark mode canvas is not pure black and not a cold gray. Indigo navy (`#1b1938`) has enough hue to feel intentional and enough depth (16% lightness) to provide sufficient contrast with white text. Pure black (`#000`) is not used anywhere; it creates too much contrast and causes eye strain during extended use.

**The Elevated Surface Rule.** In dark mode, elevated surfaces (modals, dropdowns, popovers) should use a slightly lighter shade (`#24213d`) with a `hairline-dark` border. This creates a subtle but perceptible separation from the background without relying on shadows (which are less visible on dark backgrounds).

---

## 8. Component Specifications

### 8.1 Buttons

Buttons are the most frequent interactive element in the dashboard: assign technician, save invoice, approve request, confirm delete. The design must communicate action hierarchy clearly.

**Shape:** Two shapes only, `rounded-rect` (6px radius, default) and `pill` (full radius, for filter chips and toggle groups).

**Primary Button (rounded-rect):**
- Background: `indigo-navy` (#1b1938)
- Text: `canvas` (#ffffff), Label (12px, 500 weight)
- Height: 36px (h-9), padding: 8px 16px (px-4)
- Resting: `ambient-low` shadow
- Hover: background shifts to `indigo-navy-hover` (#2d2a52), shadow becomes `ambient-medium`
- Focus-visible: `focused-ring` (violet-soft glow)
- Disabled: 50% opacity, `pointer-events-none`
- Transition: `transition-colors duration-150`

**Secondary Button (outline):**
- Background: transparent
- Text: `ink` (#292827), Label (12px, 500 weight)
- Border: 1px `hairline-light` (#e8e4dd)
- Height: 36px (h-9), padding: 8px 16px (px-4)
- Hover: background fills to `canvas-soft` (#fafaf8)
- Focus-visible: `focused-ring`
- Disabled: 50% opacity

**Ghost Button:**
- Background: transparent
- Text: `ink-mute` (#73706d)
- Height: 36px (h-9), padding: 8px 12px (px-3)
- Hover: background fills to `canvas-soft`, text darkens to `ink`
- Used for icon-only buttons and low-priority actions

**Destructive Button:**
- Background: `destructive` (#c4554d)
- Text: `canvas` (#ffffff)
- Height: 36px (h-9), padding: 8px 16px (px-4)
- Hover: background shifts to `destructive-hover` (#a84740), `ambient-medium` shadow
- Used only for irreversible actions: delete, cancel order, void invoice
- Always appears with a confirmation dialog (never fires immediately on click)

**Button Sizes:**

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| `sm` | 32px (h-8) | 4px 12px | Label SM (11px) |
| `default` | 36px (h-9) | 8px 16px | Label (12px) |
| `lg` | 40px (h-10) | 10px 24px | Label (12px) |
| `icon` | 36px (h-9 × w-9) | 0 | — |

**Named Rules:**

- **The No-Pill-Primary Rule.** Pill shape is for filter chips and toggle groups only. A primary CTA should use rounded-rect (6px radius). Pill-shaped primary buttons look like marketing CTAs, not operational tools.
- **The Destructive Confirmation Rule.** Destructive buttons never act on single click. They must trigger a confirmation dialog (or use a two-step pattern: "Click to confirm" button that changes label). This prevents accidental data loss in high-stakes ERP operations.
- **The Button-Width Floor Rule.** Buttons should never be narrower than 80px (except icon-only buttons). A 60px-wide "Save" button is hard to click and looks broken. If content is naturally narrow, use `min-w-[80px]`.

### 8.2 Cards

**Default Card:**
- Background: `canvas` (#ffffff, light mode) / `indigo-navy` (#1b1938, dark mode)
- Border: 1px `hairline-light` (light) / `hairline-dark` (dark)
- Border radius: `lg` (8px)
- Padding: 24px (p-6)
- Resting: no shadow
- Hover: `ambient-medium` shadow (light) / `ambient-medium-dark` (dark)
- Transition: `transition-shadow duration-200`

**KPI Card (`.kpi-card`):**
- Extends default card
- Padding: 20px (p-5)
- Often contains a Display or Display XL metric value
- Hover lift is more pronounced to encourage exploration
- Used for revenue totals, order counts, technician performance metrics

**Data Table Container (`.data-table-container`):**
- Extends default card
- Padding: 0 (the table inside handles its own padding)
- Overflow: hidden (contains the table's horizontal scroll)
- Always uses a hairline border on all four sides

### 8.3 Inputs & Form Controls

**Text Input:**
- Background: `canvas` (#ffffff)
- Border: 1px `hairline-light` (#e8e4dd)
- Border radius: `md` (6px)
- Height: 36px (h-9, matching default button height for alignment)
- Padding: 8px 12px (px-3)
- Font: Body (14px, 400 weight)
- Placeholder: `ink-faint` (#9a9794)
- Focus: border shifts to `indigo-navy`, `focused-ring` appears
- Error: border shifts to `destructive` (#c4554d), error message below in `destructive` at Label size
- Disabled: 50% opacity, `cursor-not-allowed`, no focus ring
- Dark mode: background is `indigo-navy`, border is `hairline-dark`

**Textarea:**
- Extends text input
- Min-height: 80px, height: auto, resize: vertical
- Used for service report notes, customer addresses, invoice descriptions

**Select / Dropdown:**
- Extends text input
- Custom chevron icon on the right (replaces native select styling)
- Dropdown panel: `canvas` background, `lg` radius (8px), `ambient-medium` shadow, 1px hairline border

**Checkbox / Radio:**
- Size: 16px × 16px
- Border: 1px `hairline-light`, radius 3px (checkbox) / `full` (radio)
- Checked: `indigo-navy` background with white checkmark
- Focus-visible: `focused-ring`

### 8.4 Badges

**Default Badge:**
- Background: `indigo-navy` (#1b1938)
- Text: `canvas` (#ffffff), Label SM (11px, 500 weight)
- Border radius: `sm` (4px)
- Padding: 2px 8px (py-0.5 px-2)
- Used for counts, primary labels, active filter indicators

**Secondary Badge:**
- Background: `canvas-soft` (#fafaf8)
- Text: `ink-mute` (#73706d)
- Border: 1px `hairline-light`
- Border radius: `sm` (4px)
- Padding: 2px 8px
- Used for neutral tags, inactive items, non-critical metadata

**Status Badges (see Section 2.6 for full specs):**
- Each of the 8 order statuses has its own badge variant
- Tinted background, dark text, 1px border, mandatory icon
- Font: Label SM (11px, 500 weight)
- Icon: 12px, always present, always aligned with text baseline

### 8.5 Sidebar

**Desktop (≥1024px):**
- Fixed left position, 240px width, 100vh height
- Background: `indigo-navy` (#1b1938)
- Top section: app logo/name with 24px padding
- Middle section: scrollable navigation items
- Bottom section: user info, role badge, logout button

**Sidebar Items:**
- Layout: horizontal row, icon (20px) + label + optional badge
- Padding: 10px 16px (py-2.5 px-4)
- Border radius: `md` (6px)
- Default state: text color `#b8b5b2` (ink-faint lightened for dark bg), weight 400
- Hover state: background `rgba(255, 255, 255, 0.06)`, text `canvas` (#ffffff)
- Active state: background `rgba(255, 255, 255, 0.1)`, text `canvas` (#ffffff), weight 500, left border 2px `violet-soft`
- Transition: `transition-all duration-150`

**Sidebar Section Labels:**
- Text: `rgba(255, 255, 255, 0.4)`, Label SM (11px), weight 500
- Letter-spacing: 0.05em, uppercase
- Padding: 16px 16px 4px (pt-4 px-4 pb-1)
- Used to group navigation items (e.g., "OPERATIONS", "FINANCE", "SYSTEM")

**Sidebar Collapse:**
- On screens between 768px and 1024px, sidebar collapses to icon-only mode (64px width)
- Labels are hidden; icons remain visible at 20px
- Active indicator becomes a 2px left border only
- Hovering a collapsed item shows a tooltip with the full label

### 8.6 Navbar (Mobile)

**Mobile (<768px):**
- Horizontal bar, 56px height, full width
- Background: `indigo-navy` (#1b1938)
- Layout: hamburger menu button (left), page title (center), user avatar or action button (right)
- Padding: 0 16px (px-4)
- Items vertically centered with flexbox
- Hamburger icon: 24px, `canvas` color
- Tapping hamburger opens the sidebar as a slide-out sheet (shadcn Sheet component)

**Desktop (≥1024px):**
- No top navbar. The sidebar provides all navigation. Page content fills the remaining space.

**Touch targets (mobile):**
- All interactive elements maintain minimum 44px × 44px touch target
- Sidebar items have increased vertical padding (12px 16px) on touch devices
- Buttons in mobile technician view use `lg` size (40px height) by default

---

## 9. Dashboard Adaptations from Superhuman

The Superhuman design language was built for an email client: a single-purpose, high-speed tool with one primary surface (the inbox). An ERP dashboard has fundamentally different needs: multiple modules, dense data, status tracking, and role-based views. These adaptations make the design system practical for the ERP context while preserving the Superhuman aesthetic.

### 9.1 What Was Kept

- **The restrained color palette.** Indigo navy as the anchor, warm neutrals, one subtle accent (violet-soft). The discipline of saying "no" to extra colors.
- **Flat-by-default surfaces.** Cards use hairline borders, not persistent shadows. Lift is earned through interaction.
- **The typographic philosophy.** Inter only, weight contrast for hierarchy, no decorative type treatments.
- **Fast transitions (150-200ms).** Motion conveys state change, not personality.
- **Dark mode as first-class.** Indigo navy as the dark canvas is a direct Superhuman inheritance.
- **The hairline approach to borders.** 1px, warm-tinted, consistent everywhere.

### 9.2 What Was Adapted

**Expanded typography scale (5 levels → 12 levels).**
Superhuman's email client needs maybe 5 text sizes. An ERP dashboard needs Display XL (48px) for KPI hero numbers, Body SM (13px) for dense table cells, and Caption (10px) for chart annotations. The scale was extended downward for density and upward for dashboard scanning.

**Status color system (0 → 8 semantic colors).**
Superhuman has no need for status colors. In an ERP, the order lifecycle (Pending through Paid, plus Cancelled) is the central visual language. These 8 colors were designed with deliberately similar saturation (29-53%) and lightness (39-56%) so they carry equal visual weight. No status screams louder than another.

**Sidebar navigation pattern.**
Superhuman uses a left sidebar for folder navigation. We inherited the dark sidebar concept but adapted it: 240px width (wider than Superhuman's, to accommodate Indonesian labels which are longer than English), section labels for module grouping, and a collapse mode for tablet screens. The active indicator (2px violet-soft left border) is a direct Superhuman pattern.

**Card variants for data density.**
Superhuman's cards are for email threads. We added `.kpi-card` (metric display) and `.data-table-container` (zero-padding, overflow-hidden for tables) as ERP-specific card variants. Both follow the same border/shadow/hover rules as the base card.

**Destructive color as a first-class token.**
Superhuman rarely needs destructive actions. An ERP dashboard has delete, cancel, void, and refund operations daily. The destructive red was given its own token, hover state, and confirmation-pattern rule.

**Monospace exception for technical identifiers.**
Order IDs, serial numbers, and invoice codes appear everywhere in the dashboard. The monospace rule (Section 3.2) signals "this is machine data" without relying on color or the user's domain knowledge.

**Mobile navbar + slide-out sidebar.**
Superhuman is primarily desktop. The technician PWA requires a mobile-first navigation pattern: a 56px top navbar with hamburger trigger, sidebar as a slide-out sheet, and 44px minimum touch targets. This is a structural adaptation, not a visual one.

### 9.3 What Was Rejected

- **Hero sections with large illustrations.** This is a tool, not a landing page. The dashboard's "hero" is the most important metric on screen, displayed in Display XL.
- **Customer testimonial layouts.** Not applicable.
- **Pricing tier cards.** Not applicable.
- **Marketing-focused copy patterns.** No taglines, no value propositions, no "Trusted by X companies." The only copy is operational: status labels, button text, table headers, form labels.
- **Gradient text or decorative blur effects.** These belong to marketing. The dashboard uses flat color and hairline borders exclusively.
- **Portrait photography subjects.** The only images in the dashboard are technician avatars (small, circular) and service report photos (functional documentation, not decorative).
- **Animated page transitions or scroll-triggered effects.** Transitions are limited to component-level state changes (hover, focus, active). Page-level animation adds latency to an operational tool.

---

## 10. Do's and Don'ts

### 10.1 Do

- **Do** use indigo navy (#1b1938) for primary actions, active navigation, and dark mode backgrounds only. Its rarity is its power.
- **Do** pair every status badge with an icon. Color conveys category; icon conveys meaning. This is mandatory for accessibility and is non-negotiable.
- **Do** use 1px hairline borders (`hairline-light` or `hairline-dark`) for all structural separation. Never use a 2px border for emphasis; use spacing or background contrast instead.
- **Do** respect `prefers-reduced-motion` for all transitions and animations. The technician PWA may run on low-end devices in the field.
- **Do** maintain 44px minimum touch targets on all interactive elements in the technician PWA routes.
- **Do** use Indonesian for all user-facing labels, button text, status names, and error messages.
- **Do** use skeleton loaders for initial page loads and empty tables. Never show a blank white screen or a centered spinner in content areas.
- **Do** cap body text line length at 75 characters for prose content (descriptions, notes, instructions).
- **Do** use the monospace font stack for technical identifiers: order IDs, serial numbers, invoice codes.
- **Do** include a confirmation step for every destructive action. An accidental "Cancel Order" click without confirmation can cost real money.

### 10.2 Don't

- **Don't** introduce a second accent color beyond violet-soft. If you need another highlight color, adjust the opacity of violet-soft or use teal-deep/teal-mid for data visualization only.
- **Don't** rely on color alone to communicate state. A red "Cancelled" badge without an X icon is an accessibility failure. A green "Paid" badge without a checkmark is ambiguous.
- **Don't** use gradient text, glassmorphism, or decorative blur effects. This is an operational tool, not a marketing campaign.
- **Don't** apply shadows to cards at rest. The Flat-by-Default Rule keeps surfaces grounded. Shadows are for hover and focus only.
- **Don't** use display fonts, uppercase body text, or marketing-style copy. Inter in sentence case is the only voice for operational content.
- **Don't** build custom scrollbars, non-standard form controls, or unconventional modal behaviors. Standard affordances earn user trust and familiarity.
- **Don't** use Display XL (48px) or Display (36px) inside cards or tables. These sizes are for page-level hero metrics only.
- **Don't** put more than one element with an active shadow on screen at a time. The One-Layer-Up Rule prevents visual noise.
- **Don't** use pill-shaped buttons for primary CTAs. Pill shape is for filter chips, toggle groups, and segmented controls.
- **Don't** leave a status color unadapted for dark mode. The Parity Rule applies to every token.
- **Don't** use pure black (#000) or pure white text on dark backgrounds. Use the token system: `ink` for light text on `indigo-navy`, `canvas` for white text.

---

## 11. Responsive Behavior

### 11.1 Breakpoints

| Breakpoint | Min Width | Target | Layout |
|------------|-----------|--------|--------|
| `mobile` | 320px | Technician PWA, narrow admin | Full-width content, 56px top navbar, slide-out sidebar |
| `tablet` | 768px | Tablet admin, landscape mobile | Collapsed sidebar (64px icons), content fills remainder |
| `desktop` | 1024px | Admin, finance, superadmin | Full sidebar (240px) visible, content fills remainder |
| `wide` | 1280px | Large monitors, multi-panel | Full sidebar, content constrained to 1200px max-width for readability |

### 11.2 Mobile-First Approach

All components are built mobile-first. The technician PWA is the most constrained environment (small screen, direct sunlight, one-handed use, potentially low connectivity). Design decisions that work on mobile cascade upward.

**Mobile-specific rules:**
- All interactive elements: minimum 44px × 44px touch target
- Buttons default to `lg` size (40px height) on touch devices
- Form inputs: full width, stacked vertically (never side-by-side)
- Tables: horizontal scroll with sticky first column (order ID or customer name)
- Sidebar: hidden by default, revealed via hamburger → slide-out sheet
- Modals: full-screen on mobile (not centered popovers)
- Spacing: reduce card padding from 24px to 16px on mobile to preserve content density
- Status badges: icon + short text only (e.g., icon + "Proses" instead of icon + "Dalam Pengerjaan")

### 11.3 Desktop Optimization

On desktop (≥1024px), the interface optimizes for information density and multi-tasking:

- Sidebar is permanently visible (240px)
- Tables use full available width with all columns visible
- Cards can arrange in 2-3 column grids
- Forms can use side-by-side field layouts for related inputs (e.g., start date + end date, first name + last name)
- KPI cards arrange in a horizontal row (4-5 across on wide screens)
- Modals appear as centered panels (max-width 560px) with backdrop overlay
- Keyboard shortcuts are available for power users (e.g., `/` to focus search, `Esc` to close modals)

### 11.4 Print Styles

Invoices and service reports must print cleanly:

- Background colors are removed (white paper)
- Status badges become text + icon only (no colored backgrounds)
- Indigo navy elements become black
- Hairline borders remain at 0.5px for structure
- Page breaks avoid splitting table rows
- Font sizes remain unchanged (14px Body prints legibly)
- The sidebar, navbar, and all interactive elements are hidden

---

## 12. Implementation Notes

### 12.1 CSS Custom Properties

All design tokens are defined as CSS custom properties in `src/styles/globals.css`. This enables:
- Runtime theme switching (light/dark) without JavaScript class toggling on every element
- Consistent token usage across the Tailwind config and component code
- Easy overrides for specific modules (e.g., the technician PWA may need slightly larger touch targets)

### 12.2 Tailwind Configuration

The `tailwind.config.js` maps CSS custom properties to Tailwind's utility classes:

- `bg-primary` → `hsl(var(--primary))`
- `text-ink-mute` → mapped to the ink-mute neutral token
- `border-hairline` → mapped to the hairline-light/hairline-dark tokens
- `shadow-ambient-medium` → mapped to the ambient-medium shadow token

Custom utility classes (`.kpi-card`, `.data-table-container`, `.sidebar-item`, `.sidebar-item-active`) are defined in the `@layer components` block of `globals.css`.

### 12.3 Component Library (shadcn/ui)

The project uses shadcn/ui as its component primitive library. These primitives (Button, Card, Input, Badge, Dialog, Sheet, etc.) are customized through the CSS variable system. When a new shadcn component is added:

1. It inherits the design tokens automatically through CSS variables
2. If it needs a variant not covered by the design system (e.g., a "success" button variant), add the variant spec to this DESIGN.md first, then implement
3. Never override a shadcn component's styles inline in a page or feature component; use the design token system

### 12.4 Icon Library

Use **Lucide React** for all icons. It provides the complete set of icons mapped in Section 2.6 (Clock, UserCheck, Truck, Wrench, CheckCircle, FileText, Banknote/DollarSign, XCircle) plus all general UI icons (Search, Plus, ChevronDown, Menu, etc.).

Icon sizes:
- 20px: sidebar navigation icons
- 16px: button icons, form field adornments
- 12px: status badge icons, inline indicators
- 24px: mobile navbar hamburger

---

## 13. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-07 | 2.0.0 | Complete redesign. Replaced shadcn/ui default palette (blue #2563eb, slate neutrals) with Superhuman-adapted design system. New tokens: indigo-navy primary, violet-soft accent, warm ink/canvas neutrals, 8 remapped status colors, 12-level typography scale, hairline border system. Adapted for ERP dashboard context. |
