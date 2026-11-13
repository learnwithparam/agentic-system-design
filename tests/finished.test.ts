import { expect, test } from "bun:test";
import { finishedBoards, sameBoards } from "../checks/lib/world";

test("three fresh replay runs give the same board, and the must-nevers hold", async () => {
  const boards = await finishedBoards(3);
  expect(sameBoards(boards)).toBe(true);
  const board = boards[0];
  expect(board.outagesFound).toBe(board.outagesTrue);
  expect(board.closedWhileDark).toBe(0);
  expect(board.criticalCalledByPerson).toBe(board.criticalCustomersDark);
  expect(board.mustNeverBlocked).toBeGreaterThan(0);
  expect(board.modelCostUsd).toBeGreaterThan(0);
}, 60000);
