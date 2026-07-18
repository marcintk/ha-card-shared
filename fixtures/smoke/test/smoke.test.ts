import { expect, test } from "vitest";
import { DebugMetrics, SubscriptionManager, timeAgo } from "ha-card-shared/runtime";
import { version } from "../src/index.js";

// vitest.base.mjs defines __CARD_VERSION__ as "test"; this proves the define + 100% coverage gate work.
test("version() reads the injected build global", () => {
  expect(version()).toBe("test");
});

// Verifies the ha-card-shared/runtime export resolves and is usable from a consumer context.
test("runtime exports are usable", () => {
  expect(timeAgo(90_000)).toBe("1m");
  const mgr = new SubscriptionManager();
  expect(mgr.active).toBe(false);
  const dbg = new DebugMetrics();
  expect(dbg.tableHtml()).toContain("events");
});
