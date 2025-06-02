import { App, TFile } from 'obsidian';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiLinkSettings } from '../types';

interface SearchResult {
    title: string;
    path: string;
    excerpt: string;
    score: number;
}

export class SearchService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private settings: GeminiLinkSettings;
    private app: App;

    constructor(genAI: GoogleGenerativeAI, settings: GeminiLinkSettings, app: App) {
        this.genAI = genAI;
        this.settings = settings;
        this.app = app;
        this.model = this.genAI.getGenerativeModel({ model: this.settings.model });
    }

    /**
     * Performs an AI-enhanced search across the Obsidian vault
     * @param query The search query
     * @returns Array of search results with AI-enhanced relevance
     */
    async search(query: string): Promise<SearchResult[]> {
        try {
            // First, perform a basic search using Obsidian's search functionality
            const searchResults: SearchResult[] = [];
            
            // Get all markdown files in the vault
            const markdownFiles = this.app.vault.getMarkdownFiles();
            
            // Process each file to check relevance to the query
            for (const file of markdownFiles) {
                const content = await this.app.vault.cachedRead(file);
                
                // Simple keyword matching as initial filter
                if (content.toLowerCase().includes(query.toLowerCase()) || 
                    file.basename.toLowerCase().includes(query.toLowerCase())) {
                    
                    // Get a snippet of content around the query
                    const excerpt = this.getExcerpt(content, query);
                    
                    searchResults.push({
                        title: file.basename,
                        path: file.path,
                        excerpt: excerpt,
                        score: 0 // Will be updated with AI scoring
                    });
                }
            }
            
            // If we have too many initial results, limit to most relevant before AI processing
            const initialResults = searchResults.slice(0, 20);
            
            if (initialResults.length === 0) {
                return [];
            }
            
            // Use Gemini to enhance search results and rank by relevance
            return await this.enhanceSearchResults(initialResults, query);
        } catch (error) {
            console.error('Error performing search:', error);
            throw new Error(`Failed to perform search: ${error.message}`);
        }
    }
    
    /**
     * Gets a relevant excerpt from content based on query
     */
    private getExcerpt(content: string, query: string): string {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        const index = lowerContent.indexOf(lowerQuery);
        
        if (index !== -1) {
            // Get surrounding context (100 chars before and after)
            const start = Math.max(0, index - 100);
            const end = Math.min(content.length, index + query.length + 100);
            return content.substring(start, end) + '...';
        } else {
            // If exact query not found, return beginning of content
            return content.substring(0, 200) + '...';
        }
    }
    
    /**
     * Uses Gemini AI to enhance and rank search results
     */
    private async enhanceSearchResults(results: SearchResult[], query: string): Promise<SearchResult[]> {
        try {
            // Prepare the prompt for Gemini
            const resultsText = results.map((result, index) => {
                return `Document ${index + 1}:
Title: ${result.title}
Excerpt: ${result.excerpt}`;
            }).join('\n\n');
            
            const prompt = `
                I have the following search results for the query: "${query}"
                
                ${resultsText}
                
                Please analyze these search results and rank them by relevance to the query.
                Return a JSON array of objects with the following structure:
                [
                    {
                        "index": 1, // The original index (1-based)
                        "score": 0.95, // Relevance score between 0 and 1
                        "reason": "Brief explanation of why this result is relevant"
                    }
                ]
                
                Only include results that are actually relevant to the query.
            `;
            
            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Extract JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error('Could not extract JSON from Gemini response');
                return results;
            }
            
            const rankings = JSON.parse(jsonMatch[0]);
            
            // Update scores and sort results
            const enhancedResults = rankings.map(ranking => {
                const originalResult = results[ranking.index - 1];
                return {
                    ...originalResult,
                    score: ranking.score,
                    excerpt: originalResult.excerpt + `\n\nRelevance: ${ranking.reason}`
                };
            });
            
            // Sort by score (highest first)
            return enhancedResults.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Error enhancing search results:', error);
            return results; // Return original results if enhancement fails
        }
    }
}
