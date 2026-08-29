import { afterEach, describe, expect, it } from "vitest";
import { cardBundle } from "../rollup.base.mjs";

const original = process.env.npm_package_name;
afterEach(() => {
  // Assigning undefined would store the string "undefined" — delete is the only real unset.
  if (original === undefined) delete process.env.npm_package_name;
  else process.env.npm_package_name = original;
});

describe("cardBundle output filename", () => {
  it("names the bundle after the card", () => {
    expect(cardBundle({ name: "ha-teamtracker-scoreboard-card" }).output.file).toBe(
      "dist/ha-teamtracker-scoreboard-card.js"
    );
  });

  it("takes the name from npm metadata when none is passed", () => {
    process.env.npm_package_name = "ha-news-card";
    expect(cardBundle().output.file).toBe("dist/ha-news-card.js");
  });

  it('falls back to "card" when the package name is absent', () => {
    delete process.env.npm_package_name;
    expect(cardBundle().output.file).toBe("dist/card.js");
  });
});
