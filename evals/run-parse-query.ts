import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { MODEL_ID, parseQuery } from "../src/lib/parse-query";
import { cases as allCases, type EvalCase } from "./parse-query.cases";
import { pct, scoredFields, summarize, type Attempt, type Summary } from "./report";
import { scoreCase } from "./score";

// Runs the eval set against the real model and prints a report. Costs money: never part of
// `pnpm test` or CI.
// Usage: pnpm eval [--case <id>] [--runs <n>]

const CONCURRENCY = 4;
const TIMEOUT_MS = 60_000;

const show = (v: unknown) => JSON.stringify(v);

// Reads --case and --runs, and returns the cases to run plus how many times to repeat them.
function parseCli(): { cases: readonly EvalCase[]; runs: number } {
  const { values } = parseArgs({
    options: {
      case: { type: "string" },
      runs: { type: "string", default: "1" },
    },
  });

  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    console.error("--runs must be a positive integer");
    process.exit(1);
  }

  const cases = values.case ? allCases.filter((c) => c.id === values.case) : allCases;
  if (cases.length === 0) {
    console.error(`No case with id "${values.case}". Ids:\n  ${allCases.map((c) => c.id).join("\n  ")}`);
    process.exit(1);
  }
  return { cases, runs };
}

// Runs one case once: calls the model, scores the output and times it. Never throws; an error becomes a failed attempt.
async function attempt(c: EvalCase, run: number): Promise<Attempt> {
  const start = Date.now();
  try {
    // The signal aborts the HTTP request itself, not just the wait for it.
    const output = await parseQuery(c.query, AbortSignal.timeout(TIMEOUT_MS));
    return { caseId: c.id, run, output, score: scoreCase(c, output), latencyMs: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { caseId: c.id, run, output: null, error, score: null, latencyMs: Date.now() - start };
  }
}

// Runs `jobs` with at most `limit` in flight; results keep the order of `jobs`.
async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
  return results;
}

// Prints every failed attempt: the fields that missed (expected vs got) or the error.
function printFailures(cases: readonly EvalCase[], attempts: Attempt[], runs: number) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const failing = attempts.filter((a) => !a.score?.pass);
  if (failing.length > 0) console.log("\nFailing cases:");
  for (const a of failing) {
    const tag = `${a.caseId}${runs > 1 ? ` (run ${a.run})` : ""}${byId.get(a.caseId)?.gap ? " [gap]" : ""}`;
    if (a.error !== undefined) {
      console.log(`  ${tag}: ERROR ${a.error}`);
      continue;
    }
    const bad = a.score!.fields.filter((f) => !f.pass);
    console.log(`  ${tag}: ${bad.map((f) => f.field).join(", ")}`);
    for (const f of bad) console.log(`      ${f.field}: expected ${show(f.expected)}, got ${show(f.actual)}`);
  }
}

// Prints the overall score and the accuracy per field and per intent.
function printScores(s: Summary) {
  console.log("\nScore");
  console.log(`  main (non-gap): ${s.main.passed}/${s.main.total} (${pct(s.main)})`);
  console.log(`  gap:            ${s.gap.passed}/${s.gap.total} (${pct(s.gap)})`);
  if (s.errors > 0) console.log(`  failed calls:   ${s.errors}`);

  console.log("\nAccuracy per field");
  for (const f of scoredFields(s)) {
    const r = s.perField[f]!;
    console.log(`  ${f.padEnd(11)} ${r.passed}/${r.total} (${pct(r)})`);
  }

  console.log("\nAccuracy per intent (expected)");
  for (const [intent, r] of Object.entries(s.perIntent)) {
    console.log(`  ${intent.padEnd(19)} ${r.passed}/${r.total} (${pct(r)})`);
  }
}

// Prints the pass rate of each case and lists the flaky ones (only useful with --runs > 1).
function printFlakiness(s: Summary) {
  console.log("\nPass rate per case");
  for (const c of s.perCase) {
    console.log(`  ${c.id.padEnd(40)} ${c.rate.passed}/${c.rate.total}${c.gap ? " [gap]" : ""}`);
  }
  console.log(`\nFlaky cases: ${s.flaky.length ? s.flaky.join(", ") : "none"}`);
}

// Writes the run (model, commit, summary, every attempt) to evals/results/ and returns the file path.
function saveResults(runs: number, summary: Summary, attempts: Attempt[]): string {
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {}
  const timestamp = new Date().toISOString();
  mkdirSync("evals/results", { recursive: true });
  const file = `evals/results/${timestamp.replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    file,
    JSON.stringify({ timestamp, model: MODEL_ID, commit, runs, summary, attempts }, null, 2),
  );
  return file;
}

async function main() {
  const { cases, runs } = parseCli();

  const jobs = Array.from({ length: runs }, (_, r) => cases.map((c) => () => attempt(c, r + 1))).flat();
  console.log(`Running ${cases.length} case(s) x ${runs} run(s) with ${MODEL_ID}...`);
  const attempts = await pool(jobs, CONCURRENCY);

  const summary = summarize(cases, attempts);
  printFailures(cases, attempts, runs);
  printScores(summary);
  if (runs > 1) printFlakiness(summary);

  console.log(`\nResults written to ${saveResults(runs, summary, attempts)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
