# Domain Docs

## Layout: Multi-context

This repo uses a **multi-context** layout:

- `CONTEXT-MAP.md` at the repo root — index of all bounded contexts and their relationships
- Each context has its own `CONTEXT.md` describing its domain language
- Each context may have its own `docs/adr/` for architectural decisions

## Consumer Rules

When a skill needs domain context:

1. Read `CONTEXT-MAP.md` first to understand the landscape.
2. Identify which context(s) are relevant to the current task.
3. Read the relevant `CONTEXT.md` file(s) for domain language.
4. Check the relevant `docs/adr/` for past decisions that constrain the solution space.

## Current State

- `CONTEXT-MAP.md` — does not exist yet (create when ready)
- Per-context `CONTEXT.md` files — do not exist yet
- `docs/adr/` — does not exist yet

These will be populated as the project's domain language and architectural decisions are documented.
