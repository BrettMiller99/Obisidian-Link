import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf, ViewState, addIcon, getAllTags, getLinkpath, normalizePath } from 'obsidian';
import { 
	ObsidianLinkSettings, 
	SummaryLevel,
	isValidApiKey, 
	loadApiKeyFromEnvironment, 
	saveApiKey, 
	MODEL_CATEGORIES,
	getModelById,
	getModelCategoriesForVendor,
	getApiKeyForVendor
} from './types';
import { AIVendor } from './utils/ai-providers/base-provider';
import { AIProviderFactory } from './services/ai-provider-factory';
import { GoogleAIProvider } from './providers/google-ai-provider';
import { SummarizerService } from './services/summarizer';
import { SearchService } from './services/search';
import { WebScraperService } from './services/web-scraper';
import { ConceptDetectionService } from './services/concept-detection';
import { MultiModalService } from './services/multi-modal';
import { CitationService } from './services/citation';

// Import SummaryView and its type
import { SummaryView, SUMMARY_VIEW_TYPE } from './views/summary-view';

// Type declarations are now handled by the TypeScript configuration

const DEFAULT_SETTINGS: ObsidianLinkSettings = {
	// General settings
	vendor: AIVendor.GOOGLE, // Default to Google's Gemini
	model: 'gemini-2.0-flash', // Modern default model
	maxTokens: 1024,
	temperature: 0.7,
	
	// Vendor-specific API keys
	geminiApiKey: '',
	openaiApiKey: '',
	anthropicApiKey: ''
}

export default class ObsidianLinkPlugin extends Plugin {
	settings: ObsidianLinkSettings;
	summarizer: SummarizerService | null = null;
	
	// Plugin methods (loadSettings, saveSettings, loadData, saveData) are inherited from the base Plugin class
	searchService: SearchService | null = null;
	webScraper: WebScraperService | null = null;
	conceptDetection: ConceptDetectionService | null = null;
	multiModal: MultiModalService | null = null;
	citation: CitationService | null = null;
	statusBarItemEl: HTMLElement | null = null;



