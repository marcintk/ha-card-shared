import { describe, expect, it } from "vitest";
import { snapHtml } from "../src/test-utils.js";

describe("snapHtml", () => {
  it("strips Lit comment markers", () => {
    expect(snapHtml("<!--?lit$013215205$-->")).toBe("<!--?-->");
  });
  it("strips Lit binding ids", () => {
    expect(snapHtml('class="lit$987654321$"')).toBe('class="lit$"');
  });
  it("strips both in the same string", () => {
    expect(snapHtml('<!--?lit$111$--><span class="lit$222$">x</span>')).toBe(
      '<!--?--><span class="lit$">x</span>'
    );
  });
  it("passes through clean HTML unchanged", () => {
    expect(snapHtml("<div>hello</div>")).toBe("<div>hello</div>");
  });
});
