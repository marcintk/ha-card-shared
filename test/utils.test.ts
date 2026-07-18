import { describe, expect, it } from "vitest";
import { timeAgo } from "../src/utils.js";

describe("timeAgo", () => {
  it('formats seconds as "Xs"', () => expect(timeAgo(10_000)).toBe("10s"));
  it('formats 59 seconds as "59s"', () => expect(timeAgo(59_999)).toBe("59s"));
  it('formats 60 seconds as "1m"', () => expect(timeAgo(60_000)).toBe("1m"));
  it('formats minutes as "Xm"', () => expect(timeAgo(150_000)).toBe("2m"));
  it('formats 41 minutes as "41m"', () => expect(timeAgo(2_460_000)).toBe("41m"));
  it('formats 3600 seconds as "1h"', () => expect(timeAgo(3_600_000)).toBe("1h"));
  it('formats hours as "Xh"', () => expect(timeAgo(7_200_000)).toBe("2h"));
});
