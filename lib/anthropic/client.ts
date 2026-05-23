import Anthropic from "@anthropic-ai/sdk";

export const CHAT_MODEL = "claude-sonnet-4-6";

export function anthropic(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    defaultHeaders: process.env.HELICONE_API_KEY
      ? { "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}` }
      : undefined,
  });
}
