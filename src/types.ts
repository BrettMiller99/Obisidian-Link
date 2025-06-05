import { Notice } from 'obsidian';
import { AIVendor } from './utils/ai-providers/base-provider';

/**
 * Summary detail levels
 */
export enum SummaryLevel {
    BRIEF = 'brief',
    NORMAL = 'normal',
    DETAILED = 'detailed'
}

/**
 * Legacy type for backward compatibility
 * @deprecated Use ModelOption instead
 */
export type ObsidianLinkModelOption = string;

/**
 * Model categories for UI organization
 */
export interface ModelCategory {
    name: string;
    vendor: AIVendor;
    models: Array<{
        id: string;
        name: string;
        description: string;
    }>;
}

/**
 * Model categories for the settings UI
 */
export const MODEL_CATEGORIES: ModelCategory[] = [
    // Google Gemini Models
    {
        name: 'Gemini 2.5 Models',
        vendor: AIVendor.GOOGLE,
        models: [
            {
                id: 'gemini-2.5-pro-preview-05-06',
                name: 'Gemini 2.5 Pro Preview',
                description: 'Most capable model with advanced reasoning and understanding'
            },
            {
                id: 'gemini-2.5-flash-preview-05-20',
                name: 'Gemini 2.5 Flash Preview',
                description: 'Fast and efficient model for general text tasks'
            },
            {
                id: 'gemini-2.5-flash-preview-tts',
                name: 'Gemini 2.5 Flash Preview TTS',
                description: 'Optimized for text-to-speech applications'
            },
            {
                id: 'gemini-2.5-pro-preview-tts',
                name: 'Gemini 2.5 Pro Preview TTS',
                description: 'Advanced model optimized for text-to-speech'
            }
        ]
    },
    {
        name: 'Gemini 2.0 Models',
        vendor: AIVendor.GOOGLE,
        models: [
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                description: 'Fast and efficient model for text generation'
            },
            {
                id: 'gemini-2.0-flash-lite',
                name: 'Gemini 2.0 Flash Lite',
                description: 'Lightweight version for faster responses'
            },
            {
                id: 'gemini-2.0-flash-preview-image-generation',
                name: 'Gemini 2.0 Flash Preview Image Generation',
                description: 'Specialized for image generation tasks'
            },
            {
                id: 'gemini-2.0-flash-live-001',
                name: 'Gemini 2.0 Flash Live',
                description: 'Optimized for real-time applications'
            }
        ]
    },
    {
        name: 'Gemini 1.5 Models',
        vendor: AIVendor.GOOGLE,
        models: [
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                description: 'Balanced model for most use cases'
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                description: 'Fast and efficient for general tasks'
            },
            {
                id: 'gemini-1.5-flash-8b',
                name: 'Gemini 1.5 Flash 8B',
                description: 'Lightweight model for faster responses'
            }
        ]
    },
    {
        name: 'Legacy Gemini Models',
        vendor: AIVendor.GOOGLE,
        models: [
            {
                id: 'gemini-pro',
                name: 'Gemini Pro (Legacy)',
                description: 'Original Gemini Pro model for backward compatibility'
            }
        ]
    },
    
    // OpenAI Models
    {
        name: 'GPT-4 Models',
        vendor: AIVendor.OPENAI,
        models: [
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                description: 'Latest model with improved capabilities and speed'
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                description: 'Smaller, faster version of GPT-4o'
            },
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Powerful model with good balance of capabilities and speed'
            },
            {
                id: 'gpt-4',
                name: 'GPT-4',
                description: 'Original GPT-4 model with strong reasoning capabilities'
            }
        ]
    },
    {
        name: 'GPT-3.5 Models',
        vendor: AIVendor.OPENAI,
        models: [
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                description: 'Fast and cost-effective model for most tasks'
            },
            {
                id: 'gpt-3.5-turbo-instruct',
                name: 'GPT-3.5 Turbo Instruct',
                description: 'Optimized for following instructions precisely'
            }
        ]
    },
    
    // Anthropic Models
    {
        name: 'Claude 3.5 Models',
        vendor: AIVendor.ANTHROPIC,
        models: [
            {
                id: 'claude-3-5-sonnet-20240620',
                name: 'Claude 3.5 Sonnet',
                description: 'Latest Claude model with improved capabilities'
            }
        ]
    },
    {
        name: 'Claude 3 Models',
        vendor: AIVendor.ANTHROPIC,
        models: [
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                description: 'Most powerful Claude model with advanced reasoning'
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                description: 'Balanced model for most use cases'
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                description: 'Fast and efficient model for quick responses'
            }
        ]
    }
];

/**
 * Get a model by its ID
 */
export function getModelById(id: string) {
    for (const category of MODEL_CATEGORIES) {
        for (const model of category.models) {
            if (model.id === id) {
                return model;
            }
        }
    }
    return null;
}

/**
 * Plugin settings interface
 */
export interface ObsidianLinkSettings {
    // General settings
    vendor: AIVendor;
    model: string;
    maxTokens: number;
    temperature: number;
    
    // Vendor-specific API keys
    geminiApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
}

/**
 * Load API key from environment variables
 * @param vendor The AI vendor to load the API key for
 * @returns The API key if found, empty string otherwise
 */
