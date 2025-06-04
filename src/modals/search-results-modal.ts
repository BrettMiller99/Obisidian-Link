import { App, Modal } from 'obsidian';
import { SearchService } from '../services/search';

export class SearchResultsModal extends Modal {
    constructor(
        app: App,
        private results: any[],
        private searchService: SearchService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Search Results' });

        if (this.results.length === 0) {
            contentEl.createEl('p', { text: 'No results found.' });
            return;
        }

        const resultsContainer = contentEl.createDiv('search-results-container');
        
        this.results.forEach((result, index) => {
            const resultEl = resultsContainer.createDiv('search-result-item');
            resultEl.createEl('h3', { text: `Result ${index + 1}` });
            resultEl.createEl('p', { text: result.content });
            
            // Add buttons for actions
            const buttonContainer = resultEl.createDiv('search-result-actions');
            
            buttonContainer.createEl('button', {
                text: 'Open',
                cls: 'mod-cta'
            }).addEventListener('click', () => {
                this.openResult(result);
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async openResult(result: any) {
        // Implement result opening logic based on your data structure
        // For example:
        // - Open the file if it's a file result
        // - Navigate to the specific location
        // - etc.
    }
}
