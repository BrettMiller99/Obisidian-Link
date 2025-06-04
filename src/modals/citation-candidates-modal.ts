import { App, Modal, TFile, Notice, MarkdownView } from 'obsidian';
import { CitationService, CitationStyle } from '../services/citation';

interface CitationCandidate {
    id: string;
    title: string;
    authors: string[];
    year?: number;
    source?: string;
}

export class CitationCandidatesModal extends Modal {
    constructor(
        app: App,
        private candidates: CitationCandidate[],
        private citationService: CitationService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Citation Candidates' });

        if (this.candidates.length === 0) {
            contentEl.createEl('p', { text: 'No citation candidates found.' });
            return;
        }

        const container = contentEl.createDiv('citation-candidates-container');
        
        this.candidates.forEach((candidate, index) => {
            const candidateEl = container.createDiv('citation-candidate');
            
            // Display citation information
            const titleEl = candidateEl.createEl('h3', { 
                text: candidate.title || 'Untitled',
                cls: 'citation-title'
            });
            
            if (candidate.authors && candidate.authors.length > 0) {
                candidateEl.createEl('div', {
                    text: `By: ${candidate.authors.join(', ')}`,
                    cls: 'citation-authors'
                });
            }
            
            if (candidate.year) {
                candidateEl.createEl('div', {
                    text: `Year: ${candidate.year}`,
                    cls: 'citation-year'
                });
            }
            
            if (candidate.source) {
                candidateEl.createEl('div', {
                    text: `Source: ${candidate.source}`,
                    cls: 'citation-source'
                });
            }
            
            // Add action buttons
            const buttonContainer = candidateEl.createDiv('citation-actions');
            
            buttonContainer.createEl('button', {
                text: 'Insert Citation',
                cls: 'mod-cta'
            }).addEventListener('click', () => {
                this.insertCitation(candidate);
            });
            
            buttonContainer.createEl('button', {
                text: 'Create Note',
                cls: 'mod-primary'
            }).addEventListener('click', () => {
                this.createCitationNote(candidate);
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async insertCitation(candidate: CitationCandidate) {
        try {
            const citation = await this.citationService.formatCitation(candidate, CitationStyle.APA);
            // Insert the formatted citation at the cursor position
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                const cursor = editor.getCursor();
                editor.replaceRange(`[${citation}]`, cursor);
                this.close();
            }
        } catch (error) {
            console.error('Error inserting citation:', error);
            new Notice('Failed to insert citation. Please try again.');
        }
    }

    private async createCitationNote(candidate: CitationCandidate) {
        try {
            const fileName = `citations/${candidate.id.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
            
            // Create citations folder if it doesn't exist
            const citationsFolder = this.app.vault.getAbstractFileByPath('citations');
            if (!citationsFolder) {
                await this.app.vault.createFolder('citations');
            }
            
            // Format the citation in different styles
            const apa = await this.citationService.formatCitation(candidate, CitationStyle.APA);
            const mla = await this.citationService.formatCitation(candidate, CitationStyle.MLA);
            const chicago = await this.citationService.formatCitation(candidate, CitationStyle.CHICAGO);
            
            // Create the note content
            const content = [
                `# ${candidate.title || 'Untitled Citation'}`,
                '',
                '## Metadata',
                ...(candidate.authors?.length ? [`- **Authors:** ${candidate.authors.join(', ')}`] : []),
                ...(candidate.year ? [`- **Year:** ${candidate.year}`] : []),
                ...(candidate.source ? [`- **Source:** ${candidate.source}`] : []),
                '',
                '## Citation Formats',
                '### APA',
                apa,
                '',
                '### MLA',
                mla,
                '',
                '### Chicago',
                chicago,
                '',
                '## Notes',
                'Add your notes here...'
            ].filter(Boolean).join('\n');
            
            await this.app.vault.create(fileName, content);
            this.close();
        } catch (error) {
            console.error('Error creating citation note:', error);
            new Notice('Failed to create citation note. Please try again.');
        }
    }
}
