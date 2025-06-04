import { App, Modal, Notice, TFile, Setting } from 'obsidian';
import { ConceptDetectionService, DetectedConcept } from '../services/concept-detection';

export class ConceptDisplayModal extends Modal {
    constructor(
        app: App,
        private concepts: DetectedConcept[],
        private currentFile: TFile | null,
        private conceptDetection: ConceptDetectionService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Detected Concepts' });

        if (this.concepts.length === 0) {
            contentEl.createEl('p', { text: 'No concepts detected in the current document' });
            return;
        }

        const conceptsList = contentEl.createEl('ul', { cls: 'concepts-list' });
        
        this.concepts.forEach(concept => {
            const conceptItem = conceptsList.createEl('li');
            conceptItem.createEl('span', { 
                text: concept.name,
                cls: 'concept-name'
            });

            if (concept.definition) {
                conceptItem.createEl('p', {
                    text: concept.definition,
                    cls: 'concept-definition'
                });
            }

            if (concept.relatedConcepts?.length) {
                const relatedEl = conceptItem.createEl('div', { 
                    cls: 'related-concepts' 
                });
                relatedEl.createEl('span', { 
                    text: 'Related: ',
                    cls: 'related-label'
                });
                
                concept.relatedConcepts.forEach((related, index) => {
                    const sep = index > 0 ? ', ' : '';
                    relatedEl.appendText(sep + related);
                });
            }

            // Add button to insert concept link
            new Setting(conceptItem)
                .addButton((btn: any) => btn
                    .setButtonText('Insert Link')
                    .onClick(() => this.insertConceptLink(concept)));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async insertConceptLink(concept: DetectedConcept) {
        if (!this.currentFile) {
            new Notice('No active document to insert link into');
            return;
        }

        try {
            // Create a link to the concept in the current file
            const fileContent = await this.app.vault.read(this.currentFile);
            const cursor = this.app.workspace.activeEditor?.editor?.getCursor();
            const link = `[[${concept.name}]]`;
            
            if (cursor) {
                // Insert at cursor position
                this.app.workspace.activeEditor?.editor?.replaceRange(link, cursor);
            } else {
                // Append to the end of the file
                const newContent = fileContent + '\n' + link;
                await this.app.vault.modify(this.currentFile, newContent);
            }
            
            new Notice(`Added link to concept: ${concept.name}`);
            this.close();
        } catch (error) {
            console.error('Error inserting concept link:', error);
            new Notice('Failed to insert concept link. Please try again.');
        }
    }
}
