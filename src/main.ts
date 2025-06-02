import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WebScraperService } from './services/web-scraper';
import { SummarizerService } from './services/summarizer';
import { SearchService } from './services/search';

interface GeminiLinkSettings {
	apiKey: string;
	model: string;
	maxTokens: number;
	temperature: number;
}

const DEFAULT_SETTINGS: GeminiLinkSettings = {
	apiKey: '',
	model: 'gemini-pro',
	maxTokens: 1024,
	temperature: 0.7
}

export default class GeminiLinkPlugin extends Plugin {
	settings: GeminiLinkSettings;
	genAI: GoogleGenerativeAI | null = null;
	webScraper: WebScraperService | null = null;
	summarizer: SummarizerService | null = null;
	searchService: SearchService | null = null;

	async onload() {
		await this.loadSettings();
		
		// Initialize services if API key is available
		this.initializeServices();

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
					new Notice('Generating summary...');
					const summary = await this.summarizer!.summarize(selection);
					editor.replaceSelection(summary);
					new Notice('Summary generated successfully');
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
		// Clean up resources if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.initializeServices();
	}

	initializeServices() {
		if (this.settings.apiKey) {
			try {
				this.genAI = new GoogleGenerativeAI(this.settings.apiKey);
				this.webScraper = new WebScraperService(this.genAI, this.settings);
				this.summarizer = new SummarizerService(this.genAI, this.settings);
				this.searchService = new SearchService(this.genAI, this.settings, this.app);
			} catch (error) {
				console.error('Error initializing Gemini services:', error);
				new Notice('Error initializing Gemini services. Check console for details.');
			}
		}
	}
}

class WebScraperModal extends Modal {
	webScraper: WebScraperService;
	urlInputEl: HTMLInputElement;
	
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
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '0.5rem';
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		
		const scrapeButton = buttonContainer.createEl('button', { text: 'Scrape' });
		scrapeButton.classList.add('mod-cta');
		scrapeButton.addEventListener('click', async () => {
			const url = this.urlInputEl.value.trim();
			
			if (!url) {
				new Notice('Please enter a valid URL');
				return;
			}
			
			try {
				new Notice('Scraping website...');
				this.close();
				
				const content = await this.webScraper.scrapeWebsite(url);
				
				// Create a new note with the scraped content
				const fileName = `Scraped - ${new URL(url).hostname} - ${new Date().toISOString().split('T')[0]}`;
				const newFile = await this.app.vault.create(
					`${fileName}.md`,
					`# ${fileName}\n\nSource: [${url}](${url})\n\n${content}`
				);
				
				// Open the new note
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(newFile);
				
				new Notice('Website scraped successfully');
			} catch (error) {
				console.error('Error scraping website:', error);
				new Notice('Error scraping website. Check console for details.');
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SearchModal extends Modal {
	searchService: SearchService;
	queryInputEl: HTMLInputElement;
	resultsContainerEl: HTMLElement;
	
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
		
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '0.5rem';
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		
		const searchButton = buttonContainer.createEl('button', { text: 'Search' });
		searchButton.classList.add('mod-cta');
		searchButton.addEventListener('click', async () => {
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
						if (file) {
							this.close();
							await this.app.workspace.getLeaf().openFile(file);
						}
					});
					
					listItem.createEl('p', { 
						text: result.excerpt,
						cls: 'search-result-excerpt'
					});
				}
			} catch (error) {
				console.error('Error performing search:', error);
				new Notice('Error performing search. Check console for details.');
			}
		});
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

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Enter your Gemini API key from Google AI Studio')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Select the Gemini model to use')
			.addDropdown(dropdown => dropdown
				.addOption('gemini-pro', 'Gemini Pro')
				.addOption('gemini-pro-vision', 'Gemini Pro Vision')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

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
