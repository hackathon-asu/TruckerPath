export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
export const hasGeminiConfig = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export function assertGeminiConfigured() {
  if (!hasGeminiConfig) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }
}
