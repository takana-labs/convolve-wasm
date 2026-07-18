import assert from "node:assert/strict";
import test from "node:test";

import { validatePhysicalAndroidEvidence } from "../scripts/verify-android-release-gate.mjs";

const pass = "# evidence\n\n**Physical Android status:** Pass\n";

test("Android release gate permits only two explicit Pass records", () => {
  assert.doesNotThrow(() => validatePhysicalAndroidEvidence(pass, pass));
});

for (const [name, first, second] of [
  ["v0.1.1 Not run", "**Physical Android status:** Not run", pass],
  ["v0.1.2 Failed", pass, "**Physical Android status:** Failed"],
  ["missing status", pass, "# no status"],
  ["malformed status", pass, "**Physical Android status:** PASS"],
  ["mixed status lines", pass, "**Physical Android status:** Pass\n**Physical Android status:** Not run"],
]) {
  test(`Android release gate rejects ${name}`, () => {
    assert.throws(() => validatePhysicalAndroidEvidence(first, second), /must contain exactly/);
  });
}