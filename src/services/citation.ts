import { ObsidianLinkSettings, getApiKeyForVendor } from '../types';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';

/**
 * Citation styles supported by the citation generator
 */
export enum CitationStyle {
    APA = 'apa',
    MLA = 'mla', 
    CHICAGO = 'chicago',
    HARVARD = 'harvard',
    IEEE = 'ieee',
    VANCOUVER = 'vancouver',
    AMA = 'ama',
    BIBTEX = 'bibtex',
    CSL_JSON = 'csl_json'  // CSL-JSON format for bibliography managers
}

/**
 * Metadata for a citation
 */
export interface CitationMetadata {
    title?: string;
    authors?: string[];
    date?: string;
    publisher?: string;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;
    url?: string;
    accessDate?: string;
    abstract?: string;
    keywords?: string[];
    contentType?: string;
    language?: string;
}

/**
 * A formatted citation result
 */
export interface Citation {
    formattedCitation: string;
    inTextCitation: string;
    metadata: CitationMetadata;
    style: CitationStyle;
}

/**
 * Service for generating citations from URLs, DOIs, and other identifiers
 */
export class CitationService {
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
            temperature: 0.1,  // Lower temperature for more deterministic results
            vendor: settings.vendor
        });
    }
    
    /**
     * Generates a citation from a URL
     * @param url The URL to generate a citation for
     * @param style The citation style to use
     * @returns A formatted citation
     */
    async generateCitationFromUrl(url: string, style: CitationStyle = CitationStyle.APA): Promise<Citation> {
        try {
            // Fetch metadata from the URL
            const metadata = await this.fetchMetadata(url);
            
            // Generate the citation using the metadata
            return this.formatCitation(metadata, style);
        } catch (error) {
            console.error('Error generating citation from URL:', error);
            throw new Error(`Failed to generate citation: ${error.message}`);
        }
    }
    
    /**
     * Generates a citation from a DOI
     * @param doi The DOI to generate a citation for
     * @param style The citation style to use
     * @returns A formatted citation
     */
    async generateCitationFromDOI(doi: string, style: CitationStyle = CitationStyle.APA): Promise<Citation> {
        try {
            // Normalize DOI format
            doi = doi.replace(/^https?:\/\/doi.org\//i, '').trim();
            
            // Fetch metadata from the DOI
            const metadata = await this.fetchDOIMetadata(doi);
            
            // Generate the citation using the metadata
            return this.formatCitation(metadata, style);
        } catch (error) {
            console.error('Error generating citation from DOI:', error);
            throw new Error(`Failed to generate citation: ${error.message}`);
        }
    }
    
    /**
     * Generates a citation from manually entered metadata
     * @param metadata The citation metadata
     * @param style The citation style to use
     * @returns A formatted citation
     */
    async generateCitationFromMetadata(metadata: CitationMetadata, style: CitationStyle = CitationStyle.APA): Promise<Citation> {
        try {
            // Format the citation directly from the provided metadata
            return this.formatCitation(metadata, style);
        } catch (error) {
            console.error('Error generating citation from metadata:', error);
            throw new Error(`Failed to generate citation: ${error.message}`);
        }
    }
    
    /**
     * Fetches metadata from a URL
     * @param url The URL to fetch metadata from
     * @returns The extracted metadata
     */
    private async fetchMetadata(url: string): Promise<CitationMetadata> {
        try {
            // In a real implementation, we would:
            // 1. Fetch the HTML from the URL
            // 2. Parse the HTML to extract metadata from meta tags, Open Graph tags, etc.
            // 3. Possibly use a library like metascraper or custom DOM parsing
            
            // For now, we'll use the AI to extract likely metadata from the URL pattern
            const prompt = `
                Extract likely citation metadata from this URL: ${url}
                
                Respond with a valid JSON object containing these potential fields (leave blank if unknown):
                {
                  "title": "",
                  "authors": [],
                  "date": "",
                  "publisher": "",
                  "journal": "",
                  "volume": "",
                  "issue": "",
                  "pages": "",
                  "doi": "",
                  "url": "${url}",
                  "accessDate": "${new Date().toISOString().split('T')[0]}",
                  "contentType": "",
                  "language": ""
                }
                
                Make educated guesses based on the URL structure, but do not invent specific titles or content details.
            `;
            
            const response = await this.aiProvider.generateContent(prompt);
            
            // Extract JSON from the response
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                              response.match(/\{\s*"title"/);
            
            if (jsonMatch) {
                const jsonContent = jsonMatch[1] || jsonMatch[0];
                const metadata = JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
                
                // Ensure URL is included
                metadata.url = url;
                
                // Ensure access date is included
                metadata.accessDate = metadata.accessDate || new Date().toISOString().split('T')[0];
                
                return metadata;
            } else {
                throw new Error('Failed to extract metadata from URL');
            }
        } catch (error) {
            console.error('Error fetching metadata:', error);
            
            // Return basic metadata with just the URL
            return {
                url: url,
                accessDate: new Date().toISOString().split('T')[0]
            };
        }
    }
    
    /**
     * Fetches metadata from a DOI
     * @param doi The DOI to fetch metadata for
     * @returns The metadata from the DOI
     */
    private async fetchDOIMetadata(doi: string): Promise<CitationMetadata> {
        try {
            // In a real implementation, we would:
            // 1. Query the DOI API (e.g., https://api.crossref.org/works/{doi})
            // 2. Parse the response to extract metadata
            
            // For now, we'll use the AI to generate likely metadata based on the DOI
            const prompt = `
                Extract likely citation metadata from this DOI: ${doi}
                
                Respond with a valid JSON object containing these potential fields (leave blank if unknown):
                {
                  "title": "",
                  "authors": [],
                  "date": "",
                  "publisher": "",
                  "journal": "",
                  "volume": "",
                  "issue": "",
                  "pages": "",
                  "doi": "${doi}",
                  "url": "https://doi.org/${doi}",
                  "accessDate": "${new Date().toISOString().split('T')[0]}",
                  "contentType": "",
                  "language": ""
                }
                
                Make educated guesses based on the DOI format, but do not invent specific titles or content details.
            `;
            
            const response = await this.aiProvider.generateContent(prompt);
            
            // Extract JSON from the response
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                              response.match(/\{\s*"title"/);
            
            if (jsonMatch) {
                const jsonContent = jsonMatch[1] || jsonMatch[0];
                const metadata = JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
                
                // Ensure DOI and URL are included
                metadata.doi = doi;
                metadata.url = metadata.url || `https://doi.org/${doi}`;
                
                // Ensure access date is included
                metadata.accessDate = metadata.accessDate || new Date().toISOString().split('T')[0];
                
                return metadata;
            } else {
                throw new Error('Failed to extract metadata from DOI');
            }
        } catch (error) {
            console.error('Error fetching DOI metadata:', error);
            
            // Return basic metadata with just the DOI
            return {
                doi: doi,
                url: `https://doi.org/${doi}`,
                accessDate: new Date().toISOString().split('T')[0]
            };
        }
    }
    
    /**
     * Formats a citation based on metadata and the requested style
     * @param metadata The citation metadata
     * @param style The citation style to use
     * @returns A formatted citation
     */
    public async formatCitation(metadata: CitationMetadata, style: CitationStyle): Promise<Citation> {
        try {
            // Create a prompt to generate the citation
            const prompt = `
                Generate a citation in ${style.toUpperCase()} style using this metadata:
                ${JSON.stringify(metadata, null, 2)}
                
                Return a JSON object with these properties:
                {
                  "formattedCitation": "", // The full bibliography citation
                  "inTextCitation": "",    // The in-text citation format
                  "metadata": {},          // The complete normalized metadata
                  "style": "${style}"      // The citation style used
                }
                
                Follow these rules for ${style.toUpperCase()} style:
                - Use proper formatting including italics (represented with markdown *italics*)
                - Include all required elements for the citation style
                - Format dates according to the style guidelines
                - For in-text citation, provide the standard format for this style
            `;
            
            const response = await this.aiProvider.generateContent(prompt);
            
            // Extract JSON from the response
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                              response.match(/\{\s*"formattedCitation"/);
            
            if (jsonMatch) {
                const jsonContent = jsonMatch[1] || jsonMatch[0];
                return JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
            } else {
                throw new Error('Failed to generate formatted citation');
            }
        } catch (error) {
            console.error('Error formatting citation:', error);
            
            // Return a basic citation
            return {
                formattedCitation: `${metadata.title || 'Untitled'}. Retrieved from ${metadata.url || 'Unknown source'} on ${metadata.accessDate || new Date().toISOString().split('T')[0]}.`,
                inTextCitation: metadata.authors ? `(${metadata.authors[0]?.split(',')[0] || 'Author'}, ${metadata.date?.split('-')[0] || 'n.d.'})` : '(n.d.)',
                metadata: metadata,
                style: style
            };
        }
    }
    
    /**
     * Scans text for potential citations and suggests formatted citations
     * @param text The text to scan for citations
     * @param style The citation style to use
     * @returns An array of potential citations
     */
    async scanTextForCitations(text: string, style: CitationStyle = CitationStyle.APA): Promise<Citation[]> {
        try {
            // Look for URLs and DOIs in the text
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const doiRegex = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/gi;
            
            const urls = text.match(urlRegex) || [];
            const dois = text.match(doiRegex) || [];
            
            // Deduplicate
            const uniqueUrls = [...new Set(urls)];
            const uniqueDois = [...new Set(dois)];
            
            // Process DOIs first (they're more reliable)
            const doiPromises = uniqueDois.map(doi => this.generateCitationFromDOI(doi, style));
            
            // Filter URLs to exclude those that contain the DOIs
            const filteredUrls = uniqueUrls.filter(url => 
                !uniqueDois.some(doi => url.includes(doi))
            );
            
            // Process remaining URLs
            const urlPromises = filteredUrls.map(url => this.generateCitationFromUrl(url, style));
            
            // Combine results
            const citations = await Promise.all([...doiPromises, ...urlPromises]);
            
            return citations;
        } catch (error) {
            console.error('Error scanning for citations:', error);
            throw new Error(`Failed to scan for citations: ${error.message}`);
        }
    }
}
