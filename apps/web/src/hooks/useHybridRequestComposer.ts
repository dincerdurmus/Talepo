"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BrowseNode } from "@/lib/knowledge/types";
import {
  type BrowseSelectionInput,
  type BrowsePathStep,
  type CanonicalRequestState,
  type HybridQuestionResult,
  createBrowseOnlyState,
  resolveBrowsePath,
  resolveHybridQuestions,
  syncFromBrowse,
  syncFromText,
} from "@/lib/request-composer";
import {
  type BrowseWalkState,
  type QuickSelectGroup,
  type UnderstoodFact,
  advanceBrowseWalk,
  browseNodeToSelection,
  buildQuickSelectGroups,
  buildUnderstoodFacts,
  createBrowseWalkState,
  listBrowseOptions,
  softFillFromComposerState,
} from "@/lib/request-composer/ui-helpers";

const DEBOUNCE_MS = 250;

export type UseHybridRequestComposerOptions = {
  initialText?: string;
  debounceMs?: number;
};

export type UseHybridRequestComposerResult = {
  text: string;
  setText: (next: string) => void;
  /** Replace text + reset composer (home handoff / example chips). */
  resetWithText: (next: string) => void;
  state: CanonicalRequestState | null;
  browsePath: BrowsePathStep[];
  questions: HybridQuestionResult | null;
  understoodFacts: UnderstoodFact[];
  quickGroups: QuickSelectGroup[];
  softFillFields: Record<string, string>;
  composerError: boolean;
  browseDegraded: boolean;
  isSyncing: boolean;
  applyBrowseSelection: (selection: BrowseSelectionInput) => void;
  applyQuickOption: (
    fieldKey: string,
    value: string,
    isAny?: boolean,
  ) => void;
  browseWalk: BrowseWalkState;
  browseOptions: BrowseNode[];
  openBrowsePanel: boolean;
  setOpenBrowsePanel: (open: boolean) => void;
  selectBrowseNode: (node: BrowseNode) => void;
  resetBrowseWalk: () => void;
  backBrowseWalk: () => void;
  debugSnapshot: {
    syncGeneration: number;
    lastUserAction?: string;
    pathIds: string[];
    nextKeys: string[];
    lastComposedText?: string;
  } | null;
};

function emptyShell(): CanonicalRequestState {
  return createBrowseOnlyState([]);
}

