import { describe, it, expect } from "vitest";
import { SimpleRateLimiter } from "../server/rateLimit.js";

describe("SimpleRateLimiter", () => {
  it("allows requests up to the limit within the window", () => {
    const limiter = new SimpleRateLimiter({ windowMs: 1000, maxRequests: 2 });
    expect(limiter.isAllowed("a", 0)).toBe(true);
    expect(limiter.isAllowed("a", 0)).toBe(true);
    expect(limiter.isAllowed("a", 0)).toBe(false);
  });

  it("resets the bucket after the window expires", () => {
    const limiter = new SimpleRateLimiter({ windowMs: 1000, maxRequests: 1 });
    expect(limiter.isAllowed("a", 0)).toBe(true);
    expect(limiter.isAllowed("a", 500)).toBe(false);
    expect(limiter.isAllowed("a", 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new SimpleRateLimiter({ windowMs: 1000, maxRequests: 1 });
    expect(limiter.isAllowed("a", 0)).toBe(true);
    expect(limiter.isAllowed("b", 0)).toBe(true);
  });

  it("cleanup removes expired buckets", () => {
    const limiter = new SimpleRateLimiter({ windowMs: 1000, maxRequests: 1 });
    limiter.isAllowed("a", 0);
    limiter.cleanup(2000);
    expect(limiter.isAllowed("a", 2000)).toBe(true);
  });
});