export function loadApiKeyFromEnvironment(vendor: AIVendor): string {
    try {
        // Try to load from environment variables
        const envVarName = getEnvVarNameForVendor(vendor);
        const envApiKey = process.env[envVarName];
        if (envApiKey) {
            console.log(`${vendor} API key loaded from environment variable`);
            return envApiKey;
        }
        
        // No API key found in environment
        console.log(`No ${vendor} API key found in environment variables`);
        return '';
    } catch (error) {
        console.error(`Error loading ${vendor} API key:`, error);
        new Notice(`Error loading ${vendor} API key. Please set it manually in settings.`);
        return '';
    }
}

/**
 * Get the environment variable name for a vendor
 * @param vendor The AI vendor
 * @returns The environment variable name
 */
function getEnvVarNameForVendor(vendor: AIVendor): string {
    switch (vendor) {
        case AIVendor.GOOGLE:
            return 'GEMINI_API_KEY';
        case AIVendor.OPENAI:
            return 'OPENAI_API_KEY';
        case AIVendor.ANTHROPIC:
            return 'ANTHROPIC_API_KEY';
        default:
            return '';
    }
}

/**
 * Get the vendor-specific key name for storage or settings
 * @param vendor The AI vendor
 * @returns The vendor key name
 */
export function getVendorKeyName(vendor: AIVendor): string {
    switch (vendor) {
        case AIVendor.GOOGLE:
            return 'geminiApiKey';
        case AIVendor.OPENAI:
            return 'openaiApiKey';
        case AIVendor.ANTHROPIC:
            return 'anthropicApiKey';
        default:
            return '';
    }
}

/**
 * Get the localStorage key for a vendor
 * @param vendor The AI vendor
 * @returns The localStorage key
 */
function getLocalStorageKeyForVendor(vendor: AIVendor): string {
    switch (vendor) {
        case AIVendor.GOOGLE:
            return 'gemini_api_key';
        case AIVendor.OPENAI:
            return 'openai_api_key';
        case AIVendor.ANTHROPIC:
            return 'anthropic_api_key';
        default:
            return '';
    }
}

/**
 * Validates if an API key is properly formatted
 * @param apiKey The API key to validate
 * @param vendor The AI vendor
 * @returns True if the API key appears valid, false otherwise
 */
export function isValidApiKey(apiKey: string, vendor: AIVendor): boolean {
    // Basic validation - ensure the key exists and has a reasonable length
    if (!apiKey || apiKey.trim().length < 10) {
        return false;
    }
    
    // Vendor-specific validation
    switch (vendor) {
        case AIVendor.GOOGLE:
            // Gemini API keys typically start with "AI" and are 39 characters long
            return apiKey.startsWith('AI') && apiKey.length >= 39;
        case AIVendor.OPENAI:
            // OpenAI API keys typically start with "sk-" and are 51 characters long
            return apiKey.startsWith('sk-') && apiKey.length >= 51;
        case AIVendor.ANTHROPIC:
            // Anthropic API keys typically start with "sk-ant-" and are longer
            return apiKey.startsWith('sk-ant-') && apiKey.length >= 48;
        default:
            // Generic validation for unknown vendors
            return apiKey.trim().length > 10;
    }
}

/**
 * Securely saves the API key to Obsidian's secure storage
 * @param apiKey The API key to save
 * @param vendor The AI vendor
 * @param plugin The plugin instance for accessing Obsidian's data API
 * @returns True if successful, false otherwise
 */
export function saveApiKey(apiKey: string, vendor: AIVendor, plugin: any): boolean {
    try {
        // Store the API key in the plugin's secure data storage
        // This is more secure than localStorage as it's stored in the Obsidian vault's config
        const vendorKey = getVendorKeyName(vendor);
        
        // Update the plugin settings with the new API key
        switch (vendor) {
            case AIVendor.GOOGLE:
                plugin.settings.geminiApiKey = apiKey;
                break;
            case AIVendor.OPENAI:
                plugin.settings.openaiApiKey = apiKey;
                break;
            case AIVendor.ANTHROPIC:
                plugin.settings.anthropicApiKey = apiKey;
                break;
        }
        
        // Save the updated settings
        plugin.saveSettings();
        return true;
    } catch (error) {
        console.error(`Error saving ${vendor} API key:`, error);
        return false;
    }
}

/**
 * Get the API key for a specific vendor from settings
 * @param settings The plugin settings
 * @param vendor The AI vendor
 * @returns The API key for the vendor
 */
export function getApiKeyForVendor(settings: ObsidianLinkSettings, vendor: AIVendor): string {
    switch (vendor) {
        case AIVendor.GOOGLE:
            return settings.geminiApiKey;
        case AIVendor.OPENAI:
            return settings.openaiApiKey;
        case AIVendor.ANTHROPIC:
            return settings.anthropicApiKey;
        default:
            return '';
    }
}

/**
 * Get model categories for a specific vendor
 * @param vendor The AI vendor
 * @returns Array of model categories for the vendor
 */
export function getModelCategoriesForVendor(vendor: AIVendor): ModelCategory[] {
    return MODEL_CATEGORIES.filter(category => category.vendor === vendor);
}