export function useHybridRequestComposer(
  options: UseHybridRequestComposerOptions = {},
): UseHybridRequestComposerResult {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const [text, setTextState] = useState(options.initialText ?? "");
  const [state, setState] = useState<CanonicalRequestState | null>(() => {
    const initial = options.initialText?.trim();
    if (!initial) return null;
    try {
      return syncFromText(null, initial).state;
    } catch {
      return null;
    }
  });
  const [composerError, setComposerError] = useState(false);
  const [browseDegraded, setBrowseDegraded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [openBrowsePanel, setOpenBrowsePanel] = useState(false);
  const [browseWalk, setBrowseWalk] = useState<BrowseWalkState>(() =>
    createBrowseWalkState(),
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const seqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastComposedRef = useRef<string | undefined>(state?.lastComposedText);

  const applyState = useCallback((next: CanonicalRequestState) => {
    stateRef.current = next;
    lastComposedRef.current = next.lastComposedText;
    setState(next);
  }, []);

  const runSyncFromText = useCallback(
    (raw: string) => {
      const token = ++seqRef.current;
      setIsSyncing(true);
      try {
        const result = syncFromText(stateRef.current, raw);
        if (token !== seqRef.current) return;
        applyState(result.state);
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] syncFromText failed", error);
        if (token !== seqRef.current) return;
        setComposerError(true);
        setBrowseDegraded(true);
        // Keep user text + previous state; do not block create
      } finally {
        if (token === seqRef.current) setIsSyncing(false);
      }
    },
    [applyState],
  );

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        runSyncFromText(next);
      }, debounceMs);
    },
    [debounceMs, runSyncFromText],
  );

  const resetWithText = useCallback(
    (next: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setTextState(next);
      setBrowseWalk(createBrowseWalkState());
      seqRef.current += 1;
      const token = seqRef.current;
      try {
        const result = syncFromText(null, next);
        if (token !== seqRef.current) return;
        applyState(result.state);
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] resetWithText failed", error);
        setComposerError(true);
        setBrowseDegraded(true);
      }
    },
    [applyState],
  );

  const applyBrowseSelection = useCallback(
    (selection: BrowseSelectionInput) => {
      try {
        const previous = stateRef.current ?? emptyShell();
        const result = syncFromBrowse(previous, selection);
        applyState(result.state);
        setTextState(result.composedText);
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] syncFromBrowse failed", error);
        setBrowseDegraded(true);
      }
    },
    [applyState],
  );

  const applyQuickOption = useCallback(
    (fieldKey: string, value: string, isAny?: boolean) => {
      applyBrowseSelection({
        key: fieldKey,
        value,
        isAny: Boolean(isAny),
      });
    },
    [applyBrowseSelection],
  );

  const selectBrowseNode = useCallback(
    (node: BrowseNode) => {
      setBrowseWalk((walk) => advanceBrowseWalk(walk, node));
      const selection = browseNodeToSelection(node);
      if (selection) {
        applyBrowseSelection(selection);
        return;
      }
      // Category / subcategory / group: bootstrap text if empty so understanding tracks
      if (node.kind === "category" || node.kind === "subcategory") {
        const seed =
          text.trim().length > 0
            ? text
            : `${node.label} arıyorum`;
        if (!text.trim()) {
          try {
            const result = syncFromText(stateRef.current, seed);
            applyState(result.state);
            setTextState(seed);
          } catch {
            setBrowseDegraded(true);
          }
        }
      }
    },
    [applyBrowseSelection, applyState, text],
  );

  const resetBrowseWalk = useCallback(() => {
    setBrowseWalk(createBrowseWalkState());
  }, []);

  const backBrowseWalk = useCallback(() => {
    setBrowseWalk((walk) => {
      if (walk.stack.length === 0) return createBrowseWalkState();
      const stack = walk.stack.slice(0, -1);
      const parent = stack[stack.length - 1] ?? null;
      return {
        parentId: parent?.id ?? null,
        stack,
        categoryId: parent?.categoryId || walk.categoryId,
        subcategorySlug:
          parent?.kind === "subcategory"
            ? ((parent.meta?.subcategorySlug as string | undefined) ??
              parent.id.split("/")[1] ??
              null)
            : parent?.kind === "category"
              ? null
              : walk.subcategorySlug,
      };
    });
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const browsePath = useMemo(() => {
    if (!state || browseDegraded) return [] as BrowsePathStep[];
    try {
      return resolveBrowsePath(state);
    } catch {
      return [];
    }
  }, [browseDegraded, state]);

  const questions = useMemo(() => {
    if (!state) return null;
    try {
      return resolveHybridQuestions(state);
    } catch {
      return null;
    }
  }, [state]);

  const understoodFacts = useMemo(
    () => (browseDegraded ? [] : buildUnderstoodFacts(state)),
    [browseDegraded, state],
  );

  const quickGroups = useMemo(
    () => (browseDegraded ? [] : buildQuickSelectGroups(state, 2)),
    [browseDegraded, state],
  );

  const softFillFields = useMemo(
    () => softFillFromComposerState(state),
    [state],
  );

  const browseOptions = useMemo(
    () => listBrowseOptions(browseWalk),
    [browseWalk],
  );

  const debugSnapshot = useMemo(() => {
    if (!state) return null;
    return {
      syncGeneration: state.syncGeneration,
      lastUserAction: state.lastUserAction,
      pathIds: browsePath.map((p) => p.id),
      nextKeys: questions?.next.map((f) => f.key) ?? [],
      lastComposedText: state.lastComposedText,
    };
  }, [browsePath, questions, state]);

  return {
    text,
    setText,
    resetWithText,
    state,
    browsePath,
    questions,
    understoodFacts,
    quickGroups,
    softFillFields,
    composerError,
    browseDegraded,
    isSyncing,
    applyBrowseSelection,
    applyQuickOption,
    browseWalk,
    browseOptions,
    openBrowsePanel,
    setOpenBrowsePanel,
    selectBrowseNode,
    resetBrowseWalk,
    backBrowseWalk,
    debugSnapshot,
  };
}
