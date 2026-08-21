/**
 * True when composer text matches the last understood rawInput and sync is idle.
 * Prevents showing Heidelberg facts while the user is mid-edit on Arçelik text.
 */
export function understandingMatchesComposerText(input: {
  composerText: string;
  understandingRawInput?: string | null;
  isSyncing: boolean;
}): boolean {
  if (input.isSyncing) return false;
  const composer = input.composerText.trim();
  if (!composer) return false;
  const understood = (input.understandingRawInput ?? "").trim();
  if (!understood) return false;
  return composer === understood;
}
