import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf, ViewState } from 'obsidian';
import { WebScraperService } from './services/web-scraper';
import { SummarizerService } from './services/summarizer';
import { SearchService } from './services/search';
import { SummaryView, SUMMARY_VIEW_TYPE, SummaryLevel } from './views/summary-view';
import { 
	ObsidianLinkSettings, 
	isValidApiKey, 
	loadApiKeyFromEnvironment, 
	saveApiKey, 
	MODEL_CATEGORIES,
	getModelById,
	getModelCategoriesForVendor,
	getApiKeyForVendor
} from './types';
import { AIVendor } from './utils/ai-providers';

const DEFAULT_SETTINGS: ObsidianLinkSettings = {
	// General settings
	vendor: AIVendor.GOOGLE, // Default to Google's Gemini
	model: 'gemini-1.5-pro', // Modern default model
	maxTokens: 1024,
	temperature: 0.7,
	
	// Vendor-specific API keys
	geminiApiKey: '',
	openaiApiKey: '',
	anthropicApiKey: '',
	
	// MCP server settings
	useMCP: false,
	mcpServerUrl: 'https://api.mcp.windsurf.ai/v1',
	mcpApiKey: ''
}

export default class ObsidianLinkPlugin extends Plugin {
	settings: ObsidianLinkSettings;
	summarizer: SummarizerService | null = null;
	searchService: SearchService | null = null;
	webScraper: WebScraperService | null = null;
	
	// Register the summary view type
	registerView(
		type: string,
		callback: (leaf: WorkspaceLeaf) => SummaryView
	) {
		super.registerView(type, callback);
	}

	// Helper method to ensure the summary view is open
	ensureSummaryViewOpen(): WorkspaceLeaf | null {
		const { workspace } = this.app;
		
		// Check if view already exists
		const existingView = workspace.getLeavesOfType(SUMMARY_VIEW_TYPE);
		
		if (existingView.length) {
			// View exists, focus it
			workspace.revealLeaf(existingView[0]);
			return existingView[0];
		}
		
		// Create a new leaf in the right sidebar
		const leaf = workspace.getRightLeaf(false);
		
		if (!leaf) {
			new Notice('Failed to create summary view');
			return null;
		}
		
		// Set the view type
		leaf.setViewState({
			type: SUMMARY_VIEW_TYPE,
			active: true,
			state: {}
		} as ViewState);
		
		// Focus the new leaf
		workspace.revealLeaf(leaf);
		
		return leaf;
	}
	
