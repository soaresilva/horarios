// Eval for the Primavera Sound 2027 guess. No DB, no network, no LLM.
//
//   npm run eval:ps27                       pattern fit against PS24 and PS26
//   npm run eval:ps27 -- --score real.json  how close it came, once the real
//                                           timetable is out (an array of
//                                           { day, stage, name, start, end })
import { readFileSync } from "node:fs";
import path from "node:path";
import { patternFit, scoreGuess, type PsHistory, type RealSet } from "./ps/eval";
import type { PsSnapshot } from "./ps/plan";

const data = (file: string) => JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "data", file), "utf8"));
const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

const snapshot = data("ps27.json") as PsSnapshot;
const scoreFile = process.argv[process.argv.indexOf("--score") + 1];

if (process.argv.includes("--score")) {
  const real = JSON.parse(readFileSync(scoreFile, "utf8")) as RealSet[];
  const score = scoreGuess(snapshot.sets, real);
  console.log(`Acts in both timetables: ${score.matched}/${snapshot.sets.length}`);
  console.log(`Exact stage:           ${percent(score.exactStage)}`);
  console.log(`Right stage size:      ${percent(score.stageClass)}`);
  console.log(`Start within an hour:  ${percent(score.startWithinHour)}`);
  if (score.unmatched.length) console.log(`Not in the real timetable: ${score.unmatched.join(", ")}`);
} else {
  const fit = patternFit(snapshot.sets, data("ps-history.json") as PsHistory);
  console.log(`Slot fit: ${percent(fit.slotFit)}`);
  if (fit.misses.length) console.log(`No past slot nearby:\n  ${fit.misses.join("\n  ")}`);
  if (fit.failures.length) {
    console.error(`FAIL\n  ${fit.failures.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("PASS");
  }
}
