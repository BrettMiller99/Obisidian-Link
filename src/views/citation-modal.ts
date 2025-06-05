import { App, Modal, Notice, TFile, Setting } from 'obsidian';
import { CitationService, CitationStyle } from '../services/citation';

export class CitationModal extends Modal {
    private url: string = '';
    private citationResult: string = '';

    constructor(
        app: App,
        private citation: CitationService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Generate Citation' });

        new Setting(contentEl)
            .setName('URL or DOI')
            .setDesc('Enter a URL or DOI to generate a citation')
            .addText((text: any) => text
                .setPlaceholder('Enter URL or DOI')
                .setValue(this.url)
                .onChange((value: string) => {
                    this.url = value;
                }));

        new Setting(contentEl)
            .addButton((btn: any) => btn
                .setButtonText('Generate')
                .onClick(async () => {
                    try {
                        // Check if the input is a DOI (simplified check)
                        if (this.url.startsWith('10.') || this.url.includes('doi.org/')) {
                            const doi = this.url.includes('doi.org/') 
                                ? this.url.split('doi.org/')[1] 
                                : this.url;
                            this.citationResult = (await this.citation.generateCitationFromDOI(doi, CitationStyle.APA)).formattedCitation;
                        } else {
                            // Assume it's a URL
                            this.citationResult = (await this.citation.generateCitationFromUrl(this.url, CitationStyle.APA)).formattedCitation;
                        }
                        this.onOpen(); // Refresh the modal to show the result
                    } catch (error) {
                        new Notice('Failed to generate citation. Please check the URL/DOI and try again.');
                        console.error('Citation generation error:', error);
                    }
                }));

        if (this.citationResult) {
            this.renderCitation();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private renderCitation() {
        const { contentEl } = this;
        
        // Clear previous results
        contentEl.findAll('.citation-result').forEach(el => el.remove());
        
        const resultEl = contentEl.createEl('div', { cls: 'citation-result' });
        resultEl.createEl('h3', { text: 'Citation:' });
        resultEl.createEl('pre', {
            text: this.citationResult,
            cls: 'citation-text'
        });

        // Add copy to clipboard button
        new Setting(contentEl)
            .addButton((btn: any) => btn
                .setButtonText('Copy to Clipboard')
                .onClick(() => {
                    navigator.clipboard.writeText(this.citationResult);
                    new Notice('Citation copied to clipboard!');
                }));
    }
}
