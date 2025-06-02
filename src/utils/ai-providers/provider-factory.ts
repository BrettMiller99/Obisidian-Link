import { AIProvider, AIProviderSettings, AIVendor } from './base-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';

/**
 * Factory class for creating AI providers
 */
export class AIProviderFactory {
    /**
     * Create an AI provider based on the vendor and settings
     * @param settings The AI provider settings
     * @returns An instance of the appropriate AI provider
     */
    static createProvider(settings: AIProviderSettings): AIProvider {
        const apiKey = settings.apiKey;
        
        switch (settings.vendor) {
            case AIVendor.GOOGLE:
                return new GeminiProvider(apiKey, settings);
            case AIVendor.OPENAI:
                return new OpenAIProvider(apiKey, settings);
            case AIVendor.ANTHROPIC:
                return new AnthropicProvider(apiKey, settings);
            default:
                throw new Error(`Unsupported AI vendor: ${settings.vendor}`);
        }
    }
    
    /**
     * Get the list of available models for a specific vendor
     * @param vendor The AI vendor
     * @returns An array of model IDs
     */
    static getModelsForVendor(vendor: AIVendor): string[] {
        switch (vendor) {
            case AIVendor.GOOGLE:
                return [
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-8b',
                    'gemini-2.0-flash',
                    'gemini-2.0-flash-lite',
                    'gemini-2.0-flash-live-001',
                    'gemini-2.5-pro-preview-05-06',
                    'gemini-2.5-flash-preview-05-20',
                    'gemini-pro'
                ];
            case AIVendor.OPENAI:
                return [
                    'gpt-4o',
                    'gpt-4o-mini',
                    'gpt-4-turbo',
                    'gpt-4',
                    'gpt-3.5-turbo',
                    'gpt-3.5-turbo-instruct'
                ];
            case AIVendor.ANTHROPIC:
                return [
                    'claude-3-5-sonnet-20240620',
                    'claude-3-opus-20240229',
                    'claude-3-sonnet-20240229',
                    'claude-3-haiku-20240307'
                ];
            default:
                return [];
        }
    }
    
    /**
     * Get the default model for a specific vendor
     * @param vendor The AI vendor
     * @returns The default model ID for the vendor
     */
    static getDefaultModelForVendor(vendor: AIVendor): string {
        switch (vendor) {
            case AIVendor.GOOGLE:
                return 'gemini-1.5-flash';
            case AIVendor.OPENAI:
                return 'gpt-3.5-turbo';
            case AIVendor.ANTHROPIC:
                return 'claude-3-haiku-20240307';
            default:
                throw new Error(`Unsupported AI vendor: ${vendor}`);
        }
    }
}
