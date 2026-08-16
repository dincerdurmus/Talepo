/**
 * Individual opportunity/request save (watchlist).
 * Not a Saved Search, Alert Rule, or category preference.
 *
 * Workspace persists via OpportunityWatchlistItem (companyId + requestId).
 * Personal has no user-owned watchlist row — do not fake persistence.
 */
export type OpportunitySaveContext = "PERSONAL" | "WORKSPACE";

export function isOpportunitySaveSupported(input: {
  context: OpportunitySaveContext;
  canWatchlist: boolean;
}): boolean {
  return input.context === "WORKSPACE" && input.canWatchlist === true;
}
