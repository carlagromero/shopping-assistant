import { generateText, Output } from "ai";
import { filtersSchema, type Filters } from "./filters";
import { anthropic } from "@ai-sdk/anthropic";

const MODEL = anthropic("claude-haiku-5-5");

const SYSTEM = `You turn a shopper's message into search filters for a product catalog.
The message may be in any language. Fill every field following its description.`;

/** Extracts structured filters from a free-text shopping query. */
export async function parseQuery(query: string): Promise<Filters> {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: filtersSchema }),
    system: SYSTEM,
    prompt: query,
  });
  return output;
}
