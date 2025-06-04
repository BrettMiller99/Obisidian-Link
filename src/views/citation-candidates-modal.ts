import { App, Modal, Notice, Setting } from 'obsidian';
import { CitationService, CitationMetadata } from '../services/citation';

interface CitationCandidate {
    title: string;
    authors?: string[];
    year?: string;
    doi?: string;
    url?: string;
    abstract?: string;
}

export class CitationCandidatesModal extends Modal {
    constructor(
        app: App,
        private candidates: CitationCandidate[],
        private citation: CitationService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Citation Candidates' });

        if (this.candidates.length === 0) {
            contentEl.createEl('p', { text: 'No citation candidates found' });
            return;
        }

        this.candidates.forEach(candidate => {
            const candidateEl = contentEl.createEl('div', { 
                cls: 'citation-candidate' 
            });

            candidateEl.createEl('h3', { 
                text: candidate.title || 'Untitled',
                cls: 'citation-title'
            });

            if (candidate.authors?.length) {
                candidateEl.createEl('div', {
                    text: `By ${candidate.authors.join(', ')}`,
                    cls: 'citation-authors'
                });
            }

            if (candidate.abstract) {
                candidateEl.createEl('p', {
                    text: candidate.abstract,
                    cls: 'citation-abstract'
                });
            }

            if (candidate.url) {
                candidateEl.createEl('a', {
                    text: 'Source',
                    href: candidate.url,
                    cls: 'external-link',
                    attr: { target: '_blank' }
                });
            }

            new Setting(candidateEl)
                .addButton(btn => btn
                    .setButtonText('Insert Citation')
                    .setCta()
                    .onClick(() => this.insertCitation(candidate)));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async insertCitation(candidate: CitationCandidate) {
        try {
            const metadata: CitationMetadata = {
                title: candidate.title,
                authors: candidate.authors,
                doi: candidate.doi,
                url: candidate.url,
                abstract: candidate.abstract,
                // Add any other relevant metadata fields
            };
            
            const citation = await this.citation.generateCitationFromMetadata(metadata);
            // In a real implementation, you would insert the citation at the cursor position
            // This is a simplified example
            console.log('Generated citation:', citation);
            new Notice('Citation inserted');
            this.close();
        } catch (error) {
            console.error('Error generating citation:', error);
            new Notice('Failed to generate citation. Please try again.');
        }
    }
}
