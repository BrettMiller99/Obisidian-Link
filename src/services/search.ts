import { App, TFile } from 'obsidian';
import { GeminiLinkSettings, getApiKeyForVendor } from '../types.js';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';

interface SearchResult {
    title: string;
    path: string;
    excerpt: string;
    score: number;
    relevantSection?: string;
    explanation?: string; // Explanation of why this result is relevant
}

export class SearchService {
    private aiProvider: AIProvider;
    private settings: GeminiLinkSettings;
    private app: App;
    private highlightStorage: Map<string, { terms: string[], relevantSection?: string }> = new Map();

    constructor(settings: GeminiLinkSettings, app: App) {
        this.settings = settings;
        this.app = app;
        
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
     * Store highlighting information for a file path
     * @param path The file path
     * @param terms Terms to highlight
     * @param relevantSection Optional relevant section to highlight
     */
    public storeHighlightInfo(path: string, terms: string[], relevantSection?: string) {
        this.highlightStorage.set(path, { terms, relevantSection });
    }

    /**
     * Get highlighting information for a file path
     * @param path The file path
     * @returns Highlighting information or undefined if not found
     */
    public getHighlightInfo(path: string) {
        return this.highlightStorage.get(path);
    }

    /**
     * Clear all stored highlighting information
     */
    public clearHighlightInfo() {
        this.highlightStorage.clear();
    }

    /**
     * Performs an AI-enhanced semantic search across the Obsidian vault
     * @param query The search query
     * @returns Array of search results with AI-enhanced relevance
     */
    async search(query: string): Promise<SearchResult[]> {
        try {
            console.log(`Performing semantic search for: "${query}"`);
            
            // Get all markdown files in the vault
            const markdownFiles = this.app.vault.getMarkdownFiles();
            
            // Collect both keyword matches and a sample of other documents for semantic analysis
            const keywordMatches: {file: TFile, content: string, excerpt: string}[] = [];
            const otherDocuments: {file: TFile, content: string, excerpt: string}[] = [];
            
            // Process each file to collect content
            for (const file of markdownFiles) {
                const content = await this.app.vault.cachedRead(file);
                
                // Check for keyword matches
                const hasKeywordMatch = this.hasKeywordMatch(content, file.basename, query);
                const excerpt = this.getExcerpt(content, query, hasKeywordMatch);
                
                if (hasKeywordMatch) {
                    keywordMatches.push({ file, content, excerpt });
                } else {
                    otherDocuments.push({ file, content, excerpt });
                }
            }
            
            // Always include exact keyword matches first
            const samplesToAnalyze = [...keywordMatches];
            
            // For semantic search, we need to be more selective about which documents to analyze
            // Instead of random sampling, let's use a heuristic approach to find potentially relevant documents
            if (keywordMatches.length < 50) { // Only add more if we don't already have many matches
                // Extract important terms from the query
                const queryTerms = this.extractImportantTerms(query);
                
                // Score other documents based on potential relevance to query terms
                const scoredDocuments = otherDocuments.map(doc => {
                    const relevanceScore = this.calculateInitialRelevance(doc.content, doc.file.basename, queryTerms);
                    return { ...doc, relevanceScore };
                });
                
                // Sort by initial relevance score and take the top candidates
                const sortedCandidates = scoredDocuments
                    .sort((a, b) => b.relevanceScore - a.relevanceScore)
                    .slice(0, 50); // Take top 50 candidates for further analysis
                
                samplesToAnalyze.push(...sortedCandidates);
            }
            
            // Convert to search results format
            const candidateResults = samplesToAnalyze.map(item => ({
                title: item.file.basename,
                path: item.file.path,
                excerpt: item.excerpt,
                score: 0 // Will be updated with AI scoring
            }));
            
            // If we have no documents to analyze, return empty results
            if (candidateResults.length === 0) {
                return [];
            }
            
            console.log(`Analyzing ${candidateResults.length} documents for semantic relevance`);
            
            // Use Gemini to analyze and rank results by semantic relevance
            return await this.enhanceSearchResults(candidateResults, query);
        } catch (error) {
            console.error('Error performing semantic search:', error);
            throw new Error(`Failed to perform semantic search: ${error.message}`);
        }
    }
    
    /**
     * Checks if content has a keyword match with the query
     */
    private hasKeywordMatch(content: string, title: string, query: string): boolean {
        const lowerContent = content.toLowerCase();
        const lowerTitle = title.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/);
        
        // Check for exact phrase match
        if (lowerContent.includes(query.toLowerCase()) || lowerTitle.includes(query.toLowerCase())) {
            return true;
        }
        
        // Check for individual word matches (if query has multiple words)
        if (queryWords.length > 1) {
            // Consider it a match if most of the query words are found
            const matchThreshold = Math.ceil(queryWords.length * 0.7);
            let matchCount = 0;
            
            for (const word of queryWords) {
                // Skip very short words and common stop words
                if (word.length <= 2 || ['the', 'and', 'for', 'is', 'in', 'to', 'of', 'a'].includes(word)) {
                    continue;
                }
                
                if (lowerContent.includes(word) || lowerTitle.includes(word)) {
                    matchCount++;
                }
            }
            
            return matchCount >= matchThreshold;
        }
        
        return false;
    }
    
