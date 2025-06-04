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
}

/**
 * Base interface for all AI providers
 */
/**
 * Represents a part of multi-modal content
 */
export interface ContentPart {
    type: 'text' | 'image';
    data: string; // text content or base64-encoded image data
}

export interface AIProvider {
    /**
     * Generate content using the AI provider
     * @param prompt The prompt to send to the AI
     * @returns The generated content
     */
    generateContent(prompt: string): Promise<string>;
    
    /**
     * Generate content using multi-modal inputs (text and images)
     * @param prompt The text prompt to send to the AI
     * @param parts Additional content parts (e.g., images as base64)
     * @returns The generated content
     */
    generateMultiModalContent(prompt: string, parts: ContentPart[]): Promise<string>;
    
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
    
    /**
     * Get the display name of the provider
     * @returns The provider's display name
     */
    getProviderName(): string;
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
