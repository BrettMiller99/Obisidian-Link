import { AIProvider, AIProviderSettings, AIVendor, ModelAvailabilityStatus, showErrorNotice } from './base-provider';

/**
 * Interface for MCP model information
 */
export interface MCPModel {
    id: string;
    name: string;
    vendor: string;
    description?: string;
    status: string;
    capabilities?: string[];
}

/**
 * MCP Provider implementation
 * This provider uses MCP servers to handle AI requests, allowing for better security
 * by keeping API keys server-side and providing a unified interface for multiple AI models
 */
export class MCPProvider implements AIProvider {
    private apiKey: string;
    private settings: AIProviderSettings;
    private serverUrl: string;

    /**
     * Create a new MCP provider
     * @param apiKey The API key for authentication with the MCP server
     * @param settings The provider settings
     * @param serverUrl Optional server URL, defaults to the standard MCP endpoint
     */
    constructor(apiKey: string, settings: AIProviderSettings, serverUrl?: string) {
        this.apiKey = apiKey;
        this.settings = settings;
        this.serverUrl = serverUrl || 'https://api.mcp.windsurf.ai/v1';
    }

    /**
     * Generate content using the MCP server
     * @param prompt The prompt to send to the AI
     * @returns The generated content
     */
    async generateContent(prompt: string): Promise<string> {
        try {
            console.log('MCP generateContent - Starting with model:', this.settings.model);
            
            // Prepare the request payload
            const payload = {
                model: this.settings.model,
                prompt: prompt,
                max_tokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                vendor: this.settings.vendor
            };
            
            console.log('MCP generateContent - Request payload:', JSON.stringify(payload));
            console.log('MCP generateContent - Server URL:', this.serverUrl);

            // Make the API request to the MCP server
            console.log('MCP generateContent - Sending request to server...');
            const response = await fetch(`${this.serverUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            }).catch(fetchError => {
                console.error('MCP generateContent - Fetch operation failed:', fetchError);
                throw new Error(`Network error: ${fetchError.message}`);
            });
            
            console.log('MCP generateContent - Response status:', response.status);

            // Check for errors
            if (!response.ok) {
                console.error('MCP generateContent - Response not OK:', response.status, response.statusText);
                const errorData = await response.json().catch(() => {
                    console.error('MCP generateContent - Failed to parse error response as JSON');
                    return { error: 'Unknown error' };
                });
                const errorMessage = errorData.error || `Server error: ${response.status}`;
                
                // Show a user-friendly error message
                showErrorNotice(`MCP server error: ${errorMessage}`, 10000);
                throw new Error(`MCP server error: ${errorMessage}`);
            }

            // Parse the response
            console.log('MCP generateContent - Parsing response...');
            const data = await response.json().catch(jsonError => {
                console.error('MCP generateContent - Failed to parse response as JSON:', jsonError);
                throw new Error('Failed to parse server response');
            });
            
            console.log('MCP generateContent - Response data received');
            return data.text || data.content || '';
        } catch (error) {
            console.error('MCP provider error:', error);
            
            // Show a user-friendly error message
            showErrorNotice(`Failed to generate content: ${error.message}`, 10000);
            throw error;
        }
    }

    /**
     * Check if the API key is valid
     * @returns True if the API key is valid, false otherwise
     */
    async isApiKeyValid(): Promise<boolean> {
        try {
            // Make a validation request to the MCP server
            const response = await fetch(`${this.serverUrl}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    vendor: this.settings.vendor
                })
            });

            // Return true if the response is ok
            return response.ok;
        } catch (error) {
            console.error('MCP API key validation error:', error);
            return false;
        }
    }

    /**
     * Get the vendor of this provider
     * @returns The AI vendor
     */
    getVendor(): AIVendor {
        return this.settings.vendor;
    }

    /**
     * Fetch available models from the MCP server
     * @returns Array of available models or null if the request fails
     */
    async fetchAvailableModels(): Promise<MCPModel[] | null> {
        try {
            // Make a request to the MCP server to get available models
            const response = await fetch(`${this.serverUrl}/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                const errorMessage = errorData.error || `Server error: ${response.status}`;
                console.error(`Failed to fetch models: ${errorMessage}`);
                return null;
            }

            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Error fetching models from MCP server:', error);
            return null;
        }
    }

    /**
     * Check if a model is available through MCP
     * @param modelId The model ID to check
     * @returns Model availability information
     */
     
    /**
     * Validate if a model exists on the MCP server
     * @param modelId The model ID to validate
     * @returns True if the model exists, false otherwise
     */
    async validateModel(modelId: string): Promise<boolean> {
        try {
            const models = await this.fetchAvailableModels();
            if (!models) return false;
            
            return models.some(model => model.id === modelId);
        } catch (error) {
            console.error('Error validating model:', error);
            return false;
        }
    }
    
    /**
     * Select the best available model from the MCP server based on vendor
     * @param vendor The AI vendor to filter by (optional)
     * @returns The best available model ID or null if none found
     */
    async selectBestAvailableModel(vendor?: AIVendor): Promise<string | null> {
        try {
            const models = await this.fetchAvailableModels();
            if (!models || models.length === 0) return null;
            
            // Filter models by vendor if specified
            const filteredModels = vendor 
                ? models.filter(model => model.vendor.toLowerCase() === vendor.toLowerCase())
                : models;
                
            if (filteredModels.length === 0) return null;
            
            // Define model status priority (higher number = higher priority)
            const statusPriority: Record<string, number> = {
                'generally_available': 5,
                'available': 4,
                'limited_preview': 3,
                'preview': 2,
                'experimental': 1,
                'deprecated': 0
            };
            
            // Sort models by status priority (highest first)
            const sortedModels = [...filteredModels].sort((a, b) => {
                const statusA = a.status?.toLowerCase() || 'unknown';
                const statusB = b.status?.toLowerCase() || 'unknown';
                const priorityA = statusPriority[statusA] || 0;
                const priorityB = statusPriority[statusB] || 0;
                return priorityB - priorityA;
            });
            
            // Return the ID of the highest priority model
            return sortedModels[0]?.id || null;
        } catch (error) {
            console.error('Error selecting best available model:', error);
            return null;
        }
    }
    
    async checkModelAvailability(modelId: string): Promise<{
        status: ModelAvailabilityStatus;
        reason?: string;
        fallbackModel?: string;
    }> {
        try {
            // Make a request to check model availability
            const response = await fetch(`${this.serverUrl}/models/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    vendor: this.settings.vendor
                })
            });

            if (!response.ok) {
                return {
                    status: ModelAvailabilityStatus.UNKNOWN,
                    reason: `Failed to check model status: ${response.statusText}`
                };
            }

            const data = await response.json();
            return {
                status: data.status || ModelAvailabilityStatus.UNKNOWN,
                reason: data.reason,
                fallbackModel: data.fallbackModel
            };
        } catch (error) {
            console.error('Error checking model availability:', error);
            return {
                status: ModelAvailabilityStatus.UNKNOWN,
                reason: `Error checking model: ${error.message}`
            };
        }
    }
}
