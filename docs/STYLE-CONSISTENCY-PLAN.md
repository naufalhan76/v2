# Style Consistency Plan — MSN ERP Webpanel

> **Decisions locked:**
> - Dark mode: **Slate-Blue** (`225 20% 13%`)
> - Badge style: **B (Solid Pill)** — solid bg + white text
> - Icon pack: **Lucide Light (1.5px stroke)**
>
> **Constraint:** No backend/layout changes. CSS tokens + component classNames only.

---

## Problem Summary

| Issue | Admin Dashboard | Technician PWA |
|-------|----------------|----------------|
| Card bg | `bg-card` token ✅ | `bg-white dark:bg-surface-muted` hardcoded ❌ (30+ files) |
| Card radius | `rounded-lg` (12px) ✅ | `rounded-[32px]`, `[40px]`, `[28px]`, `3xl`, `2xl` — chaos ❌ |
| Shadow | `shadow-none` → `hover:shadow-md` ✅ | `shadow-2xl`, arbitrary `shadow-[0_10px_25px_rgba...]` ❌ |
| Border hue (light) | `40 14% 89%` — warm gray ❌ | same ❌ |
| Dark bg | `248 37% 8%` — dark indigo (muddy) ❌ | same ❌ |
| Status badge | Style A (tinted) — soft | Same — user wants Style B (solid) |
| Animations | framer-motion on 7 dashboard components ✅ (OK — dashboard is the right place) | CSS transitions only ✅ |

**Admin side is mostly clean** — main fixes are token hue shifts (globals.css).
**Technician side needs heavy token migration** — 30+ files with hardcoded values.

---

## Phase 1: Token Updates (globals.css)

### 1.1 Light Mode — Shift warm hues → cool (match indigo)

| Token | Old (warm) | New (cool) | Why |
|-------|-----------|-----------|-----|
| `--background` | `210 40% 98%` | `220 40% 98%` | Shift hue 210→220 (closer to indigo 247) |
| `--surface-muted` | `40 20% 98%` | `220 14% 97%` | Remove warm tint |
| `--secondary` | `40 20% 96%` | `220 14% 96%` | Match |
| `--muted` | `40 14% 94%` | `220 14% 94%` | Match |
| `--muted-foreground` | `247 15% 38%` | `220 10% 42%` | Cool gray |
| `--accent` | `40 14% 94%` | `220 14% 94%` | Match |
| `--border` | `40 14% 89%` | `220 13% 90%` | Cool gray border |
| `--border-strong` | `40 14% 80%` | `220 13% 80%` | Match |
| `--input` | `40 14% 89%` | `220 13% 90%` | Match |
| `--radius` | `0.5rem` | `0.75rem` | Slightly softer (DESIGN.md says 0.75rem) |

### 1.2 Dark Mode — Slate-Blue (replace dark indigo)

| Token | Old (dark indigo) | New (slate-blue) | Why |
|-------|------------------|-----------------|-----|
| `--background` | `248 37% 8%` | `225 20% 9%` | Neutral slate-blue, indigo pops |
| `--foreground` | `40 10% 92%` | `225 12% 92%` | Cool text |
| `--surface` | `248 37% 12%` | `225 20% 13%` | Card surface |
| `--surface-muted` | `248 30% 16%` | `225 15% 17%` | Muted surface |
| `--surface-elevated` | `248 37% 14%` | `225 20% 15%` | Elevated |
| `--secondary` | `248 30% 16%` | `225 15% 17%` | Match |
| `--muted` | `248 30% 16%` | `225 15% 17%` | Match |
| `--muted-foreground` | `247 12% 65%` | `225 8% 56%` | Cool gray text |
| `--accent` | `248 30% 16%` | `225 15% 17%` | Match |
| `--border` | `252 18% 22%` | `225 12% 22%` | Cool border |
| `--border-strong` | `252 18% 32%` | `225 12% 32%` | Match |
| `--input` | `252 18% 22%` | `225 12% 22%` | Match |
| `--destructive` | `0 84% 70%` | `0 84% 65%` | Slightly deeper for contrast |
| Clerk dark vars | `248°` hues | `225°` hues | Match new bg |

Status tokens stay same (already correct for both themes).

### 1.3 Component classes in globals.css

| Class | Change |
|-------|--------|
| `.kpi-card` | Keep as-is (already uses tokens) |
| `.data-table-container` | Keep as-is |
| `.sidebar-item` | Keep as-is |
| `.crud-button` | Keep as-is |

No new component classes needed — just token value swaps.

---

## Phase 2: StatusBadge → Style B (Solid Pill)

### 2.1 `src/lib/order-status.ts` — ORDER_STATUS_COLORS

Change from tinted (bg + text + border) to solid (bg + white text):

```
// OLD: { bg: 'bg-status-pending-bg', text: 'text-status-pending', border: 'border border-status-pending/30' }
// NEW: { bg: 'bg-status-pending', text: 'text-white', border: '' }
```