	async onload() {
		await this.loadSettings();
		
		// Initialize services if API key is available
		await this.initializeServices();
		
		// Register summary view
		this.registerView(
			SUMMARY_VIEW_TYPE,
			(leaf) => new SummaryView(leaf, this.settings, this.summarizer!)
		);
		
		// We've removed the automatic highlighting on file-open
		// This was causing yellow bars to appear when opening files in new tabs
		// Highlighting is now only applied when explicitly requested from search results

		// Add ribbon icon for web scraping
		const ribbonIconEl = this.addRibbonIcon('globe', 'Scrape Website', async () => {
			const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
			if (!apiKey) {
				new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings`);
				return;
			}
			
			new WebScraperModal(this.app, this.webScraper!).open();
		});

		// Add command for web scraping
		this.addCommand({
			id: 'scrape-website',
			name: 'Scrape Website',
			callback: () => {
				const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
				if (!apiKey) {
					new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings`);
					return;
				}
				
				new WebScraperModal(this.app, this.webScraper!).open();
			}
		});

		// Add command for summarizing selected text (original method - creates a new note)
		this.addCommand({
			id: 'summarize-selection',
			name: 'Summarize Selection to Note',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
				if (!apiKey) {
					new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings`);
					return;
				}
				
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}
				
				try {
					// Get the current file title to use in the new note
					const currentFile = view.file;
					if (!currentFile) {
						new Notice('Cannot determine current file');
						return;
					}
					
					// Get the current file title without extension
					const currentTitle = currentFile.basename;
					const newNoteTitle = `${currentTitle} Summary`;
					
					new Notice('Generating summary...');
					const summary = await this.summarizer!.summarize(selection);
					
					// Create a new note with the summary
					const folder = currentFile.parent?.path || '';
					const newNotePath = `${folder ? folder + '/' : ''}${newNoteTitle}.md`;
					
					// Create content with source reference and the summary
					// We're NOT adding a title as H1 since Obsidian already displays the filename as the title
					// Format the summary with proper markdown spacing for better readability
					const vendorName = this.settings.vendor.charAt(0).toUpperCase() + this.settings.vendor.slice(1);
					const content = `*Generated from [${currentTitle}](${currentFile.path}) using Obsidian-Link (${vendorName}).*\n\n${this.formatSummaryForReadability(summary.trim())}`;
					
					// Create the new file
					await this.app.vault.create(newNotePath, content);
					
					// Open the new file
					const newFile = this.app.vault.getAbstractFileByPath(newNotePath);
					if (newFile instanceof TFile) {
						await this.app.workspace.getLeaf().openFile(newFile);
					}
				} catch (error) {
					new Notice(`Failed to generate summary: ${error.message}`);
				}
			}
		});
		
		// Add command for summarizing selected text in a pane
		this.addCommand({
			id: 'summarize-selection-in-pane',
			name: 'Summarize Selection in Pane',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
				if (!apiKey) {
					new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings`);
					return;
				}
				
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('No text selected');
					return;
				}
				
				try {
					// Ensure the summary view is open
					const summaryLeaf = this.ensureSummaryViewOpen();
					if (!summaryLeaf) {
						new Notice('Failed to open summary view');
						return;
					}
					
					// Get the current file
					const currentFile = view.file;
					
					// Show loading notice
					new Notice('Generating summary...');
					
					// Get the summary view and generate the summary
					const summaryView = summaryLeaf.view as SummaryView;
					await summaryView.generateSummary(selection, currentFile);
					
					// Focus the summary view
					this.app.workspace.revealLeaf(summaryLeaf);
				} catch (error) {
					new Notice(`Failed to generate summary: ${error.message}`);
				}
			}
		});
		
		// Add command to open the summary view
		this.addCommand({
			id: 'open-summary-view',
			name: 'Open Summary View',
			callback: () => {
				this.ensureSummaryViewOpen();
			}
		});

		// Add command for semantic search
		this.addCommand({
			id: 'semantic-search',
			name: 'Semantic Search',
			callback: () => {
				const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
				if (!apiKey) {
					new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings`);
					return;
				}
				
				new SearchModal(this.app, this.searchService!).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new ObsidianLinkSettingTab(this.app, this));
	}

	onunload() {
		console.log('Unloading Gemini Link plugin');
	}

	/**
	 * Formats a summary for better readability with proper markdown spacing
	 * @param summary The raw summary text
	 * @returns Formatted summary with improved readability
	 */
	private formatSummaryForReadability(summary: string): string {
		// Split the summary into paragraphs
		const paragraphs = summary.split(/\n\s*\n/);
		
		// Process each paragraph
		const formattedParagraphs = paragraphs.map(paragraph => {
			// Trim whitespace
			paragraph = paragraph.trim();
			
			// If it's already a list item or a heading, leave it as is
			if (paragraph.startsWith('-') || paragraph.startsWith('*') || paragraph.startsWith('#') || 
				paragraph.startsWith('>') || paragraph.startsWith('1.') || paragraph.startsWith('```')) {
				return paragraph;
			}
			
			// If it's a very long paragraph (over 100 chars), add soft line breaks for readability
			if (paragraph.length > 100 && !paragraph.includes('\n')) {
				// Split into sentences
				const sentences = paragraph.split(/(?<=\.)\s+/);
				
				// Group sentences to create reasonable line lengths
				let formattedParagraph = '';
				let currentLine = '';
				
				for (const sentence of sentences) {
					if (currentLine.length + sentence.length > 80) {
						formattedParagraph += currentLine + '\n';
						currentLine = sentence;
					} else {
						currentLine += (currentLine ? ' ' : '') + sentence;
					}
				}
				
				if (currentLine) {
					formattedParagraph += currentLine;
				}
				
				return formattedParagraph;
			}
			
			return paragraph;
		});
		
		// Join paragraphs with double line breaks for better spacing
		return formattedParagraphs.join('\n\n');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Try to load API keys from environment if not set in settings
		// For Google Gemini
		if (!this.settings.geminiApiKey) {
			const envApiKey = loadApiKeyFromEnvironment(AIVendor.GOOGLE);
			if (envApiKey && isValidApiKey(envApiKey, AIVendor.GOOGLE)) {
				console.log('Valid Google Gemini API key loaded from environment');
				this.settings.geminiApiKey = envApiKey;
				await this.saveData(this.settings);
				// Save to plugin settings (more secure than localStorage)
				saveApiKey(envApiKey, AIVendor.GOOGLE, this);
			} else if (envApiKey) {
				console.warn('Invalid Google Gemini API key format found in environment');
			}
		}
		
		// For OpenAI
		if (!this.settings.openaiApiKey) {
			const envApiKey = loadApiKeyFromEnvironment(AIVendor.OPENAI);
			if (envApiKey && isValidApiKey(envApiKey, AIVendor.OPENAI)) {
				console.log('Valid OpenAI API key loaded from environment');
				this.settings.openaiApiKey = envApiKey;
				await this.saveData(this.settings);
				// Save to plugin settings (more secure than localStorage)
				saveApiKey(envApiKey, AIVendor.OPENAI, this);
			} else if (envApiKey) {
				console.warn('Invalid OpenAI API key format found in environment');
			}
		}
		
		// For Anthropic
		if (!this.settings.anthropicApiKey) {
			const envApiKey = loadApiKeyFromEnvironment(AIVendor.ANTHROPIC);
			if (envApiKey && isValidApiKey(envApiKey, AIVendor.ANTHROPIC)) {
				console.log('Valid Anthropic API key loaded from environment');
				this.settings.anthropicApiKey = envApiKey;
				await this.saveData(this.settings);
				// Save to plugin settings (more secure than localStorage)
				saveApiKey(envApiKey, AIVendor.ANTHROPIC, this);
			} else if (envApiKey) {
				console.warn('Invalid Anthropic API key format found in environment');
			}
		}
	}

	async saveSettings() {
		// Validate API keys before saving
		const currentVendor = this.settings.vendor;
		const apiKey = getApiKeyForVendor(this.settings, currentVendor);
		
		if (apiKey && !isValidApiKey(apiKey, currentVendor)) {
			new Notice(`Invalid ${currentVendor} API key format. Please check your API key.`);
			return;
		}

		// If API key is valid, save it to plugin settings (more secure than localStorage)
		if (apiKey) {
			saveApiKey(apiKey, currentVendor, this);
		}

		await this.saveData(this.settings);
		this.initializeServices();
	}

	async initializeServices() {
        // Get the appropriate API key for the selected vendor
        const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
        
        // Only initialize services if we have an API key
        if (apiKey) {
            try {
                // Create provider settings with MCP configuration
                const providerSettings = {
                    apiKey,
                    model: this.settings.model,
                    maxTokens: this.settings.maxTokens,
                    temperature: this.settings.temperature,
                    vendor: this.settings.vendor,
                    useMCP: this.settings.useMCP,
                    mcpServerUrl: this.settings.mcpServerUrl
                };
                
                // Initialize the services - they will handle async provider creation internally
                this.summarizer = new SummarizerService(this.settings);
                this.searchService = new SearchService(this.settings, this.app);
                this.webScraper = new WebScraperService(this.settings);
                
                // Log initialization status
                if (this.settings.useMCP) {
                    console.log(`Services initialized using MCP server at ${this.settings.mcpServerUrl}`);
                } else {
                    console.log(`Services initialized using direct ${this.settings.vendor} API`);
                }
            } catch (error) {
                console.error(`Error initializing AI services:`, error);
                new Notice(`Error initializing AI services. Check console for details.`);
                this.summarizer = null;
                this.searchService = null;
                this.webScraper = null;
            }
        } else {
            console.warn(`No API key found for ${this.settings.vendor}. Services will not be initialized.`);
            this.summarizer = null;
            this.searchService = null;
            this.webScraper = null;
        }
    }
}

