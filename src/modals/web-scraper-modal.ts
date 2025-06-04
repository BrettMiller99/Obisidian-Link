import { App, Modal, Setting, Notice } from 'obsidian';
import { WebScraperService } from '../services/web-scraper';

export class WebScraperModal extends Modal {
    private url: string = '';

    constructor(
        app: App,
        private webScraper: WebScraperService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Web Scraper' });

        new Setting(contentEl)
            .setName('URL')
            .setDesc('Enter the URL to scrape')
            .addText(text => text
                .setPlaceholder('https://example.com')
                .setValue(this.url)
                .onChange(async (value) => {
                    this.url = value;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Scrape')
                .setCta()
                .onClick(async () => {
                    if (!this.url) {
                        return;
                    }
                    await this.scrapeUrl();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async scrapeUrl() {
        try {
            const content = await this.webScraper.scrapeWebsite(this.url);
            // Create a new note with the scraped content
            const fileName = this.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');
            const filePath = `${fileName}.md`;
            
            await this.app.vault.create(filePath, content);
            this.close();
        } catch (error) {
            console.error('Error scraping URL:', error);
            new Notice('Failed to scrape URL. Please check the URL and try again.');
        }
    }
}
