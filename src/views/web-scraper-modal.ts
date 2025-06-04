import { App, Modal, Notice, Setting } from 'obsidian';
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
            .addText((text: any) => text
                .setPlaceholder('https://example.com')
                .setValue(this.url)
                .onChange(async (value: string) => {
                    this.url = value;
                }));

        new Setting(contentEl)
            .addButton((btn: any) => {
                btn.setButtonText('Scrape')
                    .setCta()
                    .onClick(async () => {
                        if (!this.url) {
                            new Notice('Please enter a URL');
                            return;
                        }
                        await this.scrapeUrl();
                    });
            });
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
            new Notice(`Scraped content saved to ${filePath}`);
            this.close();
        } catch (error) {
            console.error('Error scraping URL:', error);
            new Notice(`Failed to scrape URL: ${error.message}`);
        }
    }
}
