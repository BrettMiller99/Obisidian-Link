import OpenAI from 'openai';
import { 
    AIProvider, 
    AIProviderSettings, 
    AIVendor, 
    ModelAvailabilityInfo, 
    ModelAvailabilityStatus,
    showErrorNotice
} from './base-provider';

/**
 * Map of known OpenAI models and their availability status
 */
export const OPENAI_MODEL_AVAILABILITY: Record<string, ModelAvailabilityInfo> = {
    // GPT-4 models
    'gpt-4': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-4-turbo': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-4-turbo-preview': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-4-vision-preview': { 
        status: ModelAvailabilityStatus.GENERALLY_AVAILABLE,
        reason: 'This model supports image inputs which are not currently supported in this plugin.'
    },
    'gpt-4-32k': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-4-32k-0613': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using gpt-4-turbo instead.',
        fallbackModel: 'gpt-4-turbo'
    },
    'gpt-4-0613': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using gpt-4-turbo instead.',
        fallbackModel: 'gpt-4-turbo'
    },
    
    // GPT-3.5 models
    'gpt-3.5-turbo': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-3.5-turbo-16k': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using gpt-3.5-turbo instead, which has been updated with 16k context.',
        fallbackModel: 'gpt-3.5-turbo'
    },
    'gpt-3.5-turbo-instruct': { status: ModelAvailabilityStatus.GENERALLY_AVAILABLE },
    'gpt-3.5-turbo-0613': { 
        status: ModelAvailabilityStatus.DEPRECATED,
        reason: 'This model is deprecated. Consider using gpt-3.5-turbo instead.',
        fallbackModel: 'gpt-3.5-turbo'
    },
    
    // Experimental/Preview models
    'gpt-4o': { 
        status: ModelAvailabilityStatus.GENERALLY_AVAILABLE,
        reason: 'This is OpenAI\'s latest model with improved capabilities.'
    },
    'gpt-4o-mini': { 
        status: ModelAvailabilityStatus.GENERALLY_AVAILABLE,
        reason: 'This is a smaller, faster version of GPT-4o.'
    }
};

/**
 * Check if an OpenAI model is likely to be available based on our knowledge
 * @param modelName The model name to check
 * @returns Information about the model's availability
 */
export function checkOpenAIModelAvailability(modelName: string): ModelAvailabilityInfo {
    // Check if we have specific information about this model
    if (modelName in OPENAI_MODEL_AVAILABILITY) {
        return OPENAI_MODEL_AVAILABILITY[modelName];
    }
    
    // If we don't have specific information, make an educated guess based on the model name
    if (modelName.includes('preview')) {
        return {
            status: ModelAvailabilityStatus.LIMITED_PREVIEW,
            reason: 'This appears to be a preview model that may have limited availability.',
            fallbackModel: inferOpenAIFallbackModel(modelName)
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
function inferOpenAIFallbackModel(modelName: string): string {
    // If it's a GPT-4 model, suggest gpt-4-turbo as fallback
    if (modelName.includes('gpt-4')) {
        return 'gpt-4-turbo';
    }
    
    // Otherwise suggest gpt-3.5-turbo as a general fallback
    return 'gpt-3.5-turbo';
}

/**
 * Implementation of the AIProvider interface for OpenAI models
 */
export class OpenAIProvider implements AIProvider {
    private client: OpenAI;
    private settings: AIProviderSettings;

    constructor(apiKey: string, settings: AIProviderSettings) {
        this.settings = settings;
        this.client = new OpenAI({
            apiKey: apiKey
        });
        
        console.log(`Initializing OpenAI model: ${this.settings.model}`);
    }

    /**
     * Generate content using the OpenAI API
     * @param prompt The prompt to send to OpenAI
     * @returns The generated content
     */
    async generateContent(prompt: string): Promise<string> {
        try {
            console.log(`Generating content with model: ${this.settings.model}, temperature: ${this.settings.temperature}`);
            
            const completion = await this.client.chat.completions.create({
                model: this.settings.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.settings.temperature,
                max_tokens: this.settings.maxTokens
            });
            
            // Extract the response text
            const responseText = completion.choices[0]?.message?.content || '';
            return responseText;
        } catch (error: any) {
            console.error('Error generating content with OpenAI:', error);
            
            // Get model information for better error messages
            const modelInfo = checkOpenAIModelAvailability(this.settings.model);
            
            // Handle common OpenAI API errors
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
                const errorMessage = 'Authentication failed. Please check your OpenAI API key in settings.';
                showErrorNotice(errorMessage, 10000);
                throw new Error(errorMessage);
            } else if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
                const errorMessage = 'Rate limit exceeded. Please try again later or check your OpenAI account usage limits.';
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
            console.error('OpenAI API key validation failed:', error);
            return false;
        }
    }
    
    /**
     * Get the vendor of this provider
     * @returns The AI vendor (OpenAI)
     */
    getVendor(): AIVendor {
        return AIVendor.OPENAI;
    }
}
