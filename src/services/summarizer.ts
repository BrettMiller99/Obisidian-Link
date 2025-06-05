import { AIProvider } from '../utils/ai-providers';
import { SummaryLevel } from '../views/summary-view';

interface AIResponse {
    text?: string;
}

export class SummarizerService {
    private aiProvider: AIProvider;

    constructor(aiProvider: AIProvider) {
        this.aiProvider = aiProvider;
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

    /**
     * Splits content into manageable chunks for summarization
     */
    private chunkContent(content: string): string[] {
        const paragraphs = content.split(/\n\s*\n/);
        const chunks: string[] = [];
        let currentChunk = '';
        const TARGET_CHUNK_SIZE = 2000; // Characters per chunk

        for (const paragraph of paragraphs) {
            if ((currentChunk + paragraph).length > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = paragraph;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Summarizes a single chunk of content
     */
    private async summarizeChunk(chunk: string, level: SummaryLevel, isPartOfLargerDoc: boolean = false): Promise<string> {
        let levelInstructions = '';
        let formatInstructions = '';
        
        switch (level) {
            case SummaryLevel.BRIEF:
                levelInstructions = `Create a very concise bullet-point summary that captures only the most essential key points. Focus on the core messages and critical information.`;
                formatInstructions = `Format as bullet points, with 3-5 key points maximum. Each point should be clear and concise.`;
                break;
                
            case SummaryLevel.STANDARD:
                levelInstructions = `Create a balanced summary that captures main points and important supporting details. Include more context than the brief summary but stay focused.`;
                formatInstructions = `Format with a very short overview paragraph (2-3 sentences) followed by 5-8 bullet points highlighting key information and supporting details.`;
                break;
                
            case SummaryLevel.DETAILED:
                levelInstructions = `Create a comprehensive summary that thoroughly analyzes the content. Include all significant points, supporting details, and their relationships.`;
                formatInstructions = `Format with:
                - An overview paragraph summarizing the main themes
                - Detailed bullet points for each major topic
                - Sub-bullets for supporting details and examples
                - Ensure all important concepts are covered`;
                break;
        }

        const contextInstruction = isPartOfLargerDoc ? 
            'This is part of a larger document, so focus on the key points from this section.' : 
            'This is a complete document, provide a cohesive summary.';

        const prompt = `
            Please provide an informative summary of the following text.
            ${levelInstructions}
            ${formatInstructions}
            ${contextInstruction}
            
            EXTREMELY IMPORTANT INSTRUCTIONS:
            - DO NOT include any title or heading
            - DO NOT repeat the document title
            - Start directly with the content
            - Use proper markdown formatting
            - Use bullet points as specified
            - Keep bullet points concise but informative
            
            Text to summarize:
            ${chunk}
        `;

        const response = await this.aiProvider.generateContent(prompt);
        let summary = '';

        if (typeof response === 'string') {
            summary = response;
        } else if (response && typeof response === 'object') {
            const aiResponse = response as AIResponse;
            if (aiResponse.text && typeof aiResponse.text === 'string') {
                summary = aiResponse.text;
            }
        }

        return this.removeTitles(summary);
    }

    /**
     * Main summarization method that handles content chunking and combines summaries
     */
    public async summarize(content: string, level: SummaryLevel = SummaryLevel.STANDARD): Promise<string> {
        try {
            const chunks = this.chunkContent(content);
            const needsChunking = chunks.length > 1;

            if (!needsChunking) {
                return this.removeTitles(await this.summarizeChunk(content, level));
            }

            // Summarize each chunk
            const chunkSummaries = await Promise.all(
                chunks.map(chunk => this.summarizeChunk(chunk, level, true))
            );

            // If we have multiple chunks, create a final summary combining them
            const combinedSummary = chunkSummaries.join('\n\n');
            const finalSummaryPrompt = `
                Below are summaries of different sections of a document. 
                Create a cohesive ${level.toLowerCase()} summary that combines these sections.
                Maintain the same level of detail and formatting as specified for the ${level.toLowerCase()} summary level.
                Eliminate any redundancy while preserving all unique and important information.

                Section summaries:
                ${combinedSummary}
            `;

            const finalSummary = await this.aiProvider.generateContent(finalSummaryPrompt);
            let processedSummary = '';
            if (typeof finalSummary === 'string') {
                processedSummary = finalSummary;
            } else if (finalSummary && typeof finalSummary === 'object') {
                const aiResponse = finalSummary as AIResponse;
                if (aiResponse.text && typeof aiResponse.text === 'string') {
                    processedSummary = aiResponse.text;
                } else {
                    throw new Error('Invalid response format: missing text property');
                }
            } else {
                throw new Error('Invalid response format from AI provider');
            }

            return this.removeTitles(processedSummary);
        } catch (error) {
            console.error('Error summarizing content:', error);
            throw new Error(`Failed to summarize content: ${error.message}`);
        }
    }
}