	formatSummaryForReadability(summary: string): string {
		// Remove any title-like content from the beginning
		// This helps avoid duplicate titles since Obsidian already shows the filename as title
		const titlePattern = /^#\s.*\n+|^.*\n[=-]+\n+/;
		summary = summary.replace(titlePattern, '');
		
		// Split into paragraphs and filter out empty ones
		const paragraphs = summary.split('\n\n').filter(p => p.trim().length > 0);
		
		// Format each paragraph
		const formattedParagraphs = paragraphs.map(paragraph => {
			// Remove any title-like content at the start of paragraphs
			const lines = paragraph.split('\n');
			const formattedLines = lines.map(line => {
				// Remove markdown title markers
				return line.replace(/^#+\s+/, '');
			});
			return formattedLines.join('\n');
		});
		
		// Join paragraphs with double line breaks
		return formattedParagraphs.join('\n\n');
	}
	
	// Register the summary view type
	registerView(
		type: string,
		callback: (leaf: WorkspaceLeaf) => SummaryView
	) {
		super.registerView(type, callback);
	}

	// Helper method to ensure the summary view is open
	ensureSummaryViewOpen(): WorkspaceLeaf | null {
		if (!this.summarizer) {
			new Notice('Summarizer service is not available. Please check your API key and settings.');
			console.error('Cannot open summary view: Summarizer service is not initialized');
			return null;
		}

		const { workspace } = this.app;
		try {
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
		} catch (error) {
			console.error('Error in ensureSummaryViewOpen:', error);
			new Notice('Failed to open summary view. Please check the console for details.');
			return null;
		}
	}
	
	async onload() {
		try {
			// Load settings first
			await this.loadSettings();

			// Initialize services
			const initialized = await this.initializeServices();
			if (!initialized) {
				console.warn('AI services failed to initialize. Some features may not be available.');
				new Notice('Failed to initialize AI services. Please check your API key and settings.');
			}

			// Register summary view only if summarizer is available
			if (this.summarizer) {
				this.registerView(
					SUMMARY_VIEW_TYPE,
					(leaf) => new SummaryView(leaf, this.settings, this.summarizer!)
				);

				// Register context menu item for files
				this.registerEvent(
					this.app.workspace.on('file-menu', (menu, file: TFile) => {
						if (file.extension === 'md') {
							menu.addItem((item) => {
								item
									.setTitle('Summarize Note With AI')
									.setIcon('file-text')
									.onClick(async () => {
										try {
											const content = await this.app.vault.read(file);
											
											// Ensure summary view is open
											const leaf = this.ensureSummaryViewOpen();
											if (!leaf) return;

											// Get the summary view instance
											const viewInstance = leaf.view;
											if (viewInstance instanceof SummaryView) {
												// Use the public API to set content and generate summary
												viewInstance.setContent(content);
												viewInstance.setFile(file);
												await viewInstance.generateSummary(content, file);
											}

											// Activate the summary view
											this.app.workspace.setActiveLeaf(leaf, { focus: true });
										} catch (error) {
											console.error('Error generating summary:', error);
											new Notice('Failed to generate summary. Please try again.');
										}
									});
							});
						}
					})
				);

				// Add ribbon icon for summary view
				this.addRibbonIcon('list-plus', 'Open Summary View', () => {
					this.ensureSummaryViewOpen();
				});
			} else {
				console.warn('Summarizer service not available. Summary view will not be registered.');
			}
			
			// We've removed the automatic highlighting on file-open
			// This was causing yellow bars to appear when opening files in new tabs
			// Highlighting is now only applied when explicitly requested from search results

			// Add command for summarizing current document
			this.addCommand({
				id: 'summarize-current-document',
				name: 'Summarize Current Document',
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					if (!this.summarizer) {
						new Notice('Summarizer service not initialized. Please check your API key and settings.');
						return;
					}

					const file = view.file;
					if (!file) {
						new Notice('No file associated with the current view');
						return;
					}

					try {
						const content = await this.app.vault.read(file);
						
						// Ensure summary view is open
						const leaf = this.ensureSummaryViewOpen();
						if (!leaf) return;

						// Get the summary view instance and trigger summary generation
						const viewInstance = leaf.view;
						if (viewInstance instanceof SummaryView) {
							// Use the public API to set content and generate summary
							await viewInstance.generateSummary(content, file);
						}

						// Activate the summary view
						this.app.workspace.setActiveLeaf(leaf, { focus: true });
					} catch (error) {
						console.error('Error generating summary:', error);
						new Notice('Failed to generate summary. Please try again.');
					}
				}
			});

			// Add commands
			this.addCommand({
				id: 'scrape-website',
				name: 'Scrape Website',
				callback: async () => {
					if (!this.webScraper) {
						new Notice('Web scraper service not initialized. Please check your API key.');
						return;
					}
					try {
						const { WebScraperModal } = await import('./views/web-scraper-modal');
						new WebScraperModal(this.app, this.webScraper).open();
					} catch (error) {
						console.error('Failed to load web scraper modal:', error);
						new Notice('Web scraper feature not available');
					}
				}
			});

			this.addCommand({
				id: 'semantic-search',
				name: 'Semantic Search',
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					if (!this.searchService) {
						new Notice('Search service not initialized. Please check your API key.');
						return;
					}
					
					const selection = editor.getSelection();
					if (!selection) {
						new Notice('No text selected');
						return;
					}
					
					try {
						new Notice('Searching...');
						const results = await this.searchService.search(selection);
						
						if (results.length === 0) {
							new Notice('No relevant results found');
							return;
						}
						
						try {
							const { SearchResultsModal } = await import('./views/search-results-modal');
							new SearchResultsModal(this.app, results, this.searchService).open();
						} catch (error) {
							console.error('Failed to load search results modal:', error);
							new Notice('Search results feature not available');
						}
					} catch (error: unknown) {
						console.error('Error performing search:', error);
						new Notice('Failed to perform search. Please try again.');
					}
				}
			});

			this.addCommand({
				id: 'detect-concepts',
				name: 'Detect Concepts in Current Note',
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					if (!this.conceptDetection) {
						new Notice('Concept detection service not initialized. Please check your API key.');
						return;
					}

					const currentFile = view.file;
					if (!currentFile) {
						new Notice('Cannot determine current file');
						return;
					}
					
					try {
						new Notice('Detecting concepts...');
						const concepts = await this.conceptDetection.extractConcepts(currentFile);
						
						if (concepts.length === 0) {
							new Notice('No significant concepts detected');
							return;
						}
						
						try {
							const { ConceptDisplayModal } = await import('./modals/concept-display-modal');
							new ConceptDisplayModal(this.app, concepts, currentFile, this.conceptDetection).open();
						} catch (error) {
							console.error('Failed to load concept display modal:', error);
							new Notice('Concept display feature not available');
						}
					} catch (error: unknown) {
						console.error('Error detecting concepts:', error);
						new Notice('Failed to detect concepts. Please try again.');
					}
				}
			});
			
