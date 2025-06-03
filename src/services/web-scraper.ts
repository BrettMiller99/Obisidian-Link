import { ObsidianLinkSettings, getApiKeyForVendor } from '../types';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';

export class WebScraperService {
    private aiProvider: AIProvider | null = null;
    private settings: ObsidianLinkSettings;
    private initializationPromise: Promise<void>;

    constructor(settings: ObsidianLinkSettings) {
        this.settings = settings;
        
        // Initialize the provider asynchronously
        this.initializationPromise = this.initializeProvider();
    }
    
    /**
     * Initialize the AI provider asynchronously
     */
    private async initializeProvider(): Promise<void> {
        try {
            // Get the appropriate API key for the selected vendor
            const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
            
            // Create the AI provider using the factory with MCP settings
            this.aiProvider = await AIProviderFactory.createProvider({
                apiKey,
                model: this.settings.model,
                maxTokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                vendor: this.settings.vendor,
                useMCP: this.settings.useMCP,
                mcpServerUrl: this.settings.mcpServerUrl
            });
            
            // Log which provider is being used
            if (this.settings.useMCP) {
                console.log(`WebScraperService initialized with MCP provider at ${this.settings.mcpServerUrl}`);
            } else {
                console.log(`WebScraperService initialized with direct ${this.settings.vendor} provider`);
            }
        } catch (error) {
            console.error('Failed to initialize AI provider for web scraper:', error);
            throw error;
        }
    }

    /**
     * Scrapes content from a website URL and returns it as formatted Markdown
     * @param url The URL to scrape
     * @returns Formatted Markdown content
     */
    async scrapeWebsite(url: string): Promise<string> {
        try {
            // Wait for the provider to be initialized
            await this.initializationPromise;
            
            // Ensure the provider is available
            if (!this.aiProvider) {
                throw new Error('AI provider not initialized');
            }
            
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
            
            // Use AI to extract meaningful content and format as Markdown
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
