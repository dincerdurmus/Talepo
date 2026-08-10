import { matchCompanyToRequest } from "./smart-matching";

export type RequestMatchPreview = {
  requestId: string;
  score: number;
  reasons: string[];
};

export async function batchMatchCompanyRequests(
  companyId: string,
  requestIds: string[],
): Promise<Map<string, RequestMatchPreview>> {
  const map = new Map<string, RequestMatchPreview>();
  const unique = [...new Set(requestIds)].slice(0, 50);

  await Promise.all(
    unique.map(async (requestId) => {
      const result = await matchCompanyToRequest(companyId, requestId);
      if (result && result.score > 0) {
        map.set(requestId, {
          requestId,
          score: result.score,
          reasons: result.reasons,
        });
      }
    }),
  );

  return map;
}
