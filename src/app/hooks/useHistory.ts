/**
 * useHistory — Undo/Redo state management hook.
 *
 * Maintains a stack of snapshots with configurable max depth.
 * Designed for the SCAD editor: tracks source code + parameter values.
 */

import { useCallback, useRef, useState } from "react";

export interface HistorySnapshot {
  source: string;
  paramValues: Record<string, unknown>;
}

interface HistoryState {
  stack: HistorySnapshot[];
  index: number; // points to current state
}

const MAX_HISTORY = 100;
/** Minimum ms between auto-pushes to avoid flooding on rapid typing */
const DEBOUNCE_MS = 800;

export function useHistory(initial: HistorySnapshot) {
  const stateRef = useRef<HistoryState>({
    stack: [structuredClone(initial)],
    index: 0,
  });
  const lastPushTime = useRef(0);
  // Tick counter forces React re-renders when history changes
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  /** Push a new snapshot. Discards any redo states ahead of current index. */
  const push = useCallback((snapshot: HistorySnapshot, force = false) => {
    const now = Date.now();
    if (!force && now - lastPushTime.current < DEBOUNCE_MS) return;

    const s = stateRef.current;
    // Don't push if identical to current
    const current = s.stack[s.index];
    if (current && current.source === snapshot.source
        && JSON.stringify(current.paramValues) === JSON.stringify(snapshot.paramValues)) return;

    // Truncate redo branch
    s.stack = s.stack.slice(0, s.index + 1);
    s.stack.push(structuredClone(snapshot));

    // Enforce max depth
    if (s.stack.length > MAX_HISTORY) {
      s.stack = s.stack.slice(s.stack.length - MAX_HISTORY);
    }

    s.index = s.stack.length - 1;
    lastPushTime.current = now;
    bump();
  }, [bump]);

  /** Undo — move back one step. Returns the snapshot or null if at beginning. */
  const undo = useCallback((): HistorySnapshot | null => {
    const s = stateRef.current;
    if (s.index <= 0) return null;
    s.index--;
    bump();
    return structuredClone(s.stack[s.index]);
  }, [bump]);

  /** Redo — move forward one step. Returns the snapshot or null if at end. */
  const redo = useCallback((): HistorySnapshot | null => {
    const s = stateRef.current;
    if (s.index >= s.stack.length - 1) return null;
    s.index++;
    bump();
    return structuredClone(s.stack[s.index]);
  }, [bump]);

  /** Check if undo is available */
  const canUndo = useCallback(() => stateRef.current.index > 0, []);

  /** Check if redo is available */
  const canRedo = useCallback(
    () => stateRef.current.index < stateRef.current.stack.length - 1,
    []
  );

  /** Reset history with a new initial state */
  const reset = useCallback((snapshot: HistorySnapshot) => {
    stateRef.current = {
      stack: [structuredClone(snapshot)],
      index: 0,
    };
    lastPushTime.current = 0;
    bump();
  }, [bump]);

  return { push, undo, redo, canUndo, canRedo, reset };
}
