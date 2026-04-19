import "server-only";

const BASE_URL = process.env.NAVPRO_API_BASE_URL ?? "https://api.truckerpath.com/navpro";
const TOKEN = process.env.NAVPRO_API_BEARER_TOKEN ?? "";
const FORCE_MOCK = process.env.NAVPRO_FORCE_MOCK === "true";

export const liveMode = !!TOKEN && !FORCE_MOCK;

export interface NavProResult<T> {
  data: T | null;
  live: boolean;
  error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!TOKEN) throw new Error("NAVPRO_API_BEARER_TOKEN missing");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NavPro ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Safe wrapper: try NavPro, fall back to provided mock payload.
 * Tags response so UI can show "live" vs "demo".
 */
export async function safeCall<T>(
  path: string,
  mock: T,
  init?: RequestInit,
): Promise<NavProResult<T>> {
  if (!liveMode) return { data: mock, live: false };
  try {
    const data = await call<T>(path, init);
    return { data, live: true };
  } catch (err) {
    return { data: mock, live: false, error: (err as Error).message };
  }
}

export async function postJson<T>(path: string, body: unknown, mock: T) {
  return safeCall<T>(path, mock, { method: "POST", body: JSON.stringify(body) });
}

export async function getJson<T>(path: string, mock: T) {
  return safeCall<T>(path, mock, { method: "GET" });
}
