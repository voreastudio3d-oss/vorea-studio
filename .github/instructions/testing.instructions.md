---
applyTo: "**/*.test.{ts,tsx}"
description: "Use when: writing or editing test files, configuring Vitest, or working on test infrastructure."
---

# Testing Instructions

## Framework
- **Vitest** 4.1 + Testing Library (React + User Event)
- Config: `vitest.config.ts`
- Setup: `src/test-setup.ts` (global mocks)

## Conventions
- Test files colocated or in `__tests__/` directories
- File naming: `*.test.ts` or `*.test.tsx`
- Use `describe`/`it` blocks with clear descriptions
- Use Testing Library queries: `getByRole`, `getByText`, `findByRole` (prefer accessible queries)
- Use `userEvent` over `fireEvent` for user interactions

## Running
- `pnpm test` — single run
- `pnpm test:watch` — watch mode
- `pnpm test:coverage` — with coverage report (output in `coverage/`)

## Mocking
- Use `vi.mock()` for module mocks
- Use `vi.fn()` for function mocks
- Mock API calls, not implementation details
