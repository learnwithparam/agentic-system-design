import { expect, test } from "bun:test";
import { finishedBoards, sameBoards } from "../checks/lib/world";

test("three fresh replay runs give the same board, and the must-nevers hold", async () => {
  const boards = await finishedBoards(3);
  expect(sameBoards(boards)).toBe(true);
  const b = boards[0];
  expect(b.outages_found).toBe(b.outages_true);
  expect(b.closed_while_dark).toBe(0);
  expect(b.critical_called_by_person).toBe(b.critical_customers_dark);
  expect(b.must_never_blocked).toBeGreaterThan(0);
  expect(b.model_cost_usd).toBeGreaterThan(0);
}, 60000);
