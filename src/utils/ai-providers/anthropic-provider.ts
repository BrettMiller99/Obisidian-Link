import Anthropic from '@anthropic-ai/sdk';
import { 
    AIProvider, 
    AIProviderSettings, 
    AIVendor, 
    ModelAvailabilityInfo, 
    ModelAvailabilityStatus,
    showErrorNotice,
    ContentPart
} from './base-provider';

/**
 * Map of known Anthropic models and their availability status
 */
export const ANTHROPIC_MODEL_AVAILABILITY: Record<string, ModelAvailabilityInfo> = {
    // Claude 3 models
    'claude-3-opus-20240229': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'claude-3-sonnet-20240229': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'claude-3-haiku-20240307': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'claude-3-5-sonnet-20240620': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    
    // Claude 2 models
    'claude-2.0': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using Claude 3 models instead.',
        fallbackModel: 'claude-3-sonnet-20240229'
    },
    'claude-2.1': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using Claude 3 models instead.',
        fallbackModel: 'claude-3-sonnet-20240229'
    },
    
    // Claude Instant models
    'claude-instant-1.2': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using Claude 3 Haiku instead.',
        fallbackModel: 'claude-3-haiku-20240307'
    }
};

/**
 * Check if an Anthropic model is likely to be available based on our knowledge
 * @param modelName The model name to check
 * @returns Information about the model's availability
 */
export function checkAnthropicModelAvailability(modelName: string): ModelAvailabilityInfo {
    // Check if we have specific information about this model
    if (modelName in ANTHROPIC_MODEL_AVAILABILITY) {
        return ANTHROPIC_MODEL_AVAILABILITY[modelName];
    }
    
    // If we don't have specific information, make an educated guess based on the model name
    if (modelName.includes('preview')) {
        return {
            status: ModelAvailabilityStatus.LIMITED_PREVIEW,
            reason: 'This appears to be a preview model that may have limited availability.',
            fallbackModel: inferAnthropicFallbackModel(modelName)
        };
    }
    
    // For any other model, we assume it might be available but mark it as unknown
    return {
        status: ModelAvailabilityStatus.UNKNOWN,
        reason: 'This model is not in our database. It may or may not be available with your API key.'
    };
}

/**
 * Try to infer a reasonable fallback model based on the model name
 * @param modelName The original model name
 * @returns A suggested fallback model
 */
function inferAnthropicFallbackModel(modelName: string): string {
    // If it's a Claude 3 model, suggest appropriate fallback
    if (modelName.includes('claude-3')) {
        if (modelName.includes('opus')) {
            return 'claude-3-opus-20240229';
        } else if (modelName.includes('sonnet')) {
            return 'claude-3-sonnet-20240229';
        } else if (modelName.includes('haiku')) {
            return 'claude-3-haiku-20240307';
        }
        // Default Claude 3 fallback
        return 'claude-3-sonnet-20240229';
    }
    
    // Otherwise suggest claude-3-haiku as a general fallback (fastest and cheapest)
    return 'claude-3-haiku-20240307';
}

/**
 * Implementation of the AIProvider interface for Anthropic's Claude models
 */
export class AnthropicProvider implements AIProvider {
    private client: Anthropic;
    private settings: AIProviderSettings;

    constructor(apiKey: string, settings: AIProviderSettings) {
        this.settings = settings;
        this.client = new Anthropic({
            apiKey: apiKey
        });
        
        console.log(`Initializing Anthropic model: ${this.settings.model}`);
    }

