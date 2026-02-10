"use client";

import { createContext, useContext, useCallback, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_STACK_SIZE = 50;

export type UndoAction = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

interface UndoRedoContextValue {
  pushAction: (action: UndoAction) => void;
  undo: () => void;
  redo: () => void;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => { undoCount: number; redoCount: number };
}

const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);

export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const listenersRef = useRef(new Set<() => void>());
  const snapshotRef = useRef({ undoCount: 0, redoCount: 0 });

  const notify = useCallback(() => {
    snapshotRef.current = {
      undoCount: undoStackRef.current.length,
      redoCount: redoStackRef.current.length,
    };
    listenersRef.current.forEach((cb) => cb());
  }, []);

  const pushAction = useCallback((action: UndoAction) => {
    undoStackRef.current = [...undoStackRef.current, action].slice(-MAX_STACK_SIZE);
    redoStackRef.current = [];
    notify();
  }, [notify]);

  const undo = useCallback(() => {
    const action = undoStackRef.current.pop();
    if (!action) return;
    redoStackRef.current.push(action);
    notify();
    action.undo().catch(() => {});
  }, [notify]);

  const redo = useCallback(() => {
    const action = redoStackRef.current.pop();
    if (!action) return;
    undoStackRef.current.push(action);
    notify();
    action.redo().catch(() => {});
  }, [notify]);

  const subscribe = useCallback((cb: () => void) => {
    listenersRef.current.add(cb);
    return () => { listenersRef.current.delete(cb); };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key !== "z" && e.key !== "Z") return;

      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLElement && active.isContentEditable) return;

      e.preventDefault();
      if (e.shiftKey) { redo(); } else { undo(); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Stable context value — never changes, so provider never re-renders children
  const contextValue = useMemo<UndoRedoContextValue>(() => ({
    pushAction, undo, redo, subscribe, getSnapshot,
  }), [pushAction, undo, redo, subscribe, getSnapshot]);

  return (
    <UndoRedoContext.Provider value={contextValue}>
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error("useUndoRedo must be used within an UndoRedoProvider");
  }
  return { pushAction: context.pushAction, undo: context.undo, redo: context.redo };
}

export function UndoRedoButtons() {
  const context = useContext(UndoRedoContext);
  if (!context) throw new Error("UndoRedoButtons must be used within an UndoRedoProvider");

  const { undoCount, redoCount } = useSyncExternalStore(context.subscribe, context.getSnapshot, context.getSnapshot);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={context.undo}
        disabled={undoCount === 0}
        title="Undo (Cmd+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={context.redo}
        disabled={redoCount === 0}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </>
  );
}
