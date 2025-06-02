import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiLinkSettings } from '../types.js';

/**
 * Utility class for working with the Gemini API
 */
export class GeminiApi {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private settings: GeminiLinkSettings;

    constructor(apiKey: string, settings: GeminiLinkSettings) {
        this.settings = settings;
        this.genAI = new GoogleGenerativeAI(apiKey);
        
        // Format the model name correctly for the API
        // The settings.model is the base model name (e.g., 'gemini-1.5-pro')
        // But the API expects a full path (e.g., 'models/gemini-1.5-pro')
        const apiModelPath = `models/${this.settings.model}`;
        
        console.log(`Initializing Gemini model: ${this.settings.model} (API path: ${apiModelPath})`);
        this.model = this.genAI.getGenerativeModel({ model: apiModelPath });
    }

    /**
     * Generate content using the Gemini API
     * @param prompt The prompt to send to Gemini
     * @returns The generated content
     */
    async generateContent(prompt: string): Promise<string> {
        try {
            console.log(`Generating content with model: ${this.settings.model}, temperature: ${this.settings.temperature}`);
            
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: this.settings.temperature,
                    maxOutputTokens: this.settings.maxTokens,
                }
            });
            
            return result.response.text();
        } catch (error) {
            console.error('Error generating content with Gemini:', error);
            
            // Provide more specific error messages for common issues
            if (error.message && error.message.includes('404')) {
                throw new Error(`Model not found or not supported: ${this.settings.model}. Please check your model name in settings.`);
            } else if (error.message && error.message.includes('401') || error.message.includes('403')) {
                throw new Error('Authentication failed. Please check your API key in settings.');
            } else if (error.message && error.message.includes('429')) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Failed to generate content: ${error.message}`);
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
            console.error('API key validation failed:', error);
            return false;
        }
    }
}
