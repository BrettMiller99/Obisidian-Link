import { App, Modal, Notice, Setting } from 'obsidian';
import { SearchService } from '../services/search';
import { SearchResultsModal } from '../views/search-results-modal';

export class SearchModal extends Modal {
    private query: string = '';

    constructor(
        app: App,
        private searchService: SearchService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Semantic Search' });

        new Setting(contentEl)
            .setName('Search Query')
            .setDesc('Enter your search query')
            .addText(text => text
                .setPlaceholder('Search...')
                .setValue(this.query)
                .onChange(async (value) => {
                    this.query = value;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Search')
                .setCta()
                .onClick(async () => {
                    if (!this.query) {
                        return;
                    }
                    await this.performSearch();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async performSearch() {
        try {
            const results = await this.searchService.search(this.query);
            this.close();
            
            // Open search results in a new modal
            new SearchResultsModal(this.app, results, this.searchService).open();
        } catch (error) {
            console.error('Error performing search:', error);
            new Notice('Failed to perform search. Please try again.');
        }
    }
}
