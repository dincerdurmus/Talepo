"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BrowseNode } from "@/lib/knowledge/types";
import {
  type BrowseSelectionInput,
  type BrowsePathStep,
  type CanonicalRequestState,
  type FieldValueKind,
  type HybridQuestionResult,
  composeTextFromBrowseStack,
  createBrowseOnlyState,
  pinBrowseSemanticContext,
  resolveBrowsePath,
  resolveHybridQuestions,
  shouldSkipTextWalkRealign,
  syncFromBrowse,
  syncFromText,
} from "@/lib/request-composer";
import {
  type BrowseWalkState,
  type QuickSelectGroup,
  type UnderstoodFact,
  browseWalkFromPath,
  browseNodeToSelection,
  buildQuickSelectGroups,
  buildUnderstoodFacts,
  createBrowseWalkState,
  listBrowseCascadeColumns,
  selectBrowseWalkAtColumn,
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
  /** Re-run understanding for the current text after a composer error. */
  retrySync: () => void;
  applyBrowseSelection: (selection: BrowseSelectionInput) => void;
  /**
   * `kind` verildiğinde `value` YALNIZ kullanıcıya gösterilen etikettir ve
   * kanonik kayda yazılmaz (D3f Dilim 1). "Bilmiyorum" gibi değer taşımayan
   * cevaplar böyle taşınır; `isAny` geriye uyumluluk için korunur.
   */
  applyQuickOption: (
    fieldKey: string,
    value: string,
    isAny?: boolean,
    kind?: FieldValueKind,
  ) => void;
  browseWalk: BrowseWalkState;
  browseColumns: BrowseNode[][];
  openBrowsePanel: boolean;
  setOpenBrowsePanel: (open: boolean) => void;
  selectBrowseNodeAtColumn: (columnIndex: number, node: BrowseNode) => void;
  resetBrowseWalk: () => void;
};

function emptyShell(): CanonicalRequestState {
  return createBrowseOnlyState([]);
}

function pathSignature(path: BrowsePathStep[]): string {
  return path.map((p) => p.id).join(">");
}

