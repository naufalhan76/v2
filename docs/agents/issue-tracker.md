# Issue Tracker

Issues are tracked in **GitHub Issues** on the `naufalhan76/webpanel` repository.

## CLI

Use the `gh` CLI for all issue operations:

- `gh issue create --title "..." --body "..." --label "..."`
- `gh issue list`
- `gh issue view <number>`
- `gh issue edit <number> --add-label "..."`
- `gh issue close <number>`

## Conventions

- One issue per discrete unit of work (vertical slice preferred).
- Use labels for triage state (see `triage-labels.md`).
- Reference related issues with `#<number>` in the body.
- When an agent creates an issue, it should include enough context for another agent to pick it up without human clarification.
