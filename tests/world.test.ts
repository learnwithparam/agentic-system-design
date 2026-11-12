import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { open, reset, seed, tables } from "../world/lib/oms";

test("the world seeds the numbers the READMEs promise", () => {
  const dir = mkdtempSync(join(tmpdir(), "cb-test-"));
  reset(dir);
  const db = open(dir, true);
  const n = (sql: string) => (db.query(sql).get() as { n: number }).n;
  expect(n("SELECT COUNT(*) n FROM customers")).toBe(9000);
  expect(n("SELECT COUNT(*) n FROM reports")).toBe(4200);
  expect(n("SELECT COUNT(*) n FROM crews")).toBe(9);
  expect(n("SELECT COUNT(*) n FROM devices")).toBe(77);
  expect(n("SELECT COUNT(*) n FROM customers WHERE critical IS NOT NULL")).toBe(9);
  expect(n("SELECT COUNT(*) n FROM outages")).toBe(0);
  db.close();
  expect(tables(dir)).toContain("meter_reads");
});

test("the answer key holds 31 outages, one nested under a recloser", () => {
  const t = seed.truth();
  expect(t.outages.length).toBe(31);
  expect(t.outages.filter((o) => o.nested_under).map((o) => o.device)).toEqual(["FU-F05-2"]);
  expect(Object.keys(t.report_truth).length).toBe(4200);
});
