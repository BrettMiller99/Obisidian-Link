import { RateLimiter } from './rate-limiter';
import { Notice } from 'obsidian';
import { AIVendor, AIProvider as BaseAIProvider, ContentPart } from '../utils/ai-providers/base-provider';

export interface AIResponse {
    text?: string;
    error?: {
        code: number;
        message: string;
        retryable: boolean;
        retryAfter?: number; // in seconds
    };
}

/**
 * Base class for AI providers that includes rate limiting and retry logic.
 * Extend this class to implement specific AI providers.
 */
export abstract class BaseAIProviderImpl implements BaseAIProvider {
    protected readonly rateLimiter = RateLimiter.getInstance();
    protected readonly maxRetries = 3;
    protected readonly initialBackoffMs = 1000; // 1 second initial backoff

    // Abstract methods - must be implemented by subclasses
    public abstract getVendor(): AIVendor;
    public abstract getProviderName(): string;
    protected abstract generateContentImpl(prompt: string, options?: any): Promise<string>;
    protected abstract generateMultiModalContentImpl(prompt: string, parts: ContentPart[]): Promise<string>;
    protected abstract isApiKeyValidImpl(): Promise<boolean>;

    /**
     * Generate content using the AI provider with rate limiting and retry logic
     */
    async generateContent(prompt: string): Promise<string> {
        return this.withRateLimitAndRetry<string>(() => 
            this.generateContentImpl(prompt)
        );
    }

    /**
     * Generate multi-modal content using the AI provider with rate limiting and retry logic
     */
    async generateMultiModalContent(prompt: string, parts: ContentPart[]): Promise<string> {
        return this.withRateLimitAndRetry<string>(() =>
            this.generateMultiModalContentImpl(prompt, parts)
        );
    }

    /**
     * Validate the API key with rate limiting and retry logic
     */
    async isApiKeyValid(): Promise<boolean> {
        return this.withRateLimitAndRetry<boolean>(() =>
            this.isApiKeyValidImpl()
        );
    }

    /**
     * Wraps an API call with rate limiting and retry logic
     */
    protected async withRateLimitAndRetry<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            try {
                // Use the rate limiter with the actual API call
                return await this.rateLimiter.withRateLimit(this.getVendor(), async () => {
                    return await fn();
                });
            } catch (error: any) {
                lastError = error;
                
                // Check if this is a rate limit error
                const isRateLimit = error.status === 429 || error.status === 503;
                const retryAfter = this.getRetryAfter(error);
                
                // If not a rate limit error or we've exceeded max retries, rethrow
                if (!isRateLimit || attempt >= this.maxRetries) {
                    break;
                }
                
                // Calculate backoff with exponential delay
                const backoffMs = this.calculateBackoff(attempt, retryAfter);
                console.warn(`[${this.getVendor()}] Rate limited. Retrying in ${backoffMs}ms...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                attempt++;
            }
        }
        
        // If we get here, all retries failed
        throw lastError || new Error('Request failed after multiple attempts');
    }

    /**
     * Extracts retry-after header from error response
     */
    private getRetryAfter(error: any): number | null {
        // Check for retry-after header
        if (error.response?.headers?.has('retry-after')) {
            const retryAfter = parseInt(error.response.headers.get('retry-after'), 10);
            if (!isNaN(retryAfter)) {
                return retryAfter * 1000; // Convert to ms
            }
        }
        
        // Check for retryAfter in error response body
        if (error.response?.data?.retryAfter) {
            return error.response.data.retryAfter * 1000; // Convert to ms
        }
        
        return null;
    }

    /**
     * Calculates backoff time with exponential delay and jitter
     */
    private calculateBackoff(attempt: number, retryAfter: number | null): number {
        // Use retry-after header if available
        if (retryAfter) {
            return retryAfter;
        }
        
        // Otherwise use exponential backoff with jitter
        const jitter = Math.random() * 0.2 + 0.9; // Random between 0.9 and 1.1
        return Math.min(
            this.initialBackoffMs * Math.pow(2, attempt) * jitter,
            30000 // Max 30 seconds
        );
    }

    constructor() {
        // Configure default rate limits (can be overridden by subclasses)
        this.rateLimiter.configure(
            this.getVendor(),
            10, // 10 requests
            60 * 1000 // per minute
        );
    }

    /**
     * Shows a notice to the user
     */
    protected showNotice(message: string, timeout = 5000): void {
        new Notice(`[${this.getProviderName()}] ${message}`, timeout);
    }

    /**
     * Logs an error and shows a notice to the user
     */
    protected handleError(error: Error, context: string): void {
        console.error(`[${this.getProviderName()}] ${context}:`, error);
        this.showNotice(`Error: ${context}. ${error.message}`);
    }
}
