import { ObsidianLinkSettings, getApiKeyForVendor } from '../types';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';
import { SummaryLevel } from '../views/summary-view';

export class SummarizerService {
    private aiProvider: AIProvider;
    private settings: ObsidianLinkSettings;

    constructor(settings: ObsidianLinkSettings) {
        this.settings = settings;
        
        // Get the appropriate API key for the selected vendor
        const apiKey = getApiKeyForVendor(settings, settings.vendor);
        
        // Create the AI provider using the factory
        this.aiProvider = AIProviderFactory.createProvider({
            apiKey,
            model: settings.model,
            maxTokens: settings.maxTokens,
            temperature: settings.temperature,
            vendor: settings.vendor
        });
    }

    /**
     * Summarizes the provided text content with the specified level of detail
     * @param content The text content to summarize
     * @param level The level of detail for the summary (brief, standard, detailed)
     * @returns A summary of the content with the requested level of detail
     */
    async summarize(content: string, level: SummaryLevel = SummaryLevel.STANDARD): Promise<string> {
        try {
            // Adjust instructions based on the summary level
            let levelInstructions = '';
            let maxLength = '';
            
            switch (level) {
                case SummaryLevel.BRIEF:
                    levelInstructions = 'Create a very concise summary that captures only the most essential points. Focus on the core message and omit details.';
                    maxLength = 'Keep the summary very short (about 2-3 paragraphs maximum).';
                    break;
                    
                case SummaryLevel.DETAILED:
                    levelInstructions = 'Create a comprehensive summary that includes main points as well as important supporting details, examples, and nuances.';
                    maxLength = 'The summary can be longer to accommodate more details (about 5-7 paragraphs).';
                    break;
                    
                case SummaryLevel.STANDARD:
                default:
                    levelInstructions = 'Create a balanced summary that includes the main points and some key supporting details.';
                    maxLength = 'Keep the summary to a moderate length (about 3-5 paragraphs).';
                    break;
            }
            
            const prompt = `
                Please provide an informative summary of the following text.
                ${levelInstructions}
                ${maxLength}
                Maintain the overall structure and flow of the original content.
                Format the summary in Markdown with appropriate paragraph breaks.
                
                EXTREMELY IMPORTANT INSTRUCTIONS:
                - DO NOT include any title, heading, or H1/H2 tags in your summary
                - DO NOT start with the title of the document
                - DO NOT repeat the title of the document
                - Start directly with the summary content in paragraph form
                - The title will be added separately, so do not include one
                
                Text to summarize:
                ${content}
            `;
            
            // Get the raw summary from the AI provider
            const response = await this.aiProvider.generateContent(prompt);
            
            // Extract the text from the response
            let summary: string;
            if (typeof response === 'string') {
                summary = response;
            } else if (response && typeof response === 'object' && 'text' in response) {
                summary = response.text as string;
            } else {
                throw new Error('Invalid response format from AI provider');
            }
            
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
