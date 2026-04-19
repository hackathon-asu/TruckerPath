export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export function assertGeminiConfigured() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }
}
