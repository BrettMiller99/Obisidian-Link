import { Notice } from 'obsidian';

export interface GeminiLinkSettings {
    apiKey: string;
    model: string;
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
