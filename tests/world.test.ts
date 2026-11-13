import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { open, reset, seed, tables } from "../world/lib/oms";

test("the world seeds the numbers the READMEs promise", () => {
  const folder = mkdtempSync(join(tmpdir(), "cb-test-"));
  reset(folder);
  const db = open(folder, true);
  const countOf = (sql: string) => (db.query(sql).get() as { total: number }).total;
  expect(countOf("SELECT COUNT(*) total FROM customers")).toBe(9000);
  expect(countOf("SELECT COUNT(*) total FROM reports")).toBe(4200);
  expect(countOf("SELECT COUNT(*) total FROM crews")).toBe(9);
  expect(countOf("SELECT COUNT(*) total FROM devices")).toBe(77);
  expect(countOf("SELECT COUNT(*) total FROM customers WHERE critical IS NOT NULL")).toBe(9);
  expect(countOf("SELECT COUNT(*) total FROM outages")).toBe(0);
  db.close();
  expect(tables(folder)).toContain("meter_reads");
});

test("the answer key holds 31 outages, one nested under a recloser", () => {
  const truth = seed.truth();
  expect(truth.outages.length).toBe(31);
  const nested = truth.outages.filter((outage) => outage.nestedUnder);
  expect(nested.map((outage) => outage.device)).toEqual(["FU-F05-2"]);
  expect(Object.keys(truth.reportTruth).length).toBe(4200);
});
