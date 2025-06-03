import { Notice } from 'obsidian';

/**
 * Model availability status types
 */
export enum ModelAvailabilityStatus {
    GENERALLY_AVAILABLE = 'generally_available',
    LIMITED_PREVIEW = 'limited_preview',
    EXPERIMENTAL = 'experimental',
    DEPRECATED = 'deprecated',
    UNKNOWN = 'unknown'
}

/**
 * Interface for model availability information
 */
export interface ModelAvailabilityInfo {
    status: ModelAvailabilityStatus;
    reason?: string;
    fallbackModel?: string;
}

/**
 * Interface for model information
 */
export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    vendor: AIVendor;
}

/**
 * Supported AI vendors
 */
export enum AIVendor {
    GOOGLE = 'google',
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai'
}

/**
 * Common settings for all AI providers
 */
export interface AIProviderSettings {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    vendor: AIVendor;
    // MCP-related settings
    useMCP?: boolean;
    mcpServerUrl?: string;
}

/**
 * Base interface for all AI providers
 */
export interface AIProvider {
    /**
     * Generate content using the AI provider
     * @param prompt The prompt to send to the AI
     * @returns The generated content
     */
    generateContent(prompt: string): Promise<string>;
    
    /**
     * Check if the API key is valid
     * @returns True if the API key is valid, false otherwise
     */
    isApiKeyValid(): Promise<boolean>;
    
    /**
     * Get the vendor of this provider
     * @returns The AI vendor
     */
    getVendor(): AIVendor;
}

/**
 * Helper function to display error notices
 * @param message Error message to display
 * @param duration Duration to show the notice in milliseconds
 */
export function showErrorNotice(message: string, duration: number = 10000): void {
    console.error(message);
    new Notice(message, duration);
}
