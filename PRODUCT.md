# Product

## Register

product

## Users

**Primary Users:**
- **SUPERADMIN**: Full system access + user management + API docs. Needs complete control and oversight.
- **ADMIN**: Daily operations — create orders, assign technicians, monitor progress, invoice. Needs speed and clarity.
- **FINANCE**: Order viewing, full invoice & payment management, payment tracking. Needs accuracy and audit trails.
- **TECHNICIAN**: Mobile PWA user — field technicians who view jobs, update status on-site, submit service reports with photos, materials, and signatures. Needs offline resilience, large touch targets, and zero friction in the field.

**Context:** B2B AC (air conditioning) service company in Indonesia. Orders arrive via WhatsApp; admin inputs manually. All work is on-site (no workshop). Supports partial payments (cicilan). Indonesia-based (Jakarta time, Indonesian language).

## Product Purpose

MSN ERP is an internal operations platform that manages the full lifecycle of B2B AC service orders: from order creation and technician assignment, through on-site service reporting (photos, materials used, customer signature), to invoicing, payment recording, and automated service reminders.

**Success looks like:** Admins assign jobs in seconds. Technicians complete reports without calling the office. Finance tracks every invoice and payment accurately. The business never misses a scheduled service follow-up.

## Brand Personality

**Modern, Premium, Technical.**

- **Modern**: Clean interface patterns, current tech stack (Next.js 15, App Router), responsive PWA for technicians. No legacy cruft.
- **Premium**: Attention to detail in loading states, empty states, and transitions. The tool feels considered, not cobbled together.
- **Technical**: Precise terminology, robust state machines (8 canonical order states), strict RBAC, audit-friendly data flow. Built for operators who value reliability.

**Voice**: Direct and functional. Indonesian for user-facing labels. No marketing fluff. Error messages explain what went wrong and what to do next.

## Anti-references

- **Generic ERP Admin Templates**: The system must not look like a default Bootstrap / Material Admin dashboard. No sidebar-fatigue, no generic blue-gray corporate blandness, no "dashboard widget" clutter.
- **Overly colorful SaaS dashboards**: This is not a consumer analytics tool. One accent color (brand blue) carries the identity; the rest is functional.
- **Cluttered legacy ERP interfaces**: No dense grids of unrelated data, no 12-column forms, no mystery-meat navigation. Every screen has a clear primary task.

## Design Principles

1. **Task-first, not feature-first.** Every screen exists to advance an order, a payment, or a technician's job. If a UI element doesn't serve the current task, it's removed or deferred.
2. **Trust through consistency.** Same button shape everywhere. Same form-control vocabulary. Same status color meaning across the entire app. Users should never wonder "what will this button do?"
3. **Field-tested mobile experience.** The technician PWA is not an afterthought. Large touch targets (min 44px), clear offline indicators, one-handed operation, and zero-tolerance for layout shifts during interactions.
4. **State is truth.** The 8-state order machine is the backbone. Every transition is explicit, every status is visible, and nothing is ambiguous. Users should always know where an order is and what happens next.
5. **Respect the user's time.** Loading states teach patience (skeletons, not spinners). Empty states teach the interface. Errors explain how to fix. No dead clicks, no mystery delays.

## Accessibility & Inclusion

- **WCAG 2.1 AA** as the baseline for all screens.
- **Mobile Technician Access Concerns**: The `/technician` PWA route is heavily used by field technicians on phones and tablets. Minimum 44px touch targets, high-contrast status indicators, clear offline state communication, and `prefers-reduced-motion` respected for all animations.
- **Color blindness**: The 8 order states use both color AND shape/icon distinctions. Status badges include icons; never rely on color alone for state communication.
- **Reduced motion**: All transitions honor `prefers-reduced-motion: reduce`. No essential content gated behind animations.
- **Keyboard navigation**: All interactive elements are keyboard-accessible. Drag-and-drop Kanban board includes keyboard alternatives (context menu "Move to...").
