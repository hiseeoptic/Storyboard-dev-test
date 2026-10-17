import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// React needs the same hooks in the same order on every render. The generator
// returns early per phase (generating / script / result); a hook declared
// below those returns disappears when the phase changes and React crashes the
// whole page ("Đã có lỗi xảy ra").
test("no hook is declared after the generator's phase early-returns", () => {
  const source = readFileSync(new URL("./generate-client.tsx", import.meta.url), "utf8");
  const firstReturn = source.indexOf('\n  if (phase === "generating")');
  const componentEnd = source.indexOf("\nexport function GenerateClient()");
  assert.ok(firstReturn > 0 && componentEnd > firstReturn, "markers found");
  const tail = source.slice(firstReturn, componentEnd);
  const late = tail.split("\n").filter((line) => /^ {2}(?:const [^=]+= )?use[A-Z]\w*\s*[(<]/.test(line));
  assert.deepEqual(late, []);
});
