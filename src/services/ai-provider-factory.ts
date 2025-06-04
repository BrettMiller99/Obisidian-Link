import { AIProvider } from '../utils/ai-providers/base-provider';
import { GoogleAIProvider } from '../providers/google-ai-provider';
import { AIVendor } from '../utils/ai-providers/base-provider';

export class AIProviderFactory {
    private static instance: AIProviderFactory;
    private providers: Map<string, AIProvider> = new Map();

    private constructor() {}

    public static getInstance(): AIProviderFactory {
        if (!AIProviderFactory.instance) {
            AIProviderFactory.instance = new AIProviderFactory();
        }
        return AIProviderFactory.instance;
    }

    public getProvider(type: string, apiKey: string, model?: string): AIProvider {
        const cacheKey = `${type}:${model || 'default'}`;
        
        if (!this.providers.has(cacheKey)) {
            const vendor = this.getVendorFromType(type);
            
            switch (vendor) {
                case AIVendor.GOOGLE:
                    this.providers.set(cacheKey, new GoogleAIProvider(apiKey, model));
                    break;
                // Add other providers here
                default:
                    throw new Error(`Unsupported AI provider: ${type}`);
            }
        }

        const provider = this.providers.get(cacheKey);
        if (!provider) {
            throw new Error(`Failed to create provider for type: ${type}`);
        }
        return provider;
    }

    private getVendorFromType(type: string): AIVendor {
        const lowerType = type.toLowerCase();
        
        if (['google', 'google-ai', 'gemini'].includes(lowerType)) {
            return AIVendor.GOOGLE;
        }
        
        throw new Error(`Unknown AI provider type: ${type}`);
    }

    // Clear all providers (useful for testing)
    public clear(): void {
        this.providers.clear();
    }
}
