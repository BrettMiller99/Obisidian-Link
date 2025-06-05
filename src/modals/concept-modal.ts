import { App, Modal, TFile, Notice } from 'obsidian';
import { ConceptDetectionService } from '../services/concept-detection';

interface Concept {
    name: string;
    description: string;
    confidence: number;
}

export class ConceptDisplayModal extends Modal {
    constructor(
        app: App,
        private concepts: Concept[],
        private sourceFile: TFile,
        private conceptDetection: ConceptDetectionService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Detected Concepts' });
        contentEl.createEl('p', { text: `Source: ${this.sourceFile.basename}` });

        const conceptsContainer = contentEl.createDiv('concepts-container');
        
        this.concepts.forEach(concept => {
            const conceptEl = conceptsContainer.createDiv('concept-item');
            conceptEl.createEl('h3', { text: concept.name });
            conceptEl.createEl('p', { text: concept.description });
            conceptEl.createEl('small', { text: `Confidence: ${(concept.confidence * 100).toFixed(1)}%` });
            
            // Add buttons for actions
            const buttonContainer = conceptEl.createDiv('concept-actions');
            
            buttonContainer.createEl('button', {
                text: 'Create Note',
                cls: 'mod-cta'
            }).addEventListener('click', () => {
                this.createConceptNote(concept);
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async createConceptNote(concept: Concept) {
        try {
            const fileName = concept.name.replace(/[^a-zA-Z0-9]/g, '-');
            const filePath = `concepts/${fileName}.md`;
            
            // Create concepts folder if it doesn't exist
            const conceptsFolder = this.app.vault.getAbstractFileByPath('concepts');
            if (!conceptsFolder) {
                await this.app.vault.createFolder('concepts');
            }
            
            // Create the note content
            const content = [
                `# ${concept.name}`,
                '',
                concept.description,
                '',
                '## References',
                `- First identified in [[${this.sourceFile.basename}]]`,
                '',
                '## Related Concepts',
                '- (Add related concepts here)',
            ].join('\n');
            
            await this.app.vault.create(filePath, content);
            this.close();
        } catch (error) {
            console.error('Error creating concept note:', error);
            new Notice('Failed to create concept note. Please try again.');
        }
    }
}
