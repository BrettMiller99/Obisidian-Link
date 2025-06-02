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
        this.model = this.genAI.getGenerativeModel({ model: this.settings.model });
    }

    /**
     * Generate content using the Gemini API
     * @param prompt The prompt to send to Gemini
     * @returns The generated content
     */
    async generateContent(prompt: string): Promise<string> {
        try {
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
            throw new Error(`Failed to generate content: ${error.message}`);
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