    /**
     * Extracts important terms from a query for semantic matching
     * Removes stop words and keeps meaningful terms
     */
    private extractImportantTerms(query: string): string[] {
        // Common stop words to filter out
        const stopWords = new Set([
            'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
            'be', 'been', 'being', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
            'about', 'against', 'between', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'from', 'up', 'down', 'of', 'off', 'over',
            'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
            'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
            'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
            'now', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those'
        ]);
        
        // Split query into words, convert to lowercase, and filter out stop words and short words
        return query.toLowerCase()
            .split(/\s+/)
            .filter(word => {
                // Remove punctuation
                const cleanWord = word.replace(/[.,?!;:'"`(){}\[\]\-_]/g, '');
                // Keep words that are not stop words and are at least 3 characters long
                return cleanWord.length > 2 && !stopWords.has(cleanWord);
            });
    }
    
    /**
     * Calculates an initial relevance score for a document based on important query terms
     * This is used as a pre-filter before sending to the AI for deeper semantic analysis
     */
    private calculateInitialRelevance(content: string, title: string, queryTerms: string[]): number {
        if (queryTerms.length === 0) return 0;
        
        const lowerContent = content.toLowerCase();
        const lowerTitle = title.toLowerCase();
        let score = 0;
        
        // Check for term presence in title (higher weight)
        for (const term of queryTerms) {
            if (lowerTitle.includes(term)) {
                score += 3; // Higher weight for title matches
            }
        }
        
        // Check for term presence in content
        for (const term of queryTerms) {
            // Count occurrences
            const regex = new RegExp(term, 'gi');
            const matches = lowerContent.match(regex);
            if (matches) {
                // Add score based on frequency, with diminishing returns
                score += Math.min(matches.length, 5) * 0.5;
            }
        }
        
        // Check for proximity of terms in content (if multiple terms)
        if (queryTerms.length > 1) {
            // Simple proximity check: are terms found within a reasonable distance of each other?
            let foundProximity = false;
            const windowSize = 100; // Character window to check for term co-occurrence
            
            // Slide a window through the content
            for (let i = 0; i < lowerContent.length - windowSize; i += 50) { // Step by 50 chars for efficiency
                const window = lowerContent.substring(i, i + windowSize);
                let termsInWindow = 0;
                
                for (const term of queryTerms) {
                    if (window.includes(term)) {
                        termsInWindow++;
                    }
                }
                
                // If most terms are found in the same window, that's a good sign of relevance
                if (termsInWindow >= Math.ceil(queryTerms.length * 0.7)) {
                    foundProximity = true;
                    break;
                }
            }
            
            if (foundProximity) {
                score += 5; // Significant boost for term proximity
            }
        }
        
        return score;
    }
    
    /**
     * Gets a relevant excerpt from content based on query
     * @param content The document content
     * @param query The search query
     * @param hasKeywordMatch Whether the document has a keyword match with the query
     * @returns A relevant excerpt from the content with highlight markers
     */
    private getExcerpt(content: string, query: string, hasKeywordMatch: boolean = false): string {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const queryTerms = this.extractImportantTerms(query);
        let excerptText = '';
        let foundRelevantSection = false;
        
        // If we have a keyword match, try to find the most relevant part
        if (hasKeywordMatch) {
            const index = lowerContent.indexOf(lowerQuery);
            
            if (index !== -1) {
                // Get surrounding context (150 chars before and after)
                const start = Math.max(0, index - 150);
                const end = Math.min(content.length, index + query.length + 150);
                excerptText = content.substring(start, end);
                foundRelevantSection = true;
            } else {
                // If exact phrase not found but we have a keyword match,
                // try to find one of the keywords
                for (const word of queryTerms) {
                    if (word.length > 3) { // Only look for substantial words
                        const wordIndex = lowerContent.indexOf(word);
                        if (wordIndex !== -1) {
                            const start = Math.max(0, wordIndex - 150);
                            const end = Math.min(content.length, wordIndex + word.length + 150);
                            excerptText = content.substring(start, end);
                            foundRelevantSection = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // If we haven't found a relevant section yet, look for term proximity
        if (!foundRelevantSection && queryTerms.length > 0) {
            // Find sections where multiple query terms appear close together
            const windowSize = 300; // Character window to check for term co-occurrence
            let bestWindowScore = 0;
            let bestWindowText = '';
            
            // Slide a window through the content
            for (let i = 0; i < lowerContent.length - windowSize; i += 100) { // Step by 100 chars for efficiency
                const window = content.substring(i, i + windowSize);
                const lowerWindow = window.toLowerCase();
                let windowScore = 0;
                
                for (const term of queryTerms) {
                    if (lowerWindow.includes(term)) {
                        windowScore += 1;
                    }
                }
                
                if (windowScore > bestWindowScore) {
                    bestWindowScore = windowScore;
                    bestWindowText = window;
                }
            }
            
            if (bestWindowScore > 0) {
                excerptText = bestWindowText;
                foundRelevantSection = true;
            }
        }
        
        // If still no relevant section found, use the beginning of the document
        if (!foundRelevantSection) {
            // First, try to get the first paragraph which is often a summary
            const firstParagraphMatch = content.match(/^([\s\S]+?)\n\s*\n/);
            if (firstParagraphMatch && firstParagraphMatch[1].length > 50) {
                // Limit to 300 chars if the paragraph is long
                excerptText = firstParagraphMatch[1].substring(0, 300);
            } else {
                // Otherwise return the beginning of the document
                excerptText = content.substring(0, 300);
            }
        }
        
        // Add highlight markers around matching terms
        // We use special markers that we'll replace with HTML in the UI
        if (queryTerms.length > 0) {
            for (const term of queryTerms) {
                if (term.length > 2) {
                    const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
                    excerptText = excerptText.replace(regex, '[[highlight]]$1[[/highlight]]');
                }
            }
        }
        
        return excerptText + '...';
    }
    
    /**
     * Escapes special characters in a string for use in a regular expression
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Uses Gemini AI to perform semantic search and rank results by relevance
     * @param results Array of candidate search results to analyze
     * @param query The search query
     * @returns Array of search results ranked by semantic relevance
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
                You are a semantic search engine for Obsidian notes. Your task is to find documents that are semantically related to the user's query, even if they don't contain the exact keywords.
                
                USER QUERY: "${query}"
                
                CANDIDATE DOCUMENTS:
                ${resultsText}
                
                INSTRUCTIONS:
                1. Analyze each document for DIRECT semantic relevance to the query. The document must contain information that would help answer or address the query.
                2. Be STRICT about relevance - only consider a document relevant if it contains information that is genuinely useful for the query topic.
                3. For example, if the query asks about "left shift" and a document discusses "shifting left" or "bit shifting operations", it should be considered highly relevant.
                4. However, if a document only mentions the query terms in passing or in an unrelated context, it should receive a low score or be excluded.
                5. For each relevant document, identify the SPECIFIC SECTION or SENTENCE that is most relevant to the query. Quote this exact text in your response.
                6. For each document, provide a DETAILED explanation (2-3 sentences) of why this document is relevant to the query and what specific information it contains that addresses the query.
                7. Use the following scoring guidelines:
                   - 0.9-1.0: Directly addresses the query topic in detail
                   - 0.7-0.8: Contains significant relevant information about the query topic
                   - 0.6-0.7: Has some relevant information but isn't comprehensive
                   - Below 0.6: Only tangentially related or mentions terms without context
                
                Return your analysis as a JSON array with this structure:
                [
                    {
                        "index": 1, // The original document number (1-based)
                        "score": 0.95, // Semantic relevance score between 0 and 1
                        "reason": "Brief explanation of why this document is semantically relevant to the query",
                        "explanation": "Detailed explanation (2-3 sentences) of the document's relevance and what specific information it contains that addresses the query",
                        "relevantSection": "The exact text from the document that is most relevant to the query" // Quote the most relevant section
                    },
                    // Additional documents...
                ]
                
                Only include documents with scores of 0.6 or higher. Sort them by relevance score (highest first).
            `;
            
            const responseText = await this.aiProvider.generateContent(prompt);
            
            // Extract JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error('Could not extract JSON from Gemini response');
                return results;
            }
            
            const rankings = JSON.parse(jsonMatch[0]);
            
            // Update scores and sort results
            const enhancedResults = rankings.map((ranking: { index: number; score: number; reason: string; explanation?: string; relevantSection?: string }) => {
                const originalResult = results[ranking.index - 1];
                
                // If AI provided a relevant section, highlight it and use it in the excerpt
                let enhancedExcerpt = originalResult.excerpt;
                if (ranking.relevantSection) {
                    // Try to find the relevant section in the original excerpt
                    const cleanSection = ranking.relevantSection.trim();
                    if (cleanSection.length > 10) { // Only use substantial sections
                        // Escape special regex characters
                        const escapedSection = this.escapeRegExp(cleanSection);
                        // Try to find and highlight the section in the excerpt
                        const sectionRegex = new RegExp(`(${escapedSection})`, 'i');
                        
                        if (enhancedExcerpt.match(sectionRegex)) {
                            // If the section is already in the excerpt, highlight it
                            enhancedExcerpt = enhancedExcerpt.replace(
                                sectionRegex, 
                                '[[highlight]]$1[[/highlight]]'
                            );
                        } else {
                            // If not in the excerpt, add it as a highlighted section
                            enhancedExcerpt = enhancedExcerpt + 
                                '\n\nRelevant section: [[highlight]]' + cleanSection + '[[/highlight]]';
                        }
                    }
                }
                
                // Store highlighting information for this file
                const queryTerms = this.extractImportantTerms(query);
                this.storeHighlightInfo(originalResult.path, queryTerms, ranking.relevantSection);
                
                // Format the explanation with the detailed information
                const detailedExplanation = ranking.explanation || ranking.reason;
                
                return {
                    ...originalResult,
                    score: ranking.score,
                    relevantSection: ranking.relevantSection,
                    explanation: detailedExplanation,
                    excerpt: enhancedExcerpt + `\n\nRelevance (${Math.round(ranking.score * 100)}%): ${detailedExplanation}`
                };
            });
            
            // Filter out results with low relevance scores (below 0.6)
            // This ensures we only show truly relevant results
            const minimumRelevanceThreshold = 0.6;
            const filteredResults = enhancedResults.filter(
                (result: SearchResult) => result.score >= minimumRelevanceThreshold
            );
            
            console.log(`Filtered from ${enhancedResults.length} to ${filteredResults.length} results using relevance threshold`);
            
            // Sort by score (highest first)
            return filteredResults.sort((a: SearchResult, b: SearchResult) => b.score - a.score);
        } catch (error) {
            console.error('Error enhancing search results:', error);
            return results; // Return original results if enhancement fails
        }
    }
}