export function useHybridRequestComposer(
  options: UseHybridRequestComposerOptions = {},
): UseHybridRequestComposerResult {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const [text, setTextState] = useState(options.initialText ?? "");
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
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
  // Keep the category cascade closed on page load; users open it on demand.
  const [openBrowsePanel, setOpenBrowsePanel] = useState(false);
  const [browseWalk, setBrowseWalk] = useState<BrowseWalkState>(() =>
    createBrowseWalkState(),
  );

  const stateRef = useRef(state);
  const seqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastComposedRef = useRef<string | undefined>(state?.lastComposedText);
  /** When user clicks columns, skip one text→walk realign cycle. */
  const skipPathWalkSyncRef = useRef(false);
  const lastPathSigRef = useRef("");
  const browseWalkRef = useRef(browseWalk);
  /**
   * "Son değer" ref kalıbı: yazım render sırasında değil commit sonrası
   * yapılır (react-hooks/refs). Tüketiciler kullanıcı olaylarında ve
   * zamanlayıcılarda okur; effect her commit'te koştuğu için davranış aynı.
   */
  useEffect(() => {
    stateRef.current = state;
    browseWalkRef.current = browseWalk;
  }, [state, browseWalk]);

  const applyState = useCallback((next: CanonicalRequestState | null) => {
    stateRef.current = next;
    lastComposedRef.current = next?.lastComposedText;
    setState(next);
  }, []);

  const runSyncFromText = useCallback(
    (raw: string, expectedToken: number) => {
      if (expectedToken !== seqRef.current) return;
      setIsSyncing(true);
      try {
        const result = syncFromText(stateRef.current, raw);
        if (expectedToken !== seqRef.current) return;
        if (result.clearedStaleBrowse) {
          skipPathWalkSyncRef.current = false;
          lastPathSigRef.current = "";
        }
        applyState(result.state);
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] syncFromText failed", error);
        if (expectedToken !== seqRef.current) return;
        // Keep the user's text; drop stale structured understanding.
        applyState(null);
        setComposerError(true);
        setBrowseDegraded(true);
      } finally {
        if (expectedToken === seqRef.current) setIsSyncing(false);
      }
    },
    [applyState],
  );

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      // Invalidate any in-flight / pending sync (latest keystroke wins).
      const token = ++seqRef.current;
      const trimmed = next.trim();

      if (!trimmed) {
        applyState(null);
        setBrowseWalk(createBrowseWalkState());
        lastPathSigRef.current = "";
        setIsSyncing(false);
        setComposerError(false);
        setBrowseDegraded(false);
        return;
      }

      // Hide previous facts immediately — never show Heidelberg while typing Arçelik.
      setIsSyncing(true);
      applyState(null);

      debounceTimerRef.current = setTimeout(() => {
        runSyncFromText(next, token);
      }, debounceMs);
    },
    [applyState, debounceMs, runSyncFromText],
  );

  const resetWithText = useCallback(
    (next: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setTextState(next);
      setBrowseWalk(createBrowseWalkState());
      lastPathSigRef.current = "";
      const token = ++seqRef.current;
      const trimmed = next.trim();
      if (!trimmed) {
        applyState(null);
        setIsSyncing(false);
        setComposerError(false);
        setBrowseDegraded(false);
        return;
      }
      setIsSyncing(true);
      applyState(null);
      try {
        const result = syncFromText(null, next);
        if (token !== seqRef.current) return;
        applyState(result.state);
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] resetWithText failed", error);
        if (token !== seqRef.current) return;
        applyState(null);
        setComposerError(true);
        setBrowseDegraded(true);
      } finally {
        if (token === seqRef.current) setIsSyncing(false);
      }
    },
    [applyState],
  );

  const retrySync = useCallback(() => {
    const token = ++seqRef.current;
    setComposerError(false);
    setIsSyncing(true);
    runSyncFromText(text, token);
  }, [runSyncFromText, text]);

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
    (fieldKey: string, value: string, isAny?: boolean, kind?: FieldValueKind) => {
      const preservedRawInput = textRef.current;
      try {
        const previous = stateRef.current ?? emptyShell();
        const result = syncFromBrowse(previous, {
          key: fieldKey,
          value,
          isAny: Boolean(isAny),
          kind,
        });
        applyState(result.state);
        // Free-text rawInput must stay the user's original wording.
        // Never replace it with a generated title/composed description.
        if (preservedRawInput.trim()) {
          setTextState(preservedRawInput);
        } else {
          setTextState(result.composedText);
        }
        setComposerError(false);
        setBrowseDegraded(false);
      } catch (error) {
        console.error("[hybrid-composer] applyQuickOption failed", error);
        setBrowseDegraded(true);
      }
    },
    [applyState],
  );

  const selectBrowseNodeAtColumn = useCallback(
    (columnIndex: number, node: BrowseNode) => {
      skipPathWalkSyncRef.current = true;

      const nextWalk = selectBrowseWalkAtColumn(
        browseWalk,
        columnIndex,
        node,
      );
      setBrowseWalk(nextWalk);

      const walkCategoryId =
        nextWalk.categoryId ||
        (node.kind === "category" ? node.categoryId || node.id : null);
      const walkSubSlug =
        nextWalk.subcategorySlug ??
        (node.kind === "subcategory" && node.meta?.subcategorySlug
          ? String(node.meta.subcategorySlug)
          : null);

      const stackLabels = () =>
        composeTextFromBrowseStack(
          nextWalk.stack.map((n) => ({ kind: n.kind, label: n.label })),
          {
            categoryId: nextWalk.categoryId,
            subcategorySlug: nextWalk.subcategorySlug,
          },
        );

      // Pin semantic role as soon as subcategory (or deeper) is known.
      if (walkCategoryId && walkSubSlug && stateRef.current) {
        const pinned = pinBrowseSemanticContext(stateRef.current, {
          categoryId: walkCategoryId,
          subcategorySlug: walkSubSlug,
        });
        applyState(pinned);
      }

      const selection = browseNodeToSelection(node);
      if (selection) {
        applyBrowseSelection(selection);
        const fromPath = stackLabels();
        const composed =
          fromPath ||
          stateRef.current?.lastComposedText ||
          `${selection.value} arıyorum.`;
        try {
          const result = syncFromText(stateRef.current, composed, {
            force: true,
            structured: {
              categoryId: walkCategoryId ?? stateRef.current?.categoryId ?? undefined,
              fieldValues: {
                ...(walkSubSlug && stateRef.current?.fields.needType?.kind === "VALUE"
                  ? {
                      needType: String(
                        stateRef.current.fields.needType.value ?? "",
                      ),
                    }
                  : walkSubSlug === "yedek-parca"
                    ? { needType: "part" }
                    : walkSubSlug === "arac-satin-alma"
                      ? { needType: "vehicle" }
                      : walkSubSlug === "arac-bakim"
                        ? { needType: "service" }
                        : walkSubSlug === "lastik-ve-jant"
                          ? { needType: "tire" }
                          : {}),
              },
            },
          });
          applyState({
            ...result.state,
            fields: {
              ...result.state.fields,
              [selection.key]:
                stateRef.current?.fields[selection.key] ??
                result.state.fields[selection.key]!,
              ...(stateRef.current?.fields.needType?.provenance ===
              "EXPLICIT_BROWSE"
                ? { needType: stateRef.current.fields.needType }
                : {}),
            },
            categoryId:
              walkCategoryId ??
              result.state.categoryId ??
              stateRef.current?.categoryId ??
              null,
            subcategorySlug:
              walkSubSlug ??
              result.state.subcategorySlug ??
              stateRef.current?.subcategorySlug ??
              null,
            taxonomyNodeId: selection.entityId?.startsWith("tax:")
              ? selection.entityId
              : result.state.taxonomyNodeId,
            lastComposedText: composed,
            lastUserAction: "browse",
          });
          setTextState(composed);
        } catch {
          setTextState(composed);
        }
        return;
      }

      // Category / subcategory / group: pour selection into the textarea
      if (
        node.kind === "category" ||
        node.kind === "subcategory" ||
        node.kind === "group"
      ) {
        // Category root alone is not a vehicle-purchase request.
        if (node.kind === "category" && !walkSubSlug) {
          const previous = stateRef.current ?? emptyShell();
          const pinned = pinBrowseSemanticContext(previous, {
            categoryId: walkCategoryId,
            subcategorySlug: null,
          });
          applyState({
            ...pinned,
            categoryId: node.categoryId || node.id,
            subcategorySlug: null,
            lastUserAction: "browse",
          });
          setComposerError(false);
          setBrowseDegraded(false);
          return;
        }
        const seed =
          node.meta?.listingType
            ? `${node.meta.listingType} konut arıyorum.`
            : stackLabels() || `${node.label} arıyorum.`;
        try {
          const result = syncFromText(null, seed, {
            force: true,
            structured: {
              categoryId: walkCategoryId ?? undefined,
              fieldValues:
                walkSubSlug === "yedek-parca"
                  ? { needType: "part" }
                  : walkSubSlug === "arac-satin-alma"
                    ? { needType: "vehicle" }
                    : walkSubSlug === "arac-bakim"
                      ? { needType: "service" }
                      : walkSubSlug === "lastik-ve-jant"
                        ? { needType: "tire" }
                        : undefined,
            },
          });
          const seeded: CanonicalRequestState = {
            ...result.state,
            categoryId:
              node.kind === "category"
                ? node.categoryId || node.id
                : walkCategoryId ?? result.state.categoryId,
            subcategorySlug:
              node.kind === "subcategory" && node.meta?.subcategorySlug
                ? String(node.meta.subcategorySlug)
                : walkSubSlug ?? result.state.subcategorySlug,
            lastComposedText: seed,
            lastUserAction: "browse",
          };
          const nextState = pinBrowseSemanticContext(seeded, {
            categoryId: seeded.categoryId,
            subcategorySlug: seeded.subcategorySlug,
          });
          applyState(nextState);
          setTextState(nextState.lastComposedText ?? seed);
          setComposerError(false);
          setBrowseDegraded(false);
        } catch {
          setTextState(seed);
          setBrowseDegraded(true);
        }
      }
    },
    [applyBrowseSelection, applyState, browseWalk],
  );

  const resetBrowseWalk = useCallback(() => {
    skipPathWalkSyncRef.current = true;
    setBrowseWalk(createBrowseWalkState());
    lastPathSigRef.current = "";
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

  // Text → columns: keep walk aligned with understood path
  useEffect(() => {
    if (browseDegraded || isSyncing) return;
    const sig = pathSignature(browsePath);
    if (
      shouldSkipTextWalkRealign({
        skipOnce: skipPathWalkSyncRef.current,
        walkCategoryId: browseWalkRef.current.categoryId,
        path: browsePath,
      })
    ) {
      skipPathWalkSyncRef.current = false;
      lastPathSigRef.current = sig;
      return;
    }
    skipPathWalkSyncRef.current = false;
    if (sig === lastPathSigRef.current) return;
    lastPathSigRef.current = sig;
    if (browsePath.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- metin otoritesi → sütun yürüyüşü senkronu; sig koruması döngüyü keser
      setBrowseWalk(createBrowseWalkState());
      return;
    }
    try {
       
      setBrowseWalk(browseWalkFromPath(browsePath));
    } catch {
      // keep current walk
    }
  }, [browseDegraded, browsePath, isSyncing]);

  const questions = useMemo(() => {
    if (!state || isSyncing) return null;
    try {
      return resolveHybridQuestions(state);
    } catch {
      return null;
    }
  }, [isSyncing, state]);

  const understoodFacts = useMemo(
    () => (browseDegraded || isSyncing ? [] : buildUnderstoodFacts(state)),
    [browseDegraded, isSyncing, state],
  );

  const quickGroups = useMemo(
    () => (browseDegraded || isSyncing ? [] : buildQuickSelectGroups(state, 2)),
    [browseDegraded, isSyncing, state],
  );

  const softFillFields = useMemo(
    () => softFillFromComposerState(state),
    [state],
  );

  const browseColumns = useMemo(
    () => listBrowseCascadeColumns(browseWalk),
    [browseWalk],
  );

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
    retrySync,
    applyBrowseSelection,
    applyQuickOption,
    browseWalk,
    browseColumns,
    openBrowsePanel,
    setOpenBrowsePanel,
    selectBrowseNodeAtColumn,
    resetBrowseWalk,
  };
}
