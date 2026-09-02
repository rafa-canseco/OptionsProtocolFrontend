# Frontend Instance

You are the **frontend instance**. You own all code in `frontend/`.

## Scope

- **Write/modify**: only files in `frontend/`
- **Read**: any file in the repo for context
- **Never access**: `../options-scenarios/` (holdout test boundary)

## Tooling

- Next.js, React, TypeScript
- Package manager: `bun` (NOT npm, npx, or yarn)
- Types: `tsc --noEmit`
- Dev server: `bun dev`

## Holdout Rule

You MUST NOT read, explore, glob, grep, or access any file inside
`../options-scenarios/`. This is a holdout testing setup. The user
will share only error messages when tests fail.

## Before You Start

1. Read `playbook/CONTEXT.md` for project overview, architecture,
   deployed addresses, and file map
2. Read your assigned Linear issue (b1nary workspace, team B1N)
3. Post your implementation plan as a comment on the Linear issue.
   Do NOT start coding until the plan is approved.

## Verification And Review

- During editing, run only affected Vitest files (`bun run test -- <test-files>`) and `bun run typecheck` when TypeScript changes.
- Before handoff, run `bun run check:fast` once. If executable frontend behavior changed, also run `bun run check:full` before delivery.
- Risk routing is: low = targeted checks + fast gate, no fresh reviewer; standard = targeted checks + fast gate + independent reviewer; high = targeted checks + full gate + defensive independent reviewer.
- Treat unspecified legacy work as high risk. Only a user- or Linear-approved ticket may assign a lower risk.
- Wallet, authentication, and fund-flow changes always retain independent review; use defensive independent review when high risk.

## Git Workflow

- Commit often. One logical change per commit.
- Conventional commit prefixes: feat:, fix:, chore:, refactor:, docs:
- Never push to main or dev directly. Feature branches only.
- For the vaults project, do NOT target the historical `dev` branch.
- The historical `dev` branch contains unrelated hackathon and experimental work and is not the integration base for the vaults initiative.
- For the vaults project, start feature branches from `main`.
- For the vaults project, open feature PRs into the active vaults integration branch, not `dev`.
- If the active vaults integration branch has not yet been created, stop after implementation and ask which integration branch should receive the PR instead of defaulting to `dev`.
- Outside the vaults project, if no override is given, branch naming includes Linear issue ID:
  `feat/b1n-5-description`
- PR titles include the Linear issue ID: "B1N-5: Description"

## Linear Workflow

- When you receive a task: read the issue, post your plan as a comment
- When plan is approved: move issue to "In Progress"
- When code is done: commit, push, create PR to the active integration branch for that initiative, post completion
  summary on the issue, move to "Review"
- When user says "merge it": post final summary (what delivered,
  security audit, testing results), move to "Done"
- If you unblock others: comment on blocked issues with available
  endpoints/files
- If you get blocked: comment on the issue explaining the blocker
