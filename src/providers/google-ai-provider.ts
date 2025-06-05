import { BaseAIProviderImpl, AIResponse } from '../services/base-ai-provider';
import { AIVendor, ContentPart } from '../utils/ai-providers/base-provider';

/**
 * Google AI provider implementation using the Gemini API
 */
export class GoogleAIProvider extends BaseAIProviderImpl {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
        super();
        this.apiKey = apiKey;
        this.model = model;
        
        // Configure rate limiting (60 requests per minute)
        this.rateLimiter.configure(
            this.getVendor(),
            60,
            60 * 1000
        );
    }

    public getVendor(): AIVendor {
        return AIVendor.GOOGLE;
    }

    /**
     * Get the display name of the provider
     */
    public getProviderName(): string {
        return 'Google AI';
    }
    protected async generateContentImpl(prompt: string, options: any = {}): Promise<string> {
        const response = await this.withRateLimitAndRetry<AIResponse>(() => 
            this.makeApiCall(prompt, options)
        );
        
        if (response.error) {
            throw new Error(response.error.message || 'Failed to generate content');
        }
        
        return response.text || '';
    }
    
    protected async generateMultiModalContentImpl(prompt: string, parts: ContentPart[]): Promise<string> {
        // Multi-modal content generation would go here
        throw new Error('Multi-modal content generation not implemented for Google AI provider');
    }
    
    protected async isApiKeyValidImpl(): Promise<boolean> {
        if (!this.apiKey) return false;
        
        try {
            const response = await this.withRateLimitAndRetry<Response>(() => 
                fetch(`${this.baseUrl}/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'test' }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    })
                })
            );
            
            // If we get a 401, the API key is invalid
            if (response.status === 401) {
                return false;
            }
            
            // For other status codes, check if the response is valid JSON
            const data = await response.json().catch(() => ({}));
            return !!data;
        } catch (error) {
            console.error('Error validating Google AI API key:', error);
            return false;
        }
    }
    
    private async makeApiCall(prompt: string, options: any = {}): Promise<AIResponse> {
        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    topP: options.topP ?? 0.9,
                    topK: options.topK ?? 40,
                    maxOutputTokens: options.maxTokens ?? 2048,
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error?.message || 'Failed to generate content');
            (error as any).status = response.status;
            (error as any).response = { data: errorData };
            throw error;
        }

        const data = await response.json();
        return {
            text: data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        };
    }
}
