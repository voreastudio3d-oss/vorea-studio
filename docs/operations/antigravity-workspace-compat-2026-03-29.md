# Antigravity Workspace Compatibility — 2026-03-29

## Symptoms

- Antigravity native agents (`Gemini`, `Claude`, `GPT-OSS-120B`) stop responding only when this repo is opened as a workspace.
- The same agents can still act on the folder path externally, without the project being open inside Antigravity.

## Causes Found

1. Legacy workspace-level governance existed in both `.agent/` and `.agents/`.
2. The repo contained a nested gitlink `worktrees/promote-news` under the project root.
3. Local git config still carried stale worktree state:
   - old `extensions.worktreeConfig`
   - old `safe.directory` for the removed `promote-news` worktree
4. Generated artifacts were still present or even tracked in the repo root:
   - `.playwright-cli/`
   - `.vite/`
   - `coverage/`
   - `dist/`
5. The repo still has a very large `node_modules/` tree with many `pnpm` reparse points.

## Mitigations Applied

- Removed the legacy `.agent/` workspace flow.
- Moved `worktrees/` outside the repo root.
- Removed stale local `extensions.worktreeConfig`.
- Removed the stale global `safe.directory` entry for the old nested worktree.
- Stopped tracking `.playwright-cli/` and `.vite/` artifacts.
- Moved `.playwright-cli/`, `.vite/`, `coverage/`, and `dist/` to backup storage at:
  - `E:\__Vorea-Studio\__3D_parametrics\_workspace_overflow\Vorea-Paramentrics-3D-antigravity-compat-2026-03-29`
- Added compatibility filters:
  - `.antigravityignore`
  - `.geminiignore`
  - `.vscode/settings.json`
  - `Vorea-Paramentrics-3D.antigravity.code-workspace`

## Recommended Open Mode

Prefer opening:

- `Vorea-Paramentrics-3D.antigravity.code-workspace`

instead of opening the folder directly.

This workspace excludes:

- `node_modules/`
- `dist/`
- `coverage/`
- `.playwright-cli/`
- `.vite/`

from file watchers and search/index surfaces.

## If Antigravity Still Hangs

Next isolation step:

1. create a temporary clean copy of the repo without `node_modules/`;
2. open that copy through the `.code-workspace` file;
3. if it works, treat `node_modules/` + `pnpm` reparse points as the primary remaining blocker.
