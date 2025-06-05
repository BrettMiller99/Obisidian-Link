import { App, TFile, TFolder, Vault, getAllTags, MetadataCache } from 'obsidian';
import { ObsidianLinkSettings, getApiKeyForVendor } from '../types';
import { AIProvider, AIProviderFactory } from '../utils/ai-providers';

export interface RelatedNote {
    file: TFile;
    title: string;
    path: string;
    relevance: number;  // 0-1 score of relevance
    explanation: string;
}

export interface Concept {
    name: string;
    description: string;
    confidence: number;  // 0-1 score of confidence
    relatedNotes: RelatedNote[];
}

export interface ConceptLink {
    source: string;  // Note path
    target: string;  // Note path
    relationship: string;  // Description of relationship
    strength: number;  // 0-1 score of relationship strength
}

export interface DetectedConcept {
    name: string;
    definition?: string;
    relatedConcepts?: string[];
    confidence?: number;
}

export class ConceptDetectionService {
    private aiProvider: AIProvider;
    private settings: ObsidianLinkSettings;
    private app: App;
    private vault: Vault;
    private metadataCache: MetadataCache;

    constructor(app: App, settings: ObsidianLinkSettings) {
        this.app = app;
        this.settings = settings;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        
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
     * Extracts key concepts from a note
     * @param file The file to analyze
     * @returns A list of key concepts found in the note
     */
    async extractConcepts(file: TFile): Promise<Concept[]> {
        try {
            // Read file content
            const content = await this.vault.cachedRead(file);
            
            // Get existing tags
            const fileCache = this.metadataCache.getFileCache(file);
            const tags = fileCache ? getAllTags(fileCache) || [] : [];
            
            const prompt = `
                Analyze the following note and identify the key concepts present in it.
                For each concept, provide:
                1. A descriptive name (2-4 words)
                2. A brief description (1-2 sentences)
                3. A confidence score (0-1) indicating how clearly this concept is represented
                
                Format the output as a valid JSON array of objects with these properties:
                - name: string
                - description: string
                - confidence: number (0-1)
                
                The note also has these tags: ${tags.join(', ')}
                
                NOTE CONTENT:
                ${content}
            `;
            
            const response = await this.aiProvider.generateContent(prompt);
            
            // Parse the response to extract JSON
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                             response.match(/\[\s*\{\s*"name"/);
            
            let conceptsData: any[] = [];
            
            if (jsonMatch) {
                // Extract the JSON content
                const jsonContent = jsonMatch[1] || jsonMatch[0];
                
                try {
                    // Parse the JSON
                    conceptsData = JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
                } catch (e) {
                    console.error("Failed to parse JSON from AI response:", e);
                    // Attempt to fix common JSON formatting issues
                    const cleanedJson = jsonContent
                        .replace(/```json|```/g, '')
                        .replace(/,(\s*[\]}])/g, '$1')  // Remove trailing commas
                        .trim();
                    
                    try {
                        conceptsData = JSON.parse(cleanedJson);
                    } catch (e2) {
                        console.error("Failed to parse cleaned JSON:", e2);
                        throw new Error("Unable to parse concepts from AI response");
                    }
                }
            } else {
                throw new Error("AI response did not contain properly formatted JSON");
            }
            
            // Initialize empty relatedNotes array for each concept
            const concepts: Concept[] = conceptsData.map(concept => ({
                name: concept.name,
                description: concept.definition || 'No description available',
                confidence: concept.confidence || 0.5,
                relatedNotes: [] as RelatedNote[]
            }));
            
            return concepts;
            
        } catch (error) {
            console.error('Error extracting concepts:', error);
            throw new Error(`Failed to extract concepts: ${error.message}`);
        }
    }

    /**
     * Finds related notes for a concept
     * @param concept The concept to find related notes for
     * @returns The concept with populated relatedNotes
     */
    async findRelatedNotes(concept: Concept): Promise<Concept> {
        // Clone the concept to avoid modifying the original
        const enrichedConcept: Concept = { 
            ...concept, 
            relatedNotes: [] as RelatedNote[] 
        };
        
        try {
            // Get all markdown files in the vault
            const markdownFiles = this.vault.getMarkdownFiles();
            
            // Process files in batches to avoid overwhelming the system
            const batchSize = 10;
            for (let i = 0; i < markdownFiles.length; i += batchSize) {
                const batch = markdownFiles.slice(i, i + batchSize);
                
                // Process each file in the batch
                const batchPromises = batch.map(async (file) => {
                    // Skip files that are too large (> 100KB)
                    const stat = await this.vault.adapter.stat(file.path);
                    if (stat && stat.size > 100000) {
                        return null;
                    }
                    
                    const content = await this.vault.cachedRead(file);
                    
                    // Check if the content mentions the concept (quick pre-filter)
                    if (!content.toLowerCase().includes(concept.name.toLowerCase()) && 
                        !this.containsSemanticallySimilarTerms(content, concept.name)) {
                        return null;
                    }
                    
                    // Use AI to determine relevance
                    const prompt = `
                        Determine if the following note is related to the concept "${concept.name}": ${concept.description}
                        
                        If it is related, provide:
                        1. A relevance score between 0 and 1 (where 1 is highly relevant)
                        2. A brief explanation of why it's relevant
                        
                        Format your response as a JSON object with these properties:
                        - isRelevant: boolean
                        - relevance: number (0-1, only if isRelevant is true)
                        - explanation: string (only if isRelevant is true)
                        
                        NOTE CONTENT:
                        ${content.substring(0, 5000)}  // Limit content length
                    `;
                    
                    const response = await this.aiProvider.generateContent(prompt);
                    
                    // Parse the response
                    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                                     response.match(/\{\s*"isRelevant"/);
                    
                    if (jsonMatch) {
                        const jsonContent = jsonMatch[1] || jsonMatch[0];
                        try {
                            const result = JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
                            
                            if (result.isRelevant && result.relevance > 0.5) {  // Only include if relevance is above threshold
                                return {
                                    file,
                                    title: file.basename,
                                    path: file.path,
                                    relevance: result.relevance,
                                    explanation: result.explanation
                                };
                            }
                        } catch (e) {
                            console.error("Failed to parse JSON from AI response for relevance:", e);
                        }
                    }
                    
                    return null;
                });
                
                // Wait for all files in the batch to be processed
                const batchResults = await Promise.all(batchPromises);
                
                // Add valid results to relatedNotes
                batchResults.forEach(result => {
                    if (result) {
                        enrichedConcept.relatedNotes.push(result);
                    }
                });
            }
            
            // Sort by relevance (highest first)
            enrichedConcept.relatedNotes.sort((a, b) => b.relevance - a.relevance);
            
            return enrichedConcept;
            
        } catch (error) {
            console.error('Error finding related notes:', error);
            throw new Error(`Failed to find related notes: ${error.message}`);
        }
    }

    /**
     * Generates concept links between notes
     * @param file The file to generate links for
     * @returns An array of concept links
     */
    async generateConceptLinks(file: TFile): Promise<ConceptLink[]> {
        try {
            // First extract concepts from the file
            const concepts = await this.extractConcepts(file);
            
            // Find related notes for each concept
            const conceptPromises = concepts.map(concept => this.findRelatedNotes(concept));
            const enrichedConcepts = await Promise.all(conceptPromises);
            
            // Generate links between the file and related notes
            const links: ConceptLink[] = [];
            
            enrichedConcepts.forEach(concept => {
                concept.relatedNotes.forEach(related => {
                    // Avoid linking to self
                    if (related.file.path !== file.path) {
                        links.push({
                            source: file.path,
                            target: related.file.path,
                            relationship: `Shares concept: ${concept.name}`,
                            strength: related.relevance * concept.confidence  // Combine both scores
                        });
                    }
                });
            });
            
            return links;
            
        } catch (error) {
            console.error('Error generating concept links:', error);
            throw new Error(`Failed to generate concept links: ${error.message}`);
        }
    }

    /**
     * Helper method to check if content contains terms semantically similar to a concept
     * This is a simple implementation - in practice, you might use embeddings for this
     */
    private containsSemanticallySimilarTerms(content: string, conceptName: string): boolean {
        // Split concept into words
        const conceptWords = conceptName.toLowerCase().split(/\s+/);
        
        // Check if a majority of the words appear in the content
        const threshold = Math.ceil(conceptWords.length / 2);
        let matchCount = 0;
        
        for (const word of conceptWords) {
            if (word.length > 3 && content.toLowerCase().includes(word)) {  // Only check words longer than 3 chars
                matchCount++;
            }
        }
        
        return matchCount >= threshold;
    }

    /**
     * Updates the graph with relationship labels
     * This is called from the main plugin to enhance the existing graph
     */
    enhanceGraph(graphEl: HTMLElement, links: ConceptLink[]): void {
        // This is a placeholder for actual graph enhancement
        // In practice, we would need to hook into Obsidian's graph view
        // which would require more complex integration
        
        console.log('Enhancing graph with links:', links);
        
        // Note: This method would normally be implemented by:
        // 1. Hooking into Obsidian's graph rendering
        // 2. Adding custom edge labels and properties to graph links
        // 3. Potentially adjusting the visualization to show relationship strengths
    }
}
