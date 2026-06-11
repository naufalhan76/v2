# Indigo PWA Design System

Source of Truth: Stitch Screen `projects/1885811858504711752/screens/112196849c75493fa3b6faa3a5a620ae` ("Indigo Task Dashboard Final Polished")

## Implementation Mapping
- CSS Variables: `src/styles/globals.css`
- Tailwind Theme: `tailwind.config.js`

## Color Palette
### Primary (Brand)
- **Deep Navy (`--navy-deep`)**: `#1e1b5e` - Used for headers, active tab icons, primary text highlights, and active elements.
- **Light Navy (`--navy-light`)**: `#2d2a75` - For subtle interactions or secondary brand elements.

### Backgrounds
- **Faded Gray (`--bg-gray-faded`)**: `#f8fafc` - Main page background (Slate 50 equivalent).
- **White**: `#ffffff` - Used for cards, navigation bars, and tab containers.

### Status Colors
- **Success Green (`--success-green`)**: `#22c55e` - Used for success icons, checkmarks (Green 500).
- **Status Red Background (`--status-red-bg`)**: `#fee2e2` - Used for cancelled/error tags (Red 50).
- **Status Red Text (`--status-red-text`)**: `#ef4444` - Used for cancelled/error text (Red 400).

## Typography
- **Font Family**: System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
- **Headings**:
  - Screen Titles: `text-2xl font-bold`
  - Card Titles: `text-xl font-bold text-gray-800`
- **Body**: 
  - Subtitles: `text-sm text-gray-300 leading-tight`
  - Info items (Date, Category, Price): `text-sm font-medium text-[#1e1b5e]`

## Spacing & Layout
### Mobile Layout
- Content area minimum height: `max(884px, 100dvh)`
- General Padding: `px-6` (24px) for screens and main content.
- Header Padding: `pt-12 pb-20 px-6` with negative margin `-mt-10` on subsequent sections for overlap.
- Bottom Navigation: Fixed to bottom, `py-3`

## Shape & Border Radius (Radius)
- **Header Curve**: `border-bottom-left-radius: 40px`, `border-bottom-right-radius: 40px`
- **Cards**: `rounded-3xl`
- **Tabs Container**: `rounded-3xl`
- **Active Tab Button**: `rounded-xl`
- **Tags**: `rounded-full`

## Elevation & Shadows
- **Card Shadow**: `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04)` (`card-shadow`)
- **Tab Container Shadow**: `box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05)` (`tab-container-shadow`)

## Components
### Buttons
- **Active Tab**: `bg-[#1e1b5e] text-white rounded-xl py-3 font-semibold`
- **Inactive Tab**: `text-gray-600 font-semibold py-3 flex-1 text-center`

### Cards
- **Job Card**: `bg-white rounded-3xl p-6 border border-gray-200 card-shadow`

### Forms
- Elements follow the general border `border-gray-200` styling with `rounded-xl` or `rounded-3xl` for containers.
- Inputs take consistent internal padding.

### Offline States
- When offline, specific banners or disabled states can utilize the `status-red` or a custom gray overlay. The PWA requires consistent cached states to handle loss of connection without breaking the layout.
