import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiLinkSettings } from '../types';

export class SummarizerService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private settings: GeminiLinkSettings;

    constructor(genAI: GoogleGenerativeAI, settings: GeminiLinkSettings) {
        this.genAI = genAI;
        this.settings = settings;
        this.model = this.genAI.getGenerativeModel({ model: this.settings.model });
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
            
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: this.settings.temperature,
                    maxOutputTokens: this.settings.maxTokens,
                }
            });
            
            return result.response.text();
        } catch (error) {
            console.error('Error summarizing content:', error);
            throw new Error(`Failed to summarize content: ${error.message}`);
        }
    }
}
