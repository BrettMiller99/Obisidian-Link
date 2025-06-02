import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, WorkspaceLeaf } from 'obsidian';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebScraperService } from './services/web-scraper';
import { SummarizerService } from './services/summarizer';
import { SearchService } from './services/search';
import { GeminiApi } from './utils/gemini-api';
import { 
	GeminiLinkSettings, 
	isValidApiKey, 
	loadApiKeyFromEnvironment, 
	saveApiKey, 
	GEMINI_MODEL_CATEGORIES,
	getModelById,
	GeminiModelOption
} from './types';

const DEFAULT_SETTINGS: GeminiLinkSettings = {
	apiKey: '',
	model: 'gemini-1.5-pro', // Modern default model
	maxTokens: 1024,
	temperature: 0.7
}

export default class GeminiLinkPlugin extends Plugin {
	settings: GeminiLinkSettings;
	geminiApi: GeminiApi | null = null;
	summarizer: SummarizerService | null = null;
	searchService: SearchService | null = null;
	webScraper: WebScraperService | null = null;

	async onload() {
		await this.loadSettings();
		
		// Initialize services if API key is available
		this.initializeServices();
		
		// We've removed the automatic highlighting on file-open
		// This was causing yellow bars to appear when opening files in new tabs
		// Highlighting is now only applied when explicitly requested from search results

		// Add ribbon icon for web scraping
		const ribbonIconEl = this.addRibbonIcon('globe', 'Scrape Website', async () => {
			if (!this.settings.apiKey) {
				new Notice('Please set your Gemini API key in the plugin settings');
				return;
			}
			
			new WebScraperModal(this.app, this.webScraper!).open();
		});

		// Add command for web scraping
		this.addCommand({
			id: 'scrape-website',
			name: 'Scrape Website',
			callback: () => {
				if (!this.settings.apiKey) {
					new Notice('Please set your Gemini API key in the plugin settings');
					return;
				}
				
				new WebScraperModal(this.app, this.webScraper!).open();
			}
		});

		// Add command for summarizing selected text
		this.addCommand({
			id: 'summarize-selection',
			name: 'Summarize Selection',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (!this.settings.apiKey) {
					new Notice('Please set your Gemini API key in the plugin settings');
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
					const newNoteTitle = `${currentTitle} Gemini Summarization`;
					
					new Notice('Generating summary...');
					const summary = await this.summarizer!.summarize(selection);
					
					// Create a new note with the summary
					const folder = currentFile.parent?.path || '';
					const newNotePath = `${folder ? folder + '/' : ''}${newNoteTitle}.md`;
					
					// Create content with a header and the summary
					const content = `# ${newNoteTitle}\n\n*Generated from [${currentTitle}](${currentFile.path}).*\n\n${summary}`;
					
					// Create the new file
					await this.app.vault.create(newNotePath, content);
					
					// Open the new file
					const newFile = this.app.vault.getAbstractFileByPath(newNotePath);
					// Check if it's a TFile (document) and not a folder
					if (newFile && 'basename' in newFile) {
						await this.app.workspace.getLeaf(false).openFile(newFile as TFile);
					}
					
					new Notice('Summary generated and saved to new note');
				} catch (error) {
					console.error('Error generating summary:', error);
					new Notice('Error generating summary. Check console for details.');
				}
			}
		});

