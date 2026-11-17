import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo";

const NOW = Date.UTC(2026, 10, 17, 12, 0, 0), ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();
describe("timeAgo", () => {
  it("uses the short unit that fits and floors", () => {
    expect(timeAgo(ago(20), NOW)).toBe("now");
    expect(timeAgo(ago(60), NOW)).toBe("1m");
    expect(timeAgo(ago(59 * 60 + 59), NOW)).toBe("59m");
    expect(timeAgo(ago(3600), NOW)).toBe("1h");
    expect(timeAgo(ago(23 * 3600 + 59 * 60), NOW)).toBe("23h");
    expect(timeAgo(ago(86400), NOW)).toBe("1d");
    expect(timeAgo(ago(6 * 86400), NOW)).toBe("6d");
    expect(timeAgo(ago(7 * 86400), NOW)).toBe("1w");
    expect(timeAgo(ago(29 * 86400), NOW)).toBe("4w");
    expect(timeAgo(ago(30 * 86400), NOW)).toBe("1mo");
    expect(timeAgo(ago(364 * 86400), NOW)).toBe("12mo");
    expect(timeAgo(ago(365 * 86400), NOW)).toBe("1y");
  });
  it("never shows a negative age and survives bad input", () => {
    expect(timeAgo(new Date(NOW + 5 * 60_000), NOW)).toBe("now");
    expect(timeAgo("not a date", NOW)).toBe("");
  });
  it("accepts a timestamp number too", () => { expect(timeAgo(NOW - 2 * 3600_000, NOW)).toBe("2h"); });
});
