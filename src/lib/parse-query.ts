import { generateText, Output } from "ai";
import { filtersSchema, type Filters } from "./filters";
import { anthropic } from "@ai-sdk/anthropic";

/** Exported so the eval runner can record which model produced a result. */
export const MODEL_ID = "claude-haiku-5-5";
const MODEL = anthropic(MODEL_ID);

const SYSTEM = `You turn a shopper's message into search filters for a product catalog.
The message may be in any language. Fill every field following its description.`;

/**
 * Extracts structured filters from a free-text shopping query.
 * `abortSignal` cancels the underlying request (for example `AbortSignal.timeout(ms)`).
 */
export async function parseQuery(query: string, abortSignal?: AbortSignal): Promise<Filters> {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: filtersSchema }),
    system: SYSTEM,
    prompt: query,
    abortSignal,
  });
  return output;
}