class WebScraperModal extends Modal {
	webScraper: WebScraperService;
	urlInputEl: HTMLInputElement;
	scrapeWebsite: () => Promise<void>;
	
	constructor(app: App, webScraper: WebScraperService) {
		super(app);
		this.webScraper = webScraper;
	}

	onOpen() {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: 'Scrape Website' });
		
		contentEl.createEl('p', { 
			text: 'Enter the URL of the website you want to scrape. The content will be extracted and formatted as Markdown.'
		});
		
		this.urlInputEl = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'https://example.com'
		});
		this.urlInputEl.style.width = '100%';
		this.urlInputEl.style.marginBottom = '1rem';
		
		// Focus the input field when the modal opens
		setTimeout(() => this.urlInputEl.focus(), 10);
		
		// Add Enter key support for scraping
		this.urlInputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.scrapeWebsite();
			}
		});
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '0.5rem';
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		
		const scrapeButton = buttonContainer.createEl('button', { text: 'Scrape' });
		scrapeButton.classList.add('mod-cta');
		scrapeButton.addEventListener('click', () => this.scrapeWebsite());
		
		// Create a method to handle scraping
		this.scrapeWebsite = async () => {
			const url = this.urlInputEl.value.trim();
			
			if (!url) {
				new Notice('Please enter a URL');
				return;
			}
			
			// Validate URL format
			try {
				new URL(url);
			} catch (e) {
				new Notice('Please enter a valid URL');
				return;
			}
			
			try {
				new Notice('Scraping website...');
				this.close();
				
				// Ensure the 'Web scrapes' folder exists
				const folderPath = 'Web scrapes';
				let folder = this.app.vault.getAbstractFileByPath(folderPath);
				
				// Create the folder if it doesn't exist
				if (!folder) {
					try {
						await this.app.vault.createFolder(folderPath);
						console.log(`Created '${folderPath}' folder`);
					} catch (folderError) {
						console.error(`Error creating folder: ${folderError}`);
						// Continue anyway, it might fail if the folder already exists
					}
				}
				
				const content = await this.webScraper.scrapeWebsite(url);
				
				// Create a new note with the scraped content
				const siteName = new URL(url).hostname;
				const dateStr = new Date().toISOString().split('T')[0];
				const fileName = `Scraped - ${siteName} - ${dateStr}`;
				
				// Save to the Web scrapes folder with fixed title (not duplicated)
				const filePath = `${folderPath}/${fileName}.md`;
				const newFile = await this.app.vault.create(
					filePath,
					`# ${siteName}\n\nSource: [${url}](${url})\n\n${content}`
				);
				
				// Open the new note
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(newFile);
				
				new Notice(`Website scraped successfully to '${folderPath}' folder`);
			} catch (error) {
				console.error('Error scraping website:', error);
				new Notice('Error scraping website. Check console for details.');
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SearchModal extends Modal {
	searchService: SearchService;
	queryInputEl: HTMLInputElement;
	resultsContainerEl: HTMLElement | null = null;
	performSearch: () => Promise<void>;
	
	constructor(app: App, searchService: SearchService) {
		super(app);
		this.searchService = searchService;
	}

	onOpen() {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: 'Smart Search' });
		
		contentEl.createEl('p', { 
			text: 'Enter your search query. Gemini AI will help find the most relevant notes in your vault.'
		});
		
		this.queryInputEl = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Search query...'
		});
		this.queryInputEl.style.width = '100%';
		this.queryInputEl.style.marginBottom = '1rem';
		
		// Add Enter key support for search
		this.queryInputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.performSearch();
			}
		});
		
		// Focus the input field when the modal opens
		setTimeout(() => this.queryInputEl.focus(), 10);
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '0.5rem';
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		
		const searchButton = buttonContainer.createEl('button', { text: 'Search' });
		searchButton.classList.add('mod-cta');
		searchButton.addEventListener('click', () => this.performSearch());
		
		// Create a method to perform the search
		this.performSearch = async () => {
			const query = this.queryInputEl.value.trim();
			
			if (!query) {
				new Notice('Please enter a search query');
				return;
			}
			
			try {
				if (this.resultsContainerEl) {
					this.resultsContainerEl.remove();
				}
				
				this.resultsContainerEl = contentEl.createDiv();
				this.resultsContainerEl.style.marginTop = '1rem';
				this.resultsContainerEl.createEl('p', { text: 'Searching...' });
				
				const results = await this.searchService.search(query);
				
				this.resultsContainerEl.empty();
				
				if (results.length === 0) {
					this.resultsContainerEl.createEl('p', { text: 'No results found.' });
					return;
				}
				
				// Add a header with result count and actions
				const resultsHeader = this.resultsContainerEl.createEl('div', { cls: 'search-results-header' });
				resultsHeader.createEl('h3', { text: `Found ${results.length} relevant notes` });
				
				// Add a 'View All' button to open all relevant results in separate tabs
				const viewAllButton = resultsHeader.createEl('button', { text: 'View All in Tabs' });
				viewAllButton.addEventListener('click', async () => {
					// Open each result in a new tab
					for (const result of results) {
						const file = this.app.vault.getAbstractFileByPath(result.path);
						if (file && file instanceof TFile) {
							// Open the file in a new tab without highlighting
							const leaf = this.app.workspace.getLeaf('tab');
							await leaf.openFile(file);
							// Note: We intentionally don't apply highlighting in new tabs
						}
					}
					// Close the modal after opening all tabs
					this.close();
				});
				
				// Add CSS for the search results
				const styleEl = document.createElement('style');
				styleEl.textContent = `
					.search-results-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 1rem;
					}
					.search-result-excerpt {
						margin-top: 0.5rem;
						font-size: 0.9em;
						color: var(--text-muted);
						white-space: pre-wrap;
					}
					.search-result-score {
						margin-top: 0.3rem;
						font-size: 0.8em;
						color: var(--text-accent);
						font-weight: bold;
					}
					.search-result-explanation {
						margin-top: 0.3rem;
						font-size: 0.85em;
						color: var(--text-normal);
						font-style: italic;
					}
					.search-result-highlight {
						background-color: var(--text-highlight-bg);
						color: var(--text-normal);
						padding: 0 2px;
						border-radius: 3px;
						font-weight: bold;
					}
					a.visited {
						color: var(--text-accent);
						font-style: italic;
					}
				`;
				document.head.appendChild(styleEl);
				
				const resultsList = this.resultsContainerEl.createEl('ul');
				
				for (const result of results) {
					const listItem = resultsList.createEl('li');
					const link = listItem.createEl('a', { 
						text: result.title,
						href: '#'
					});
					
					link.addEventListener('click', async (e) => {
						e.preventDefault();
						const file = this.app.vault.getAbstractFileByPath(result.path);
						if (file && file instanceof TFile) {
							// Open the file but keep the modal open
							await this.app.workspace.getLeaf(false).openFile(file);
							
							// Highlighting has been completely removed
							
							// Mark this result as visited
							link.classList.add('visited');
						}
					});
					
					// Add score and relevance information
					const scoreEl = listItem.createEl('div', {
						cls: 'search-result-score',
						text: `Relevance: ${Math.round(result.score * 100)}%`
					});
					
					// Add explanation of why this result is relevant
					if (result.explanation) {
						const explanationEl = listItem.createEl('div', {
							cls: 'search-result-explanation'
						});
						explanationEl.setText(`Why this is relevant: ${result.explanation}`);
					}
					
					// Create excerpt element with highlights
					const excerptEl = listItem.createEl('div', { 
						cls: 'search-result-excerpt'
					});
					
					// Process excerpt to render highlights
					const excerptText = result.excerpt;
					
					// Check if the excerpt contains highlight markers
					if (excerptText.includes('[[highlight]]')) {
						// Split by highlight markers and render with proper styling
						const parts = excerptText.split(/\[\[highlight\]\]|\[\[\/highlight\]\]/g);
						let isHighlighted = false;
						
						for (const part of parts) {
							if (!part) continue; // Skip empty parts
							
							if (isHighlighted) {
								// Create a highlighted span
								const highlightSpan = excerptEl.createSpan({ text: part });
								highlightSpan.addClass('search-result-highlight');
							} else {
								// Create a normal text node
								excerptEl.createSpan({ text: part });
							}
							
							// Toggle highlight state for next part
							isHighlighted = !isHighlighted;
						}
					} else {
						// If no highlights, just set the text content
						excerptEl.setText(excerptText);
					}
				}
			} catch (error) {
				console.error('Error performing search:', error);
				new Notice('Error performing search. Check console for details.');
			}
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ObsidianLinkSettingTab extends PluginSettingTab {
	plugin: ObsidianLinkPlugin;

	constructor(app: App, plugin: ObsidianLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'AI Link Settings' });

		// Only show direct vendor selection when not using MCP
		if (!this.plugin.settings.useMCP) {
			// Create a container for vendor selection
			const vendorContainer = containerEl.createDiv();
			vendorContainer.addClass('ai-vendor-container');
			
			// Add vendor selection heading
			const vendorHeading = vendorContainer.createEl('h3', { text: 'AI Vendor' });
			vendorHeading.style.marginBottom = '8px';
			
			// Add vendor dropdown
			new Setting(vendorContainer)
				.setName('AI Vendor')
				.setDesc('Select which AI provider to use')
				.addDropdown(dropdown => {
					// Add vendor options
					dropdown.addOption('google', 'Google Gemini');
					dropdown.addOption('openai', 'OpenAI');
					dropdown.addOption('anthropic', 'Anthropic Claude');
					
					// Set current value
					dropdown.setValue(this.plugin.settings.vendor);
					
					// Handle changes
					dropdown.onChange(async (value) => {
						// Update settings
						this.plugin.settings.vendor = value as AIVendor;
						
						// Update the model dropdown with models for this vendor
						this.display(); // Refresh the entire settings panel
						
						// Save settings
						await this.plugin.saveSettings();
						
						// Reinitialize services with the new vendor
						this.plugin.initializeServices();
					});
				});
		}
		
		// Create containers for each vendor's API key
		const apiKeysContainer = containerEl.createDiv();
		apiKeysContainer.addClass('ai-api-keys-container');
		
		// Add API keys heading with security note
		const apiKeysHeading = apiKeysContainer.createEl('h3', { text: 'API Keys' });
		apiKeysHeading.style.marginBottom = '8px';
		
		// Add security notice
		const securityNotice = apiKeysContainer.createEl('div', { cls: 'setting-item-description' });
		securityNotice.innerHTML = '⚠️ <strong>Security Note:</strong> API keys are stored in your Obsidian vault\'s config folder. ' + 
			'They are not shared with any third parties except the AI provider you select.<br><br>' +
			'<strong>Security Recommendations:</strong><br>' +
			'• Use environment variables during development<br>' +
			'• Never commit API keys to version control<br>' +
			'• Keep your Obsidian vault secure<br>' +
			'• Regularly rotate your API keys';
		securityNotice.style.marginBottom = '16px';
		securityNotice.style.padding = '8px';
		securityNotice.style.border = '1px solid var(--background-modifier-border)';
		securityNotice.style.borderRadius = '4px';
		securityNotice.style.backgroundColor = 'var(--background-secondary)';
		
		// Helper function to update validation status
		function updateApiKeyValidationStatus(container: HTMLElement, isValid: boolean, hasValue: boolean) {
			const validationEl = container.querySelector('.api-validation-message') as HTMLElement;
			if (!validationEl) return;
			
			validationEl.empty();
			
			if (!hasValue) {
				validationEl.textContent = 'API key is required to use this vendor';
				validationEl.style.color = 'var(--text-muted)';
			} else if (isValid) {
				validationEl.textContent = '✓ API key format is valid';
				validationEl.style.color = 'var(--text-success)';
			} else {
				validationEl.textContent = '⚠ Invalid API key format';
				validationEl.style.color = 'var(--text-error)';
			}
		}
		
		// Add Gemini API key input
		const geminiKeyContainer = apiKeysContainer.createDiv();
		geminiKeyContainer.addClass('api-key-container');
		geminiKeyContainer.style.marginBottom = '16px';
		
		const geminiSetting = new Setting(geminiKeyContainer)
			.setName('Google Gemini API Key')
			.setDesc('Enter your Google Gemini API key (starts with "AI")')
			.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.geminiApiKey)
					.onChange(async (value) => {
						// Update the validation status
						updateApiKeyValidationStatus(geminiKeyContainer, isValidApiKey(value, AIVendor.GOOGLE), !!value);
						
						// Update settings
						this.plugin.settings.geminiApiKey = value;
						await this.plugin.saveSettings();
						
						// Reinitialize services if this is the current vendor
						if (this.plugin.settings.vendor === AIVendor.GOOGLE) {
							this.plugin.initializeServices();
						}
					});
					
				// Set as password field by default
				text.inputEl.type = 'password';
				return text;
			})
			.addExtraButton(button => 
				button
					.setIcon('eye-off')
					.setTooltip('Show API key')
					.onClick(() => {
						const textInput = geminiSetting.controlEl.querySelector('input');
						if (textInput) {
							if (textInput.type === 'password') {
								textInput.type = 'text';
								button.setIcon('eye');
								button.setTooltip('Hide API key');
							} else {
								textInput.type = 'password';
								button.setIcon('eye-off');
								button.setTooltip('Show API key');
							}
						}
					}))
			.addExtraButton(button => 
				button
					.setIcon('shield')
					.setTooltip('Stored securely in Obsidian config')
					.onClick(() => {}));
		
		// Add validation status element for Gemini
		const geminiValidationEl = geminiKeyContainer.createDiv();
		geminiValidationEl.addClass('api-validation-message');
		geminiValidationEl.style.marginTop = '8px';
		geminiValidationEl.style.fontSize = '12px';
		
		// Initialize validation status for Gemini
		updateApiKeyValidationStatus(geminiKeyContainer, isValidApiKey(this.plugin.settings.geminiApiKey, AIVendor.GOOGLE), !!this.plugin.settings.geminiApiKey);
		
		// Add OpenAI API key input
		const openaiKeyContainer = apiKeysContainer.createDiv();
		openaiKeyContainer.addClass('api-key-container');
		openaiKeyContainer.style.marginBottom = '16px';
		
		const openaiSetting = new Setting(openaiKeyContainer)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key (starts with "sk-")')
			.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						// Update the validation status
						updateApiKeyValidationStatus(openaiKeyContainer, isValidApiKey(value, AIVendor.OPENAI), !!value);
						
						// Update settings
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
						
						// Reinitialize services if this is the current vendor
						if (this.plugin.settings.vendor === AIVendor.OPENAI) {
							this.plugin.initializeServices();
						}
					});
					
				// Set as password field by default
				text.inputEl.type = 'password';
				return text;
			})
			.addExtraButton(button => 
				button
					.setIcon('eye-off')
					.setTooltip('Show API key')
					.onClick(() => {
						const textInput = openaiSetting.controlEl.querySelector('input');
						if (textInput) {
							if (textInput.type === 'password') {
								textInput.type = 'text';
								button.setIcon('eye');
								button.setTooltip('Hide API key');
							} else {
								textInput.type = 'password';
								button.setIcon('eye-off');
								button.setTooltip('Show API key');
							}
						}
					}))
			.addExtraButton(button => 
				button
					.setIcon('shield')
					.setTooltip('Stored securely in Obsidian config')
					.onClick(() => {}));
		
		// Add validation status element for OpenAI
		const openaiValidationEl = openaiKeyContainer.createDiv();
		openaiValidationEl.addClass('api-validation-message');
		openaiValidationEl.style.marginTop = '8px';
		openaiValidationEl.style.fontSize = '12px';
		
		// Initialize validation status for OpenAI
		updateApiKeyValidationStatus(openaiKeyContainer, isValidApiKey(this.plugin.settings.openaiApiKey, AIVendor.OPENAI), !!this.plugin.settings.openaiApiKey);
		
		// Add Anthropic API key input
		const anthropicKeyContainer = apiKeysContainer.createDiv();
		anthropicKeyContainer.addClass('api-key-container');
		anthropicKeyContainer.style.marginBottom = '16px';
		
		const anthropicSetting = new Setting(anthropicKeyContainer)
			.setName('Anthropic API Key')
			.setDesc('Enter your Anthropic API key (starts with "sk-ant-")')
			.addText(text => {
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						// Update the validation status
						updateApiKeyValidationStatus(anthropicKeyContainer, isValidApiKey(value, AIVendor.ANTHROPIC), !!value);
						
						// Update settings
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
						
						// Reinitialize services if this is the current vendor
						if (this.plugin.settings.vendor === AIVendor.ANTHROPIC) {
							this.plugin.initializeServices();
						}
					});
					
				// Set as password field by default
				text.inputEl.type = 'password';
				return text;
			})
			.addExtraButton(button => 
				button
					.setIcon('eye-off')
					.setTooltip('Show API key')
					.onClick(() => {
						const textInput = anthropicSetting.controlEl.querySelector('input');
						if (textInput) {
							if (textInput.type === 'password') {
								textInput.type = 'text';
								button.setIcon('eye');
								button.setTooltip('Hide API key');
							} else {
								textInput.type = 'password';
								button.setIcon('eye-off');
								button.setTooltip('Show API key');
							}
						}
					}))
			.addExtraButton(button => 
				button
					.setIcon('shield')
					.setTooltip('Stored securely in Obsidian config')
					.onClick(() => {}));
		
		// Add validation status element for Anthropic
		const anthropicValidationEl = anthropicKeyContainer.createDiv();
		anthropicValidationEl.addClass('api-validation-message');
		anthropicValidationEl.style.marginTop = '8px';
		anthropicValidationEl.style.fontSize = '12px';
		
		// Initialize validation status for Anthropic
		updateApiKeyValidationStatus(anthropicKeyContainer, isValidApiKey(this.plugin.settings.anthropicApiKey, AIVendor.ANTHROPIC), !!this.plugin.settings.anthropicApiKey);

		// Create a container for model selection - only when not using MCP
		if (!this.plugin.settings.useMCP) {
			const modelContainer = containerEl.createDiv();
			modelContainer.addClass('ai-model-container');
			
			// Add model selection heading
			const modelHeading = modelContainer.createEl('h3', { text: 'Model Selection' });
			modelHeading.style.marginBottom = '8px';
			
			// Get model categories for the current vendor
			const vendorCategories = getModelCategoriesForVendor(this.plugin.settings.vendor);
			
			// Add model dropdown with available models for the selected vendor
			const modelSetting = new Setting(modelContainer)
				.setName('Model')
				.setDesc(`Select the ${this.plugin.settings.vendor} model to use for AI features`)
				.addDropdown(dropdown => {
					// Add model options grouped by category
					for (const category of vendorCategories) {
						// Add category as a group header (non-selectable)
						dropdown.addOption(`--${category.name}--`, `--- ${category.name} ---`);
						
						// Add models in this category
						for (const model of category.models) {
							// Add status indicator based on model status
							let statusIndicator = '';
							
							if (model.status) {
								switch(model.status.toLowerCase()) {
									case 'generally_available':
									case 'available':
										statusIndicator = '🟢 ';
										break;
									case 'limited_preview':
									case 'preview':
										statusIndicator = '🟡 ';
										break;
									case 'experimental':
										statusIndicator = '🟠 ';
										break;
									case 'deprecated':
										statusIndicator = '🔴 ';
										break;
									default:
										break;
								}
							}
							
							// Add model with status indicator if available
							dropdown.addOption(model.id, `${statusIndicator}${model.name}`);
						}
					}
					
					// Set the current value if it's available for this vendor, otherwise use the first model
					const currentModel = this.plugin.settings.model;
					const modelExists = vendorCategories.some(category => 
						category.models.some(model => model.id === currentModel));
					
					if (modelExists) {
						dropdown.setValue(currentModel);
					} else if (vendorCategories.length > 0 && vendorCategories[0].models.length > 0) {
						// Use the first model of the first category as default
						const defaultModel = vendorCategories[0].models[0].id;
						dropdown.setValue(defaultModel);
						// Update settings with the new default model
						this.plugin.settings.model = defaultModel;
						this.plugin.saveSettings();
					}
					
					// Handle changes
					dropdown.onChange(async (value: string) => {
						// Skip category headers
						if (value.startsWith('--')) {
							// Reset to previous value
							dropdown.setValue(this.plugin.settings.model);
							return;
						}
						
						// Update model description
						const model = getModelById(value);
						if (model && modelDescEl) {
							modelDescEl.empty();
							modelDescEl.textContent = model.description;
						}
						
						// Update settings
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
						
						// Reinitialize services with the new model
						this.plugin.initializeServices();
					});
				});
				
			// Add model description element
			const modelDescEl = modelContainer.createDiv();
			modelDescEl.addClass('ai-model-description');
			modelDescEl.style.marginTop = '8px';
			modelDescEl.style.marginBottom = '16px';
			modelDescEl.style.fontSize = '12px';
			modelDescEl.style.color = 'var(--text-muted)';
			
			// Set initial model description
			const initialModel = getModelById(this.plugin.settings.model);
			if (initialModel) {
				modelDescEl.textContent = initialModel.description;
			}
		}

		new Setting(containerEl)
			.setName('Max Tokens')
			.setDesc('Maximum number of tokens to generate')
			.addSlider(slider => slider
				.setLimits(256, 4096, 256)
				.setValue(this.plugin.settings.maxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxTokens = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Controls randomness: 0 is deterministic, 1 is very creative')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.temperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				}));

        // Create a container for MCP server settings
        const mcpContainer = containerEl.createDiv();
        mcpContainer.addClass('mcp-server-container');
        
        // Add MCP server heading
        const mcpHeading = mcpContainer.createEl('h3', { text: 'MCP Server Configuration' });
        mcpHeading.style.marginBottom = '8px';
        mcpHeading.style.marginTop = '24px';
        
        // Add MCP server description
        const mcpDescription = mcpContainer.createEl('div', { cls: 'setting-item-description' });
        mcpDescription.innerHTML = 'MCP (Model Control Plane) servers provide enhanced security and unified access to multiple AI providers. ' + 
            'Using an MCP server allows you to keep API keys on the server side and simplifies model management.<br><br>' + 
            '<strong>Note:</strong> When MCP is enabled, model selection is handled by the MCP server. ' + 
            'The direct vendor and model selection options will be hidden as they are not applicable.';
        mcpDescription.style.marginBottom = '16px';
        
        // Add toggle for using MCP server
        new Setting(mcpContainer)
            .setName('Use MCP Server')
            .setDesc('Enable to use an MCP server instead of direct API connections')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useMCP)
                .onChange(async (value) => {
                    this.plugin.settings.useMCP = value;
                    await this.plugin.saveSettings();
                    
                    // Refresh the settings display to show/hide MCP-specific settings
                    this.display();
                }));
        
        // Only show these settings if MCP is enabled
        if (this.plugin.settings.useMCP) {
            // Add MCP server URL input
            new Setting(mcpContainer)
                .setName('MCP Server URL')
                .setDesc('Enter the URL of your MCP server')
                .addText(text => text
                    .setPlaceholder('https://api.mcp.example.com/v1')
                    .setValue(this.plugin.settings.mcpServerUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.mcpServerUrl = value;
                        await this.plugin.saveSettings();
                    }));
            
            // Add MCP API key input
            const mcpKeyContainer = mcpContainer.createDiv();
            mcpKeyContainer.addClass('api-key-container');
            mcpKeyContainer.style.marginBottom = '16px';
            
            const mcpSetting = new Setting(mcpKeyContainer)
                .setName('MCP API Key')
                .setDesc('Enter your MCP server API key')
                .addText(text => {
                    text.setPlaceholder('Enter your MCP API key')
                        .setValue(this.plugin.settings.mcpApiKey)
                        .onChange(async (value) => {
                            // Update settings
                            this.plugin.settings.mcpApiKey = value;
                            await this.plugin.saveSettings();
                            
                            // Reinitialize services if MCP is enabled
                            if (this.plugin.settings.useMCP) {
                                this.plugin.initializeServices();
                            }
                        });
                        
                    // Set as password field by default
                    text.inputEl.type = 'password';
                    return text;
                })
                .addExtraButton(button => 
                    button
                        .setIcon('eye-off')
                        .setTooltip('Show API key')
                        .onClick(() => {
                            const textInput = mcpSetting.controlEl.querySelector('input');
                            if (textInput) {
                                if (textInput.type === 'password') {
                                    textInput.type = 'text';
                                    button.setIcon('eye');
                                    button.setTooltip('Hide API key');
                                } else {
                                    textInput.type = 'password';
                                    button.setIcon('eye-off');
                                    button.setTooltip('Show API key');
                                }
                            }
                        }))
                .addExtraButton(button => 
                    button
                        .setIcon('shield')
                        .setTooltip('Stored securely in Obsidian config')
                        .onClick(() => {}));
            
            // Add test connection button
            new Setting(mcpContainer)
                .setName('Test MCP Connection')
                .setDesc('Test the connection to your MCP server')
                .addButton(button => button
                    .setButtonText('Test Connection')
                    .onClick(async () => {
                        try {
                            // Show testing notice
                            new Notice('Testing MCP server connection...');
                            
                            // Make a request to the MCP server
                            const response = await fetch(`${this.plugin.settings.mcpServerUrl}/health`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${this.plugin.settings.mcpApiKey}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (response.ok) {
                                new Notice('✅ MCP server connection successful!');
                            } else {
                                new Notice(`❌ MCP server connection failed: ${response.statusText}`);
                            }
                        } catch (error) {
                            console.error('Error testing MCP connection:', error);
                            new Notice(`❌ MCP server connection failed: ${error.message}`);
                        }
                    }));
                    
            // Add fetch models button
            const fetchModelsContainer = mcpContainer.createDiv();
            fetchModelsContainer.addClass('mcp-models-container');
            fetchModelsContainer.style.marginTop = '16px';
            
            const fetchModelsSetting = new Setting(fetchModelsContainer)
                .setName('Available MCP Models')
                .setDesc('Fetch available models from your MCP server')
                .addButton(button => button
                    .setButtonText('Fetch Models')
                    .onClick(async () => {
                        try {
                            // Show fetching notice
                            new Notice('Fetching available models from MCP server...');
                            
                            // Create a temporary MCP provider to fetch models
                            const { MCPProvider } = await import('./utils/ai-providers/mcp-provider');
                            const mcpProvider = new MCPProvider(
                                this.plugin.settings.mcpApiKey,
                                {
                                    apiKey: this.plugin.settings.mcpApiKey,
                                    model: this.plugin.settings.model,
                                    maxTokens: this.plugin.settings.maxTokens,
                                    temperature: this.plugin.settings.temperature,
                                    vendor: this.plugin.settings.vendor,
                                    useMCP: true,
                                    mcpServerUrl: this.plugin.settings.mcpServerUrl
                                },
                                this.plugin.settings.mcpServerUrl
                            );
                            
                            // Fetch available models
                            const models = await mcpProvider.fetchAvailableModels();
                            
                            if (!models) {
                                new Notice('❌ Failed to fetch models from MCP server');
                                return;
                            }
                            
                            // Clear previous models list
                            const modelsListEl = fetchModelsContainer.querySelector('.mcp-models-list');
                            if (modelsListEl) {
                                modelsListEl.remove();
                            }
                            
                            // Create models list container
                            const modelsListContainer = fetchModelsContainer.createDiv();
                            modelsListContainer.addClass('mcp-models-list');
                            modelsListContainer.style.marginTop = '8px';
                            modelsListContainer.style.padding = '8px';
                            modelsListContainer.style.border = '1px solid var(--background-modifier-border)';
                            modelsListContainer.style.borderRadius = '4px';
                            modelsListContainer.style.backgroundColor = 'var(--background-secondary)';
                            
                            // Add models count
                            const modelsCountEl = modelsListContainer.createEl('div', { text: `${models.length} models available` });
                            modelsCountEl.style.fontWeight = 'bold';
                            modelsCountEl.style.marginBottom = '8px';
                            
                            // Group models by vendor
                            const modelsByVendor: Record<string, any[]> = {};
                            models.forEach(model => {
                                if (!modelsByVendor[model.vendor]) {
                                    modelsByVendor[model.vendor] = [];
                                }
                                modelsByVendor[model.vendor].push(model);
                            });
                            
                            // Display models grouped by vendor
                            Object.entries(modelsByVendor).forEach(([vendor, vendorModels]) => {
                                // Add vendor heading
                                const vendorEl = modelsListContainer.createEl('div', { text: vendor.toUpperCase() });
                                vendorEl.style.fontWeight = 'bold';
                                vendorEl.style.marginTop = '8px';
                                vendorEl.style.marginBottom = '4px';
                                
                                // Add models for this vendor
                                const modelsList = modelsListContainer.createEl('ul');
                                modelsList.style.marginTop = '4px';
                                modelsList.style.paddingLeft = '20px';
                                
                                vendorModels.forEach(model => {
                                    const modelItem = modelsList.createEl('li');
                                    const modelText = `${model.name} (${model.id})`;
                                    
                                    // Add status indicator
                                    let statusIndicator = '•';
                                    let statusColor = 'var(--text-normal)';
                                    
                                    if (model.status) {
                                        switch(model.status.toLowerCase()) {
                                            case 'generally_available':
                                            case 'available':
                                                statusIndicator = '🟢';
                                                statusColor = 'var(--text-success)';
                                                break;
                                            case 'limited_preview':
                                            case 'preview':
                                                statusIndicator = '🟡';
                                                statusColor = 'var(--text-warning)';
                                                break;
                                            case 'experimental':
                                                statusIndicator = '🟠';
                                                statusColor = 'var(--text-warning)';
                                                break;
                                            case 'deprecated':
                                                statusIndicator = '🔴';
                                                statusColor = 'var(--text-error)';
                                                break;
                                            default:
                                                statusIndicator = '⚪';
                                                break;
                                        }
                                    }
                                    
                                    const modelTextWithStatus = `${statusIndicator} ${modelText}`;
                                    modelItem.setText(modelTextWithStatus);
                                    modelItem.style.color = statusColor;
                                    
                                    // Add click handler to select this model
                                    modelItem.style.cursor = 'pointer';
                                    modelItem.addEventListener('click', async () => {
                                        this.plugin.settings.model = model.id;
                                        this.plugin.settings.vendor = model.vendor as AIVendor;
                                        await this.plugin.saveSettings();
                                        this.plugin.initializeServices();
                                        new Notice(`Selected model: ${model.name}`);
                                        this.display(); // Refresh settings to show selected model
                                    });
                                    
                                    // Add tooltip with description if available
                                    if (model.description) {
                                        modelItem.setAttribute('aria-label', model.description);
                                        modelItem.addClass('has-tooltip');
                                    }
                                });
                            });
                            
                            new Notice('✅ Successfully fetched models from MCP server');
                        } catch (error) {
                            console.error('Error fetching models:', error);
                            new Notice(`❌ Failed to fetch models: ${error.message}`);
                        }
                    }));
        }
	}
}
