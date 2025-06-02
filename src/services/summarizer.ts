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
                
                EXTREMELY IMPORTANT INSTRUCTIONS:
                - DO NOT include any title, heading, or H1/H2 tags in your summary
                - DO NOT start with the title of the document
                - DO NOT repeat the title of the document
                - Start directly with the summary content in paragraph form
                - The title will be added separately, so do not include one
                
                Text to summarize:
                ${content}
            `;
            
            // Get the raw summary from Gemini
            let summary = await this.geminiApi.generateContent(prompt);
            
            // Post-process to remove any titles that might have been included despite instructions
            summary = this.removeTitles(summary);
            
            return summary;
        } catch (error) {
            console.error('Error summarizing content:', error);
            throw new Error(`Failed to summarize content: ${error.message}`);
        }
    }
    
    /**
     * Removes any titles that might be at the beginning of the summary
     * @param text The summary text to process
     * @returns The summary without any titles
     */
    private removeTitles(text: string): string {
        // Trim the text to remove leading/trailing whitespace
        let processed = text.trim();
        
        // Remove Markdown headings (# Title, ## Title, etc.)
        processed = processed.replace(/^#+\s+.*$/m, '').trim();
        
        // Remove HTML headings (<h1>Title</h1>, etc.)
        processed = processed.replace(/^<h[1-6]>.*<\/h[1-6]>/m, '').trim();
        
        // Remove lines that look like titles (all caps, short lines at the beginning)
        const lines = processed.split('\n');
        let startIndex = 0;
        
        // Skip lines that look like titles (short, possibly all caps, not starting with common paragraph text)
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (line === '') {
                startIndex = i + 1;
                continue;
            }
            
            // If line is short and looks like a title
            if (line.length < 80 && 
                (line === line.toUpperCase() || 
                 line.endsWith(':') || 
                 !line.includes(' ') || 
                 /^[\w\s]+$/.test(line))) {
                startIndex = i + 1;
                continue;
            }
            
            // If we get here, we've found content that doesn't look like a title
            break;
        }
        
        // Join the remaining lines
        return lines.slice(startIndex).join('\n').trim();
    }
}