		// Add command for smart search
		this.addCommand({
			id: 'smart-search',
			name: 'Smart Search',
			callback: () => {
				if (!this.settings.apiKey) {
					new Notice('Please set your Gemini API key in the plugin settings');
					return;
				}
				
				new SearchModal(this.app, this.searchService!).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new GeminiLinkSettingTab(this.app, this));
	}

	onunload() {
		// Clean up any active highlights
		// Highlighting functionality has been removed
		
		// Clean up other resources if needed
		console.log('Unloading Gemini Link plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Try to load API key from environment if not set in settings
		if (!this.settings.apiKey) {
			const envApiKey = loadApiKeyFromEnvironment();
			if (envApiKey && isValidApiKey(envApiKey)) {
				console.log('Valid API key loaded from environment');
				this.settings.apiKey = envApiKey;
				await this.saveData(this.settings);
				// Also save to localStorage for future use
				saveApiKey(envApiKey);
			} else if (envApiKey) {
				console.warn('Invalid API key format found in environment');
			}
		}
	}

	async saveSettings() {
		// Validate API key before saving
		if (this.settings.apiKey && !isValidApiKey(this.settings.apiKey)) {
			new Notice('Invalid API key format. Please check your API key.');
			return;
		}

		// If API key is valid, also save it to localStorage for future use
		if (this.settings.apiKey) {
			saveApiKey(this.settings.apiKey);
		}

		await this.saveData(this.settings);
		this.initializeServices();
	}

	initializeServices() {
		if (this.settings.apiKey) {
			try {
				// Initialize the Gemini API
				const geminiApi = new GeminiApi(this.settings.apiKey, this.settings);
				
				// Initialize services
				this.webScraper = new WebScraperService(this.settings.apiKey, this.settings);
				this.summarizer = new SummarizerService(this.settings.apiKey, this.settings);
				this.searchService = new SearchService(this.settings.apiKey, this.settings, this.app);
				
				// Highlighting functionality has been removed
				
				console.log('Gemini Link services initialized');
			} catch (error) {
				console.error('Error initializing Gemini services:', error);
				new Notice('Error initializing Gemini services. Check console for details.');
			}
		} else {
			console.log('No API key found, services not initialized');
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

class GeminiLinkSettingTab extends PluginSettingTab {
	plugin: GeminiLinkPlugin;

	constructor(app: App, plugin: GeminiLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Gemini Link Settings' });

		// Add API key setting with validation feedback
		const apiKeyContainer = containerEl.createDiv();
		apiKeyContainer.addClass('gemini-api-key-container');
		
		const apiKeySetting = new Setting(apiKeyContainer)
			.setName('API Key')
			.setDesc('Enter your Gemini API key from Google AI Studio')
			.addText(text => {
				text.inputEl.addClass('gemini-api-key-input');
				text.setPlaceholder('Enter your API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						// Update validation status immediately on change
						const isValid = isValidApiKey(value);
						updateApiKeyValidationStatus(apiKeyContainer, isValid, !!value);
						
						// Update settings
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				return text;
			});
		
		// Add validation status element
		const validationEl = apiKeyContainer.createDiv();
		validationEl.addClass('gemini-api-validation-message');
		validationEl.style.marginTop = '8px';
		validationEl.style.fontSize = '12px';
		
		// Initialize validation status
		const initialApiKey = this.plugin.settings.apiKey;
		updateApiKeyValidationStatus(apiKeyContainer, isValidApiKey(initialApiKey), !!initialApiKey);
		
		// Helper function to update validation status
		function updateApiKeyValidationStatus(container: HTMLElement, isValid: boolean, hasValue: boolean) {
			const validationEl = container.querySelector('.gemini-api-validation-message') as HTMLElement;
			if (!validationEl) return;
			
			validationEl.empty();
			
			if (!hasValue) {
				validationEl.textContent = 'API key is required to use Gemini features';
				validationEl.style.color = 'var(--text-muted)';
			} else if (isValid) {
				validationEl.textContent = '✓ API key format is valid';
				validationEl.style.color = 'var(--text-success)';
			} else {
				validationEl.textContent = '⚠ Invalid API key format';
				validationEl.style.color = 'var(--text-error)';
			}
		}

		// Create a container for model selection
		const modelContainer = containerEl.createDiv();
		modelContainer.addClass('gemini-model-container');
		
		// Add model selection heading
		const modelHeading = modelContainer.createEl('h3', { text: 'Model Selection' });
		modelHeading.style.marginBottom = '8px';
		
		// Add model dropdown with all available models grouped by category
		const modelSetting = new Setting(modelContainer)
			.setName('Model')
			.setDesc('Select the Gemini model to use for AI features')
			.addDropdown(dropdown => {
				// Add model options grouped by category
				for (const category of GEMINI_MODEL_CATEGORIES) {
					// Add category as a group header (non-selectable)
					dropdown.addOption(`--${category.name}--`, `--- ${category.name} ---`);
					
					// Add models in this category
					for (const model of category.models) {
						dropdown.addOption(model.id, model.name);
					}
				}
				
				// Set the current value
				dropdown.setValue(this.plugin.settings.model);
				
				// Handle changes
				dropdown.onChange(async (value: string) => {
					// Skip category headers
					if (value.startsWith('--')) {
						// Reset to previous value
						dropdown.setValue(this.plugin.settings.model);
						return;
					}
					
					// Update model description
					const model = getModelById(value as GeminiModelOption);
					if (model && modelDescEl) {
						modelDescEl.empty();
						modelDescEl.textContent = model.description;
					}
					
					// Update settings
					this.plugin.settings.model = value as GeminiModelOption;
					await this.plugin.saveSettings();
				});
				
				return dropdown;
			});
		
		// Add model description element
		const modelDescEl = modelContainer.createDiv();
		modelDescEl.addClass('gemini-model-description');
		modelDescEl.style.marginTop = '8px';
		modelDescEl.style.marginBottom = '16px';
		modelDescEl.style.fontSize = '12px';
		modelDescEl.style.color = 'var(--text-muted)';
		
		// Set initial model description
		const initialModel = getModelById(this.plugin.settings.model);
		if (initialModel) {
			modelDescEl.textContent = initialModel.description;
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
	}
}
