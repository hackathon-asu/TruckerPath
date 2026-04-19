import { createClient } from "@insforge/sdk";

const API_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

if (!API_URL || !ANON_KEY) {
  console.error(
    "⚠ INSFORGE CONFIG MISSING — Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY in .env.local\n" +
    "  Hint: check .insforge/project.json for values"
  );
}

export const insforge = createClient({
  baseUrl: API_URL,
  anonKey: ANON_KEY
});
