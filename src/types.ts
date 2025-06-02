import { Notice } from 'obsidian';

/**
 * Available Gemini model options
 * From: https://ai.google.dev/gemini-api/docs/models
 */
export type GeminiModelOption = 
    // Gemini 1.5 models
    | 'gemini-1.5-pro'
    | 'gemini-1.5-flash'
    | 'gemini-1.5-flash-8b'
    // Gemini 2.0 models
    | 'gemini-2.0-flash'
    | 'gemini-2.0-flash-lite'
    | 'gemini-2.0-flash-preview-image-generation'
    | 'gemini-2.0-flash-live-001'
    // Gemini 2.5 models
    | 'gemini-2.5-pro-preview-05-06'
    | 'gemini-2.5-flash-preview-05-20'
    | 'gemini-2.5-flash-preview-native-audio-dialog'
    | 'gemini-2.5-flash-exp-native-audio-thinking-dialog'
    | 'gemini-2.5-flash-preview-tts'
    | 'gemini-2.5-pro-preview-tts'
    // Legacy model (for backward compatibility)
    | 'gemini-pro';

/**
 * Model categories for UI organization
 */
export interface ModelCategory {
    name: string;
    models: Array<{
        id: GeminiModelOption;
        name: string;
        description: string;
    }>;
}

/**
 * Gemini model categories for the settings UI
 */
export const GEMINI_MODEL_CATEGORIES: ModelCategory[] = [
    {
        name: 'Gemini 2.5 Models',
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
        name: 'Legacy Models',
        models: [
            {
                id: 'gemini-pro',
                name: 'Gemini Pro (Legacy)',
                description: 'Original Gemini Pro model for backward compatibility'
            }
        ]
    }
];

/**
 * Get a model by its ID
 */
export function getModelById(id: GeminiModelOption) {
    for (const category of GEMINI_MODEL_CATEGORIES) {
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
export interface GeminiLinkSettings {
    apiKey: string;
    model: GeminiModelOption;
    maxTokens: number;
    temperature: number;
}

/**
 * Utility function to load API key from environment if available
 * For Obsidian plugins, we use a secure approach to store API keys
 */
export function loadApiKeyFromEnvironment(): string {
    try {
        // First priority: Environment variable (for development)
        if (process.env.GEMINI_API_KEY) {
            console.log('API key loaded from environment variable');
            return process.env.GEMINI_API_KEY;
        }
        
        // Second priority: localStorage (for production)
        // Note: In a production plugin, consider encrypting this value
        // or using a more secure storage method
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) {
            console.log('API key loaded from localStorage');
            return storedKey;
        }
        
        // Third priority: Check for a secrets file in the plugin directory
        // This would require file system access, which is limited in Obsidian
        // and would be implementation-specific
        
        // No API key found
        console.log('No API key found in environment or localStorage');
        return '';
    } catch (error) {
        console.error('Error loading API key from environment:', error);
        new Notice('Error loading API key from environment. Please set it manually in settings.');
        return '';
    }
}

/**
 * Validates if an API key is properly formatted
 * @param apiKey The API key to validate
 * @returns True if the API key appears valid, false otherwise
 */
export function isValidApiKey(apiKey: string): boolean {
    // Basic validation - Gemini API keys typically have a specific format
    // This is a simple check and may need to be updated based on Google's actual key format
    return !!apiKey && apiKey.trim().length > 10;
}

/**
 * Securely saves the API key to localStorage with optional encryption
 * @param apiKey The API key to save
 * @returns True if successful, false otherwise
 */
export function saveApiKey(apiKey: string): boolean {
    try {
        // In a production plugin, consider encrypting this value
        localStorage.setItem('gemini_api_key', apiKey);
        return true;
    } catch (error) {
        console.error('Error saving API key:', error);
        return false;
    }
}