			this.addCommand({
				id: 'analyze-image',
				name: 'Analyze Selected Image',
				callback: async () => {
					if (!this.multiModal) {
						new Notice('Multi-modal service not initialized. Please check your API key.');
						return;
					}
					try {
						const { ImageAnalysisModal } = await import('./views/image-analysis-modal');
						new ImageAnalysisModal(this.app, this.multiModal).open();
					} catch (error) {
						console.error('Failed to load image analysis modal:', error);
						new Notice('Image analysis feature not available');
					}
				}
			});
			
			this.addCommand({
				id: 'generate-citation',
				name: 'Generate Citation from URL/DOI',
				callback: async () => {
					if (!this.citation) {
						new Notice('Citation service not initialized. Please check your API key.');
						return;
					}
					try {
						const { CitationModal } = await import('./modals/citation-modal');
						new CitationModal(this.app, this.citation).open();
					} catch (error) {
						console.error('Failed to load citation modal:', error);
						new Notice('Citation generation feature not available');
					}
				}
			});
			
			this.addCommand({
				id: 'scan-for-citations',
				name: 'Scan Selected Text for Citations',
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					if (!this.citation) {
						new Notice('Citation service not initialized. Please check your API key.');
						return;
					}

					const selection = editor.getSelection();
					if (!selection) {
						new Notice('No text selected');
						return;
					}
					
					try {
						new Notice('Scanning for citations...');
						const citations = await this.citation.scanTextForCitations(selection);
						
						// Convert Citation[] to CitationCandidate[]
						const citationCandidates = citations.map((citation, index) => ({
							id: `citation-${index}-${Date.now()}`,
							title: citation.metadata.title || 'Untitled',
							authors: citation.metadata.authors || [],
							year: citation.metadata.date ? parseInt(citation.metadata.date.substring(0, 4)) : undefined,
							source: citation.metadata.journal || citation.metadata.publisher
						}));

						if (citationCandidates.length === 0) {
							new Notice('No citations found in selected text');
							return;
						}
						
						try {
							const { CitationCandidatesModal } = await import('./modals/citation-candidates-modal');
							new CitationCandidatesModal(this.app, citationCandidates, this.citation).open();
						} catch (error) {
							console.error('Failed to load citation candidates modal:', error);
							new Notice('Citation scanning feature not available');
						}
					} catch (error: unknown) {
						console.error('Error scanning for citations:', error);
						new Notice('Failed to scan for citations. Please try again.');
					}
				}
			});
			
			// Add settings tab
			this.addSettingTab(new ObsidianLinkSettingTab(this.app, this));
			
			// Add status bar item
			this.statusBarItemEl = this.addStatusBarItem();
			
			// Set initial status
			const vendor = this.settings.vendor;
			const model = this.settings.model;
			this.statusBarItemEl.setText(`${vendor} - ${model}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('Error initializing Obsidian Link plugin:', error);
			new Notice(`Failed to initialize Obsidian Link: ${errorMessage}`);
		}
	}

	onunload() {
		console.log('Unloading Gemini Link plugin');
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
		try {
			// Get the appropriate API key for the selected vendor
			const apiKey = getApiKeyForVendor(this.settings, this.settings.vendor);
			
			if (!apiKey) {
				console.log(`No API key available for ${this.settings.vendor}. AI services not initialized.`);
				new Notice(`Please set your ${this.settings.vendor} API key in the plugin settings.`);
				return false;
			}

			// Get AI provider from factory with rate limiting
			const aiProvider = AIProviderFactory.getInstance().getProvider(
				this.settings.vendor.toLowerCase(),
				apiKey,
				this.settings.model
			);

			// Initialize services with rate-limited AI provider
			this.summarizer = new SummarizerService(aiProvider);
			this.multiModal = new MultiModalService(this.app, this.settings);
			this.citation = new CitationService(this.settings);
			this.searchService = new SearchService(this.settings, this.app);
			this.webScraper = new WebScraperService(this.settings);
			this.conceptDetection = new ConceptDetectionService(this.app, this.settings);
			
			console.log(`AI services initialized successfully with ${this.settings.vendor} provider`);
			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Error initializing AI services with ${this.settings.vendor} provider:`, error);
			new Notice(`Error initializing AI services: ${errorMessage}`);
			
			// Clear services on error
			this.summarizer = null;
			this.multiModal = null;
			this.citation = null;
			this.searchService = null;
			this.webScraper = null;
			this.conceptDetection = null;
			
			return false;
		}
	}
}

interface SearchResult {
    file: TFile;
    preview: string;
    path: string;
    score?: number;
    explanation?: string;
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

		// Create a container for model selection
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
						dropdown.addOption(model.id, model.name);
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
				
				return dropdown;
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
