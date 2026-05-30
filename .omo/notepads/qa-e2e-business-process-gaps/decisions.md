# Decisions

## [2026-05-30] Locked decisions
- Known bugs: test.fail() + KNOWN-BUG comment (3 in-scope: duplicate-proforma T4, payment-on-DRAFT T7, PAID->CANCELLED T12)
- UI depth: setup-via-admin-client, SUT via real UI/API
- PDF: content-type + bytes + filename only
- RBAC: one negative per role + one SUPERADMIN positive (not full matrix)
