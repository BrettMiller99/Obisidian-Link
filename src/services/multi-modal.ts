import { App, TFile, Notice } from 'obsidian';
import { ObsidianLinkSettings, getApiKeyForVendor } from '../types';
import { AIProvider, AIProviderFactory, AIVendor } from '../utils/ai-providers';

/**
 * Supported image analysis operations
 */
export enum ImageAnalysisType {
    DESCRIBE = 'describe',
    OCR = 'ocr',
    IDENTIFY_OBJECTS = 'identify_objects',
    EXTRACT_INFORMATION = 'extract_information'
}

/**
 * Result of image analysis
 */
export interface ImageAnalysisResult {
    type: ImageAnalysisType;
    text: string;
    confidence?: number;
    objects?: Array<{
        name: string;
        confidence: number;
        boundingBox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        }
    }>;
}

/**
 * Service for handling multi-modal content: images, audio, and documents
 */
export class MultiModalService {
    private aiProvider: AIProvider;
    private settings: ObsidianLinkSettings;
    private app: App;

    constructor(app: App, settings: ObsidianLinkSettings) {
        this.app = app;
        this.settings = settings;
        
        // Get the appropriate API key for the selected vendor
        const apiKey = getApiKeyForVendor(settings, settings.vendor);
        
        // Ensure we're using a model that supports multi-modal capabilities
        let modelForMultiModal = this.settings.model;
        
        // Force specific models that support multi-modal based on vendor
        switch (settings.vendor) {
            case AIVendor.GOOGLE:
                // Force a Gemini model that supports multi-modal
                if (!modelForMultiModal.includes('gemini-1.5') && !modelForMultiModal.includes('gemini-2')) {
                    modelForMultiModal = 'gemini-1.5-pro';
                    new Notice('Switched to Gemini 1.5 Pro for multi-modal support');
                }
                break;
                
            case AIVendor.OPENAI:
                // Force a GPT model that supports multi-modal
                if (!modelForMultiModal.includes('gpt-4o')) {
                    modelForMultiModal = 'gpt-4o';
                    new Notice('Switched to GPT-4o for multi-modal support');
                }
                break;
                
            case AIVendor.ANTHROPIC:
                // Force a Claude model that supports multi-modal
                if (!modelForMultiModal.includes('claude-3')) {
                    modelForMultiModal = 'claude-3-opus-20240229';
                    new Notice('Switched to Claude 3 Opus for multi-modal support');
                }
                break;
        }
        
        // Create the AI provider using the factory with our multi-modal compatible model
        this.aiProvider = AIProviderFactory.createProvider({
            apiKey,
            model: modelForMultiModal,
            maxTokens: settings.maxTokens,
            temperature: settings.temperature,
            vendor: settings.vendor
        });
    }

    /**
     * Analyzes an image from a file
     * @param file The image file to analyze
     * @param analysisType The type of analysis to perform
     * @returns The analysis result
     */
    async analyzeImage(file: TFile, analysisType: ImageAnalysisType): Promise<ImageAnalysisResult> {
        try {
            // Validate file is an image
            if (!file.path.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
                throw new Error('File is not a supported image format');
            }
            
            // Read file as array buffer
            const arrayBuffer = await this.app.vault.readBinary(file);
            
            // Convert to base64
            const base64 = this.arrayBufferToBase64(arrayBuffer);
            
            // Create prompt based on analysis type
            let prompt = '';
            
            switch (analysisType) {
                case ImageAnalysisType.DESCRIBE:
                    prompt = `Describe this image in detail. Include information about the content, setting, and any notable elements. Format your response as markdown paragraphs.`;
                    break;
                    
                case ImageAnalysisType.OCR:
                    prompt = `Extract all visible text from this image. Preserve the layout as much as possible using markdown formatting. If there are multiple columns, process them left-to-right, top-to-bottom.`;
                    break;
                    
                case ImageAnalysisType.IDENTIFY_OBJECTS:
                    prompt = `Identify all notable objects in this image. For each object, provide:
                    1. The name of the object
                    2. A confidence score from 0-1
                    
                    Format your response as a JSON array of objects with "name" and "confidence" properties.`;
                    break;
                    
                case ImageAnalysisType.EXTRACT_INFORMATION:
                    prompt = `Extract key information from this image. If it's a diagram, explain what it represents. If it's a document, summarize the key points. If it's a photo, describe the important elements and their significance.`;
                    break;
            }
            
            // Add metadata about the image to the prompt
            prompt = `Image filename: ${file.name}\n\n${prompt}`;
            
            // Call the multi-modal content generation API with both text prompt and image data
            const responseText = await this.aiProvider.generateMultiModalContent(prompt, [
                { type: 'image', data: base64 }
            ]);
            
            // Parse the response based on analysis type
            let result: ImageAnalysisResult = {
                type: analysisType,
                text: responseText
            };
            
            // For IDENTIFY_OBJECTS, try to parse the JSON
            if (analysisType === ImageAnalysisType.IDENTIFY_OBJECTS) {
                try {
                    // Extract JSON from the response if it's in a code block
                    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                                      responseText.match(/\[\s*\{\s*"name"/);
                    
                    if (jsonMatch) {
                        const jsonContent = jsonMatch[1] || jsonMatch[0];
                        const objects = JSON.parse(jsonContent.replace(/```json|```/g, '').trim());
                        result.objects = objects;
                    }
                } catch (e) {
                    console.error('Failed to parse objects JSON:', e);
                    // Fall back to just text
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('Error analyzing image:', error);
            throw new Error(`Failed to analyze image: ${error.message}`);
        }
    }

    /**
     * Transcribes audio from a file
     * @param file The audio file to transcribe
     * @returns The transcription text
     */
    async transcribeAudio(file: TFile): Promise<string> {
        try {
            // Validate file is audio
            if (!file.path.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                throw new Error('File is not a supported audio format');
            }
            
            // Note: In a real implementation, we would use a dedicated transcription service
            // For example, OpenAI's Whisper API or Google's Speech-to-Text
            // This is a placeholder for the real implementation
            
            // Simulated transcription
            return `[This is a placeholder for audio transcription of "${file.name}". In the real implementation, this would contain the transcribed text from the audio file.]`;
            
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw new Error(`Failed to transcribe audio: ${error.message}`);
        }
    }

    /**
     * Extracts text from a PDF file
     * @param file The PDF file to process
     * @returns The extracted text
     */
    async extractTextFromPDF(file: TFile): Promise<string> {
        try {
            // Validate file is a PDF
            if (!file.path.endsWith('.pdf')) {
                throw new Error('File is not a PDF');
            }
            
            // Note: In a real implementation, we would use a PDF processing library
            // For demonstration purposes, this is a placeholder
            
            // Simulated PDF extraction
            return `[This is a placeholder for PDF text extraction of "${file.name}". In the real implementation, this would contain the extracted text from the PDF file.]`;
            
        } catch (error) {
            console.error('Error extracting text from PDF:', error);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    /**
     * Converts an ArrayBuffer to a base64 string
     * @param buffer The array buffer to convert
     * @returns The base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}
