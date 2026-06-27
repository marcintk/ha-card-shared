import { expect, test } from "vitest";
import { version } from "../src/index.js";

// vitest.base.mjs defines __CARD_VERSION__ as "test"; this proves the define + 100% coverage gate work.
test("version() reads the injected build global", () => {
  expect(version()).toBe("test");
});
