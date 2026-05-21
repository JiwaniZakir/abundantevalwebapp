export function hasLlmApiKey(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
}

const LOCAL_LIVE_SETUP =
  "Add at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to .env.local, then restart the dev server.";

const VERCEL_LIVE_SETUP =
  "Add at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.";

export const LIVE_SETUP_MESSAGE = process.env.VERCEL
  ? VERCEL_LIVE_SETUP
  : LOCAL_LIVE_SETUP;
