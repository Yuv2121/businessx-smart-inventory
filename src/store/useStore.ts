import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppState } from '@/engine/types';
import { resetDemo } from '@/data/seed';
import { seedReorderState } from '@/data/seedReorder';

const KEY = 'businessx-state-v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (!parsed.editLog) parsed.editLog = [];
      return parsed;
    }
  } catch {
    // ignore
  }
  const seeded = seedReorderState();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

interface UndoEntry { snapshot: AppState; label: string; timer: ReturnType<typeof setTimeout> | null }

export function useStore() {
  const [state, setState] = useState<AppState>(() => load());
  const undoRef = useRef<UndoEntry | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((next: AppState) => setState(next), []);

  const commit = useCallback((next: AppState, label: string, undoSeconds: number = 30) => {
    const prev = state;
    setState(next);
    if (undoRef.current?.timer) clearTimeout(undoRef.current.timer);
    const timer = setTimeout(() => { undoRef.current = null; }, undoSeconds * 1000);
    undoRef.current = { snapshot: prev, label, timer };
  }, [state]);

  const undo = useCallback((): boolean => {
    if (!undoRef.current) return false;
    if (undoRef.current.timer) clearTimeout(undoRef.current.timer);
    setState(undoRef.current.snapshot);
    undoRef.current = null;
    return true;
  }, []);

  const getUndoLabel = useCallback((): string | null => {
    return undoRef.current?.label ?? null;
  }, []);

  const setToday = useCallback((date: string) => {
    setState((s) => ({ ...s, today: date }));
  }, []);

  const reset = useCallback(() => setState(resetDemo()), []);

  return { state, update, commit, undo, getUndoLabel, setToday, reset };
}
