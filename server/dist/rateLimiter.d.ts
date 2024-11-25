export declare class RateLimiter {
    private limit;
    private windowMs;
    private requests;
    private lastReset;
    constructor(limit: number, windowMs: number);
    checkLimit(): boolean;
}
