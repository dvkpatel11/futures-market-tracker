export class RateLimiter {
  private requests: number = 0;
  private lastReset: number = Date.now();

  /**
   * Creates an instance of RateLimiter.
   * @param limit - Maximum number of requests allowed in the time window.
   * @param windowMs - Time window in milliseconds for which the limit applies.
   */
  constructor(private limit: number, private windowMs: number) {}

  /**
   * Checks if a request can be processed based on the rate limit.
   * @returns An object indicating whether the request is allowed and remaining requests.
   */
  checkLimit(): { allowed: boolean; remaining: number } {
    const now = Date.now();

    // Reset the request count if the time window has elapsed
    if (now - this.lastReset >= this.windowMs) {
      this.requests = 0;
      this.lastReset = now;
    }

    // Check if the limit is exceeded
    if (this.requests >= this.limit) {
      return { allowed: false, remaining: 0 };
    }

    this.requests++;
    return { allowed: true, remaining: this.limit - this.requests };
  }
}
