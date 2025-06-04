type RateLimitConfig = {
    maxRequests: number;
    timeWindow: number; // in milliseconds
    provider: string;
};

type RateLimitState = {
    count: number;
    lastReset: number;
    queue: Array<() => void>;
};

export class RateLimiter {
    private static instance: RateLimiter;
    private limits: Map<string, RateLimitState> = new Map();
    private configs: Map<string, RateLimitConfig> = new Map();

    private constructor() {}

    public static getInstance(): RateLimiter {
        if (!RateLimiter.instance) {
            RateLimiter.instance = new RateLimiter();
        }
        return RateLimiter.instance;
    }

    public configure(provider: string, maxRequests: number, timeWindow: number): void {
        this.configs.set(provider, { maxRequests, timeWindow, provider });
        if (!this.limits.has(provider)) {
            this.limits.set(provider, { count: 0, lastReset: Date.now(), queue: [] });
        }
    }

    public async withRateLimit<T>(provider: string, fn: () => Promise<T>): Promise<T> {
        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`No rate limit configuration found for provider: ${provider}`);
        }

        const limit = this.limits.get(provider)!;
        this.cleanupOldRequests(limit, config);

        if (limit.count >= config.maxRequests) {
            // If we're at the limit, wait for the next available slot
            await new Promise<void>((resolve) => {
                limit.queue.push(resolve);
            });
        }

        limit.count++;

        try {
            return await fn();
        } finally {
            // Process the next request in the queue if available
            this.processQueue(provider);
        }
    }

    private cleanupOldRequests(limit: RateLimitState, config: RateLimitConfig): void {
        const now = Date.now();
        if (now - limit.lastReset >= config.timeWindow) {
            limit.count = 0;
            limit.lastReset = now;
        }
    }

    private processQueue(provider: string): void {
        const limit = this.limits.get(provider);
        const config = this.configs.get(provider);
        
        if (!limit || !config) return;

        this.cleanupOldRequests(limit, config);

        if (limit.queue.length > 0 && limit.count < config.maxRequests) {
            const next = limit.queue.shift();
            if (next) next();
        }
    }

    // Clear all rate limiting state (useful for tests)
    public clear(): void {
        this.limits.clear();
    }
}