    /**
     * Generate content using the Anthropic API
     * @param prompt The prompt to send to Claude
     * @returns The generated content
     */
    async generateContent(prompt: string): Promise<string> {
        try {
            console.log(`Generating content with model: ${this.settings.model}, temperature: ${this.settings.temperature}`);
            
            const message = await this.client.messages.create({
                model: this.settings.model,
                max_tokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                messages: [
                    { role: 'user', content: prompt }
                ]
            });
            
            // Extract the response text
            const responseText = message.content.reduce((acc, item) => {
                if (item.type === 'text') {
                    return acc + item.text;
                }
                return acc;
            }, '');
            
            return responseText;
        } catch (error: any) {
            console.error('Error generating content with Anthropic:', error);
            
            // Get model information for better error messages
            const modelInfo = checkAnthropicModelAvailability(this.settings.model);
            
            // Handle common Anthropic API errors
            if (error.status === 404 || (error.message && error.message.includes('model not found'))) {
                let errorMessage = `Model not available: ${this.settings.model}.`;
                
                if (modelInfo.status === ModelAvailabilityStatus.LIMITED_PREVIEW) {
                    errorMessage += ` ${modelInfo.reason || 'This model has limited availability.'}`;
                    
                    if (modelInfo.fallbackModel) {
                        errorMessage += ` Try using ${modelInfo.fallbackModel} instead.`;
                    }
                } else if (modelInfo.status === ModelAvailabilityStatus.DEPRECATED) {
                    errorMessage += ` ${modelInfo.reason || 'This model is deprecated.'}`;
                    
                    if (modelInfo.fallbackModel) {
                        errorMessage += ` Try using ${modelInfo.fallbackModel} instead.`;
                    }
                } else {
                    errorMessage += ` This model may not exist or may not be available with your API key.`;
                }
                
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            } else if (error.status === 401 || (error.message && error.message.includes('authentication'))) {
                const errorMessage = 'Authentication failed. Please check your Anthropic API key in settings.';
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            } else if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
                const errorMessage = 'Rate limit exceeded. Please try again later or check your Anthropic account usage limits.';
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            } else if (error.status === 400 || (error.message && error.message.includes('invalid request'))) {
                let errorMessage = `Invalid request: ${error.message}.`;
                
                if (error.message && error.message.includes('token')) {
                    errorMessage += ` This may be due to exceeding token limits. Try reducing your input or output token settings.`;
                }
                
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            } else {
                const errorMessage = `Failed to generate content: ${error.message || 'Unknown error'}`;
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            }
        }
    }

    /**
     * Check if the API key is valid by making a simple request
     * @returns True if the API key is valid, false otherwise
     */
    async isApiKeyValid(): Promise<boolean> {
        try {
            await this.generateContent('Hello, please respond with "API key is valid" if you can read this message.');
            return true;
        } catch (error) {
            console.error('Anthropic API key validation failed:', error);
            return false;
        }
    }
    
    /**
     * Generate content using multi-modal inputs (text and images)
     * @param prompt The text prompt to send to the AI
     * @param parts Additional content parts (e.g., images as base64)
     * @returns The generated content
     */
    async generateMultiModalContent(prompt: string, parts: ContentPart[]): Promise<string> {
        // Check if we're using a Claude 3 model that supports vision
        if (!this.settings.model.includes('claude-3') && !this.settings.model.includes('claude-3.5')) {
            const errorMessage = 'Multi-modal content generation requires Claude 3 or newer. Please update your model in settings.';
            showErrorNotice(errorMessage, 10000);
            throw new Error(errorMessage);
        }
        
        try {
            // Build the message content array
            const content: any[] = [];
            
            // Add the text prompt
            content.push({
                type: 'text',
                text: prompt
            });
            
            // Add any images
            for (const part of parts) {
                if (part.type === 'image') {
                    content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/jpeg',
                            data: part.data
                        }
                    });
                } else if (part.type === 'text') {
                    content.push({
                        type: 'text',
                        text: part.data
                    });
                }
            }
            
            // Call the Anthropic API with the multi-modal message
            const message = await this.client.messages.create({
                model: this.settings.model,
                max_tokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                messages: [
                    { role: 'user', content: content }
                ]
            });
            
            // Extract the response text
            const responseText = message.content.reduce((acc, item) => {
                if (item.type === 'text') {
                    return acc + item.text;
                }
                return acc;
            }, '');
            
            return responseText;
        } catch (error: any) {
            console.error('Error generating multi-modal content with Anthropic:', error);
            
            // Handle specific multi-modal errors
            if (error.message && (error.message.includes('image') || error.message.includes('vision') || error.message.includes('multi-modal'))) {
                const errorMessage = `Anthropic multi-modal error: ${error.message}. Make sure you're using a Claude 3 model that supports vision.`;
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            }
            
            // Reuse the existing error handling logic
            throw error; // Let the generateContent method's error handler deal with it
        }
    }
    
    /**
     * Get the vendor of this provider
     * @returns The AI vendor (Anthropic)
     */
    getVendor(): AIVendor {
        return AIVendor.ANTHROPIC;
    }

    /**
     * Get the display name of the provider
     * @returns The provider's display name
     */
    getProviderName(): string {
        return 'Anthropic';
    }
}
