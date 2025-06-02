import { GeminiLinkSettings, getApiKeyForVendor } from '../types.js';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';

export class WebScraperService {
    private aiProvider: AIProvider;
    private settings: GeminiLinkSettings;

    constructor(settings: GeminiLinkSettings) {
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
     * Scrapes content from a website URL and returns it as formatted Markdown
     * @param url The URL to scrape
     * @returns Formatted Markdown content
     */
    async scrapeWebsite(url: string): Promise<string> {
        try {
            // Use a CORS proxy to avoid CORS issues
            // We'll use a popular CORS proxy service
            const corsProxyUrl = 'https://corsproxy.io/?';
            const proxyUrl = corsProxyUrl + encodeURIComponent(url);
            
            // First, fetch the HTML content from the URL through the proxy
            const response = await fetch(proxyUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            }
            
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
            
            return await this.aiProvider.generateContent(prompt);
        } catch (error) {
            console.error('Error scraping website:', error);
            throw new Error(`Failed to scrape website: ${error.message}`);
        }
    }
}
