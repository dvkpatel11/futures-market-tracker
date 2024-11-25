export class RateLimiter {
  private requests: number = 0;
  private lastReset: number = Date.now();

  constructor(private limit: number, private windowMs: number) {}

  checkLimit(): boolean {
    const now = Date.now();
    if (now - this.lastReset >= this.windowMs) {
      this.requests = 0;
      this.lastReset = now;
    }

    if (this.requests >= this.limit) {
      return false;
    }

    this.requests++;
    return true;
  }
}
