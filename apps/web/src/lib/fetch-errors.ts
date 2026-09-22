export const API_UNREACHABLE = 'API_UNREACHABLE';

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network|Failed to fetch/i.test(err.message);
}

export async function safeClientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (isNetworkError(err)) throw new Error(API_UNREACHABLE);
    throw err;
  }
}

export function apiUnreachableMessage() {
  return 'Cannot reach the API. Start it in a separate terminal: npm run dev:api (port 4000).';
}
