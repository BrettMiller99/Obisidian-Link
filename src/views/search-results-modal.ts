import { App, Modal, TFile, Notice, Setting } from 'obsidian';
import { SearchService, SearchResult } from '../services/search';

export class SearchResultsModal extends Modal {
    constructor(
        app: App,
        private results: SearchResult[],
        private searchService: SearchService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Search Results' });

        if (this.results.length === 0) {
            contentEl.createEl('p', { text: 'No results found' });
            return;
        }

        this.results.forEach((result, index) => {
            const resultEl = contentEl.createEl('div', { cls: 'search-result' });
            resultEl.createEl('h3', { 
                text: result.file.basename,
                cls: 'search-result-title'
            });
            
            resultEl.createEl('div', {
                text: result.preview,
                cls: 'search-result-preview'
            });
            
            if (result.score !== undefined) {
                resultEl.createEl('div', {
                    text: `Relevance: ${(result.score * 100).toFixed(1)}%`,
                    cls: 'search-result-score'
                });
            }

            resultEl.addEventListener('click', async () => {
                await this.openFile(result.file);
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async openFile(file: TFile) {
        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(file);
    }
}