All 8 statuses get the same pattern: `bg-status-*` (solid) + `text-white` + empty border.

### 2.2 `src/components/orders/status-badge.tsx`

- Remove `variant="outline"` → use default `variant` (no border)
- Remove `colors.border` from className
- Keep icon + label + size variants
- Pill shape: `rounded-full` for both sizes (consistent with Style B preview)

### 2.3 `src/components/ui/badge.tsx`

Check if `variant="default"` supports solid bg. If not, add a `solid` variant.
Current badge.tsx likely has `variant="outline"` and `variant="default"` (secondary).
Need: `variant="default"` should be transparent (let bg class control), OR just use `variant="secondary"` and override.

**Approach:** Don't change badge.tsx. Just remove `variant="outline"` from StatusBadge and let the `colors.bg` + `colors.text` classes control the appearance directly.

---

## Phase 3: Technician Component Token Migration

### 3.1 Replace `bg-white dark:bg-surface-muted` → `bg-card`

Files (30+):
- bottom-tab-bar.tsx
- job-detail-skeleton.tsx
- wizard-phase-a.tsx, wizard-phase-b.tsx, wizard-phase-c.tsx
- confirmation-modal.tsx
- history-job-card.tsx
- empty-today-jobs.tsx
- signature-section.tsx
- today-jobs-skeleton.tsx
- materials-section.tsx
- unit-card.tsx
- history-list.tsx
- profile/profile-info-section.tsx
- profile/sync-status-section.tsx
- profile/profile-settings-section.tsx
- home-header.tsx (StatChip)
- app/technician/error.tsx

**Pattern:** `bg-white dark:bg-surface-muted` → `bg-card` (token auto-adapts light/dark)
**Pattern:** `bg-white dark:bg-surface` → `bg-card`

### 3.2 Replace arbitrary radius → token scale

| Old | New | Note |
|-----|-----|------|
| `rounded-[40px]` | `rounded-xl` (16px) | Large containers |
| `rounded-[32px]` | `rounded-xl` (16px) | Cards, modals |
| `rounded-[28px]` | `rounded-lg` (12px) | Tab bar active |
| `rounded-3xl` | `rounded-xl` (16px) | Skeleton cards |
| `rounded-2xl` | `rounded-lg` (12px) | Sections, icon containers |

**Exception:** `rounded-full` stays for avatars, dots, pills.

### 3.3 Replace heavy shadows → subtle

| Old | New |
|-----|-----|
| `shadow-2xl` | `shadow-md` |
| `shadow-[0_10px_25px_rgba(0,0,0,0.2)]` | `shadow-lg` |
| `shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]` | `shadow-sm` |
| `shadow` (bare) | `shadow-sm` |

### 3.4 Input fields — already using tokens

`signature-section.tsx` uses `bg-white dark:bg-surface` for inputs → change to `bg-input` or just `bg-surface` (let input token handle border).

---

## Phase 4: Admin Dashboard Cleanup (minimal)

Admin side is mostly clean. Only changes:
1. globals.css token shifts (Phase 1) — automatic propagation
2. StatusBadge Style B (Phase 2) — automatic
3. framer-motion: **Keep as-is** — user confirmed "cukup di beberapa page aja kaya dashboard dll"

No component changes needed on admin side.

---

## Phase 5: Lucide Light (1.5px stroke)

### 5.1 Global CSS rule

Add to `globals.css` `@layer base`:
```css
svg.lucide-react, svg[class*="lucide"] {
  stroke-width: 1.5;
}
```

Lucide React outputs `<svg class="lucide lucide-*">`. This CSS rule overrides the default `stroke-width="2"` attribute globally — no component changes needed.

### 5.2 Exception: Solid badge icons

At 12px badge size with 1.5px stroke, icons remain readable (verified in preview). No exception needed.

### 5.3 No import changes

All 90+ Lucide imports stay exactly the same. The stroke-width is purely a CSS concern.

---

## Phase 6: Verification

1. `bun run type-check` — ensure no TS errors
2. `bun run lint` — ensure no lint errors
3. `bun run lint:colors` — ensure no hardcoded colors (existing script)
4. Visual check: screenshot key pages
5. Run existing tests: `bun run test` (Vitest)

---

## File Change Count Estimate

| Category | Files | LOC changed |
|-----------|-------|-------------|
| globals.css (tokens) | 1 | ~60 lines |
| order-status.ts (colors) | 1 | ~30 lines |
| status-badge.tsx | 1 | ~10 lines |
| Technician components (token migration) | ~20 | ~100 lines (className swaps) |
| **Total** | ~23 | ~200 lines |

No backend, no layout, no route changes. Pure CSS token + className migration.

---

## Execution Order

1. globals.css — token values (light cool hues + dark slate-blue)
2. order-status.ts — ORDER_STATUS_COLORS → solid style
3. status-badge.tsx — remove outline variant, use solid
4. Technician components batch — bg-white→bg-card, radius→tokens, shadow→tokens
5. Type-check + lint + color-check
6. Screenshot verification
