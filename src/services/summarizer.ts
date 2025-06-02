import { GeminiApi } from '../utils/gemini-api';
import { GeminiLinkSettings } from '../types.js';

export class SummarizerService {
    private geminiApi: GeminiApi;
    private settings: GeminiLinkSettings;

    constructor(apiKey: string, settings: GeminiLinkSettings) {
        this.settings = settings;
        this.geminiApi = new GeminiApi(apiKey, settings);
    }

    /**
     * Summarizes the provided text content
     * @param content The text content to summarize
     * @returns A concise summary of the content
     */
    async summarize(content: string): Promise<string> {
        try {
            const prompt = `
                Please provide a concise and informative summary of the following text.
                Maintain the key points, important details, and overall structure.
                Format the summary in Markdown.
                
                Text to summarize:
                ${content}
            `;
            
            return await this.geminiApi.generateContent(prompt);
        } catch (error) {
            console.error('Error summarizing content:', error);
            throw new Error(`Failed to summarize content: ${error.message}`);
        }
    }
}
