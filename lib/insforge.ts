import { createClient } from "@insforge/sdk";

const API_URL = process.env.NEXT_PUBLIC_INSFORGE_URL?.trim() ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY?.trim() ?? "";

export const hasInsforgeConfig = Boolean(API_URL && ANON_KEY);

if (!hasInsforgeConfig) {
  console.error(
    "INSFORGE CONFIG MISSING - Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY in .env.local\n" +
      "  Hint: check .insforge/project.json for values",
  );
}

export const insforge = hasInsforgeConfig
  ? createClient({
      baseUrl: API_URL,
      anonKey: ANON_KEY,
    })
  : null;

export function assertInsforgeConfigured() {
  if (!hasInsforgeConfig) {
    throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL or NEXT_PUBLIC_INSFORGE_ANON_KEY");
  }
}
