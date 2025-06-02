import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiLinkSettings } from '../types';

export class WebScraperService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private settings: GeminiLinkSettings;

    constructor(genAI: GoogleGenerativeAI, settings: GeminiLinkSettings) {
        this.genAI = genAI;
        this.settings = settings;
        this.model = this.genAI.getGenerativeModel({ model: this.settings.model });
    }

    /**
     * Scrapes content from a website URL and returns it as formatted Markdown
     * @param url The URL to scrape
     * @returns Formatted Markdown content
     */
    async scrapeWebsite(url: string): Promise<string> {
        try {
            // First, fetch the HTML content from the URL
            const response = await fetch(url);
            const html = await response.text();
            
            // Use Gemini to extract meaningful content and format as Markdown
            const prompt = `
                I have the HTML content from the website ${url}. 
                Please extract the most meaningful and important content from this HTML and format it as Markdown.
                Focus on the main article content, headings, lists, and any important information.
                Ignore navigation menus, footers, ads, and other non-essential elements.
                Preserve the structure of the content with proper Markdown formatting.
                Include images by referencing their URLs.
                
                HTML content:
                ${html.substring(0, 100000)} // Limit to avoid token limits
            `;
            
            const result = await this.model.generateContent(prompt);
            const response_text = result.response.text();
            
            return response_text;
        } catch (error) {
            console.error('Error scraping website:', error);
            throw new Error(`Failed to scrape website: ${error.message}`);
        }
    }
}
