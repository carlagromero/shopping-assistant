// Pure functions that turn the free-text policy fields of DummyJSON into day counts.
// Kept free of side effects so they can be unit tested (scripts/ingest.ts runs on import).

const DAYS_PER_UNIT: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function toDays(amount: number, unit: string): number {
  const days = DAYS_PER_UNIT[unit.replace(/s$/, "")];
  if (days === undefined) throw new Error(`Unknown time unit: "${unit}"`);
  return amount * days;
}

// The parsers throw on formats they don't know, so a change in the API is noticed instead of ignored.

/** "Ships overnight" -> 1, "Ships in 3-5 business days" -> 5 (the slowest case), "Ships in 2 weeks" -> 14 */
export function parseShippingDays(text: string): number {
  if (text === "Ships overnight") return 1;
  const m = text.match(/^Ships in (\d+)(?:-(\d+))? (business days|days|weeks?|months?)$/);
  if (!m) throw new Error(`Unknown shipping text: "${text}"`);
  const amount = Number(m[2] ?? m[1]);
  return toDays(amount, m[3].replace("business ", ""));
}

/** "No return policy" -> 0, "30 days return policy" -> 30 */
export function parseReturnDays(text: string): number {
  if (text === "No return policy") return 0;
  const m = text.match(/^(\d+) days return policy$/);
  if (!m) throw new Error(`Unknown return text: "${text}"`);
  return Number(m[1]);
}

/** "No warranty" -> 0, "2 year warranty" -> 730, "Lifetime warranty" -> null */
export function parseWarrantyDays(text: string): number | null {
  if (text === "No warranty") return 0;
  if (text === "Lifetime warranty") return null;
  const m = text.match(/^(\d+) (weeks?|months?|years?) warranty$/);
  if (!m) throw new Error(`Unknown warranty text: "${text}"`);
  return toDays(Number(m[1]), m[2]);
}
