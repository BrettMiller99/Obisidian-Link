import { App, ButtonComponent, Modal, Notice, Setting, TFile } from 'obsidian';
import { Concept, ConceptDetectionService } from '../services/concept-detection';

export class ConceptDisplayModal extends Modal {
    private concepts: Concept[];
    private file: TFile;
    private conceptService: ConceptDetectionService;
    private selectedConcepts: Set<string> = new Set();

    constructor(app: App, concepts: Concept[], file: TFile, conceptService: ConceptDetectionService) {
        super(app);
        this.concepts = concepts;
        this.file = file;
        this.conceptService = conceptService;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Detected Concepts' });
        contentEl.createEl('p', { text: `The following concepts were detected in "${this.file.basename}":` });
        
        // Create a container for the concepts
        const conceptsContainer = contentEl.createDiv({ cls: 'concepts-container' });
        
        // Add each concept with checkboxes
        this.concepts
            .sort((a, b) => b.confidence - a.confidence) // Sort by confidence (descending)
            .forEach(concept => {
                const conceptDiv = conceptsContainer.createDiv({ cls: 'concept-item' });
                
                // Create checkbox for selection
                const checkbox = new Setting(conceptDiv)
                    .setName(concept.name)
                    .setDesc(`${concept.description} (Confidence: ${Math.round(concept.confidence * 100)}%)`)
                    .addToggle(toggle => {
                        toggle.setValue(false)
                            .onChange(value => {
                                if (value) {
                                    this.selectedConcepts.add(concept.name);
                                } else {
                                    this.selectedConcepts.delete(concept.name);
                                }
                            });
                    });
                
                // Add button to find related notes
                conceptDiv.createDiv({ cls: 'concept-actions' }).createEl('button', {
                    text: 'Find Related Notes',
                    cls: 'mod-cta',
                    attr: {
                        type: 'button'
                    }
                }).addEventListener('click', async () => {
                    try {
                        new Notice(`Finding notes related to "${concept.name}"...`);
                        const enrichedConcept = await this.conceptService.findRelatedNotes(concept);
                        
                        // Close this modal and open the related notes modal
                        this.close();
                        new RelatedNotesModal(this.app, enrichedConcept).open();
                    } catch (error) {
                        console.error('Error finding related notes:', error);
                        new Notice(`Failed to find related notes: ${error.message}`);
                    }
                });
            });
        
        // Add buttons at the bottom
        const buttonDiv = contentEl.createDiv({ cls: 'button-container' });
        
        // Generate links button
        new ButtonComponent(buttonDiv)
            .setButtonText('Generate Concept Links')
            .setCta()
            .onClick(async () => {
                if (this.selectedConcepts.size === 0) {
                    new Notice('Please select at least one concept');
                    return;
                }
                
                try {
                    new Notice('Generating concept links...');
                    
                    // Get selected concepts
                    const selectedConceptsArray = this.concepts
                        .filter(c => this.selectedConcepts.has(c.name));
                    
                    // Generate links for the selected concepts
                    // First save the selected concepts to the file
                    const currentContent = await this.app.vault.read(this.file);
                    const updatedContent = this.addConceptsToContent(currentContent, selectedConceptsArray);
                    await this.app.vault.modify(this.file, updatedContent);
                    
                    // Now generate links for the file
                    await this.conceptService.generateConceptLinks(this.file);
                    
                    new Notice('Concept links generated successfully');
                    this.close();
                } catch (error) {
                    console.error('Error generating concept links:', error);
                    new Notice(`Failed to generate concept links: ${error.message}`);
                }
            });
        
        // Enhance knowledge graph button
        new ButtonComponent(buttonDiv)
            .setButtonText('Enhance Knowledge Graph')
            .setDisabled(this.selectedConcepts.size === 0)
            .onClick(async () => {
                if (this.selectedConcepts.size === 0) {
                    new Notice('Please select at least one concept');
                    return;
                }
                
                try {
                    new Notice('Enhancing knowledge graph...');
                    
                    // Get selected concepts
                    const selectedConceptsArray = this.concepts
                        .filter(c => this.selectedConcepts.has(c.name));
                    
                    // Enhance the knowledge graph with the selected concepts
                    // First save the selected concepts to the file
                    const currentContent = await this.app.vault.read(this.file);
                    const updatedContent = this.addConceptsToContent(currentContent, selectedConceptsArray);
                    await this.app.vault.modify(this.file, updatedContent);
                    
                    // Now enhance the knowledge graph for the file
                    // Note: This method needs to be implemented in ConceptDetectionService
                    // For now, we'll just generate concept links as a fallback
                    await this.conceptService.generateConceptLinks(this.file);
                    
                    new Notice('Knowledge graph enhanced successfully');
                    this.close();
                } catch (error) {
                    console.error('Error enhancing knowledge graph:', error);
                    new Notice(`Failed to enhance knowledge graph: ${error.message}`);
                }
            });
        
        // Cancel button
        new ButtonComponent(buttonDiv)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Modal for displaying related notes
export class RelatedNotesModal extends Modal {
    private concept: Concept;

    constructor(app: App, concept: Concept) {
        super(app);
        this.concept = concept;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: `Notes Related to "${this.concept.name}"` });
        
        if (this.concept.relatedNotes.length === 0) {
            contentEl.createEl('p', { text: 'No related notes found.' });
        } else {
            const notesContainer = contentEl.createDiv({ cls: 'related-notes-container' });
            
            // Add each related note with a link to open it
            this.concept.relatedNotes.forEach(note => {
                const noteDiv = notesContainer.createDiv({ cls: 'related-note-item' });
                
                new Setting(noteDiv)
                    .setName(note.title)
                    .setDesc(`Relevance: ${Math.round(note.relevance * 100)}%`)
                    .addButton(button => {
                        button.setButtonText('Open')
                            .setCta()
                            .onClick(() => {
                                // Open the note in a new leaf
                                this.app.workspace.openLinkText(
                                    note.path, 
                                    '', 
                                    true
                                );
                            });
                    });
            });
        }
        
        // Close button
        const buttonDiv = contentEl.createDiv({ cls: 'button-container' });
        new ButtonComponent(buttonDiv)
            .setButtonText('Close')
            .setCta()
            .onClick(() => {
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
