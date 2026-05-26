# Triage Labels

These labels drive the `triage` skill's state machine on GitHub Issues.

| Role | Label | Description |
|------|-------|-------------|
| Needs evaluation | `needs-triage` | Maintainer needs to evaluate this issue |
| Waiting on reporter | `needs-info` | Blocked on information from the reporter |
| Agent-ready | `ready-for-agent` | Fully specified; an AFK agent can pick this up |
| Human-ready | `ready-for-human` | Needs human implementation or decision |
| Won't fix | `wontfix` | Will not be actioned |

## Notes

- `wontfix` already exists in the repo. The other four will be created on first use.
- Labels are applied via `gh issue edit <number> --add-label "<label>"`.
- When moving between states, remove the previous triage label and add the new one.
