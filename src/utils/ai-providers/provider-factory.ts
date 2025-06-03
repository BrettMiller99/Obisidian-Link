import { AIProvider, AIProviderSettings, AIVendor } from './base-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { MCPProvider } from './mcp-provider';

/**
 * Factory class for creating AI providers
 */
export class AIProviderFactory {
    /**
     * Create an AI provider based on the vendor and settings
     * @param settings The AI provider settings
     * @returns An instance of the appropriate AI provider
     */
    static async createProvider(settings: AIProviderSettings): Promise<AIProvider> {
        const apiKey = settings.apiKey;
        const useMCP = settings.useMCP;
        const mcpServerUrl = settings.mcpServerUrl;
        
        // If MCP is enabled and we have a server URL, use the MCP provider
        if (useMCP && mcpServerUrl) {
            const mcpProvider = new MCPProvider(apiKey, settings, mcpServerUrl);
            
            // Check if the specified model exists on the MCP server
            if (settings.model) {
                const isModelValid = await mcpProvider.validateModel(settings.model);
                
                // If the model doesn't exist, try to select the best available model
                if (!isModelValid) {
                    console.log(`Model ${settings.model} not found on MCP server, attempting to select best available model`);
                    const bestModel = await mcpProvider.selectBestAvailableModel(settings.vendor);
                    
                    if (bestModel) {
                        console.log(`Selected best available model: ${bestModel}`);
                        settings.model = bestModel;
                    } else {
                        console.warn(`No available models found for vendor ${settings.vendor} on MCP server`);
                    }
                }
            }
            
            return mcpProvider;
        }
        
        // Otherwise use the direct provider based on vendor
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
    
    /**
     * Get available MCP server models
     * @param mcpServerUrl The MCP server URL
     * @param apiKey The API key for the MCP server
     * @returns A promise that resolves to an array of available models
     */
    static async getMCPModels(mcpServerUrl: string, apiKey: string): Promise<string[]> {
        try {
            const response = await fetch(`${mcpServerUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.error('Failed to fetch MCP models:', response.statusText);
                return [];
            }
            
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Error fetching MCP models:', error);
            return [];
        }
    }
}
