/**
 * JSON salvage — recover a structured object from messy LLM text.
 *
 * LLMs asked for "only JSON" still leak prose, code fences, and reasoning before
 * the answer. This extracts the intended object through an ordered cascade, each
 * tier gated by a successful parse, and returns the LAST valid object (models emit
 * reasoning first, then the answer). The caller is responsible for schema validation.
 */

/** Parse `text` and return it only if it is a plain (non-array) object. */
function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not valid JSON — fall through to the next tier
  }
  return null;
}

/**
 * Collect every top-level brace-balanced `{...}` substring, in order.
 * String-literal and escape aware, so braces inside string values don't throw off
 * the depth count.
 */
function balancedObjectSpans(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          spans.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return spans;
}

/**
 * Extract a JSON object from arbitrary LLM output.
 *
 * Cascade (each tier accepted only if it parses to a plain object):
 *   1. the whole text as JSON;
 *   2. any ```json ... ``` fenced block (last valid one wins);
 *   3. any brace-balanced `{...}` substring (last valid one wins).
 *
 * Returns `null` when nothing parses to an object.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Tier 1: raw
  const raw = tryParseObject(trimmed);
  if (raw) return raw;

  // Tier 2: fenced ```json ... ``` blocks — take the last that parses
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  let lastFenced: Record<string, unknown> | null = null;
  while ((match = fenceRe.exec(trimmed)) !== null) {
    const parsed = tryParseObject(match[1].trim());
    if (parsed) lastFenced = parsed;
  }
  if (lastFenced) return lastFenced;

  // Tier 3: last brace-balanced object substring that parses
  const spans = balancedObjectSpans(trimmed);
  for (let i = spans.length - 1; i >= 0; i--) {
    const parsed = tryParseObject(spans[i]);
    if (parsed) return parsed;
  }

  return null;
}
