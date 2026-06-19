/**
 * Thin, dependency-free wrapper over the Anthropic Messages API.
 *
 * Design goal: AI is an *enhancement*, never a hard dependency. If no API key is
 * present (the default for CI and for anyone cloning the repo), every helper here
 * returns `null` and the test suites fall back to deterministic behaviour. This keeps
 * the suites green and reproducible while still showcasing real AI integration when
 * a key is supplied.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.AI_MODEL ?? 'claude-opus-4-8';

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask Claude a single question and get plain text back.
 * Returns null when AI is disabled or the request fails — callers must handle null.
 */
export async function askClaude(
  prompt: string,
  opts: { system?: string; maxTokens?: number } = {},
): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((b) => b.type === 'text')?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Parse the first JSON object/array out of an LLM response, tolerating prose/code fences. */
export function extractJson<T>(text: string | null): T | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
