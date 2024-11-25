export class RateLimiter {
    limit;
    windowMs;
    requests = 0;
    lastReset = Date.now();
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }
    checkLimit() {
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
//# sourceMappingURL=rateLimiter.js.map