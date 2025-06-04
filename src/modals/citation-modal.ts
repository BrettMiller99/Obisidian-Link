import { App, ButtonComponent, DropdownComponent, MarkdownView, Modal, Notice, Setting } from 'obsidian';
import { Citation, CitationMetadata, CitationService, CitationStyle } from '../services/citation';

export class CitationModal extends Modal {
    private citationService: CitationService;
    private urlInput: string = '';
    private doiInput: string = '';
    private selectedStyle: CitationStyle = CitationStyle.APA;
    private citationResult: Citation | null = null;
    private inputMode: 'url' | 'doi' | 'manual' = 'url';
    private manualMetadata: CitationMetadata = {
        title: '',
        authors: [],
        date: '',
        publisher: '',
        url: '',
        accessDate: new Date().toISOString().split('T')[0]
    };

    constructor(app: App, citationService: CitationService) {
        super(app);
        this.citationService = citationService;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Generate Citation' });
        
        // Input mode toggle
        const inputToggle = contentEl.createDiv({ cls: 'input-mode-toggle' });
        
        const urlButton = inputToggle.createEl('button', { 
            text: 'URL',
            cls: this.inputMode === 'url' ? 'active' : ''
        });
        
        const doiButton = inputToggle.createEl('button', { 
            text: 'DOI',
            cls: this.inputMode === 'doi' ? 'active' : ''
        });
        
        const manualButton = inputToggle.createEl('button', { 
            text: 'Manual Entry',
            cls: this.inputMode === 'manual' ? 'active' : ''
        });
        
        urlButton.addEventListener('click', () => {
            this.inputMode = 'url';
            this.updateInputModeUI(urlButton, doiButton, manualButton);
        });
        
        doiButton.addEventListener('click', () => {
            this.inputMode = 'doi';
            this.updateInputModeUI(urlButton, doiButton, manualButton);
        });
        
        manualButton.addEventListener('click', () => {
            this.inputMode = 'manual';
            this.updateInputModeUI(urlButton, doiButton, manualButton);
        });
        
        // Input containers
        const urlContainer = contentEl.createDiv({ cls: 'input-container url-container' });
        const doiContainer = contentEl.createDiv({ cls: 'input-container doi-container' });
        const manualContainer = contentEl.createDiv({ cls: 'input-container manual-container' });
        
        // Style selection (common to all modes)
        const styleContainer = contentEl.createDiv({ cls: 'style-container' });
        styleContainer.createEl('h3', { text: 'Citation Style' });
        
        const styleDropdown = new DropdownComponent(styleContainer);
        
        // Add style options
        styleDropdown.addOption(CitationStyle.APA, 'APA (7th Edition)');
        styleDropdown.addOption(CitationStyle.MLA, 'MLA (9th Edition)');
        styleDropdown.addOption(CitationStyle.CHICAGO, 'Chicago (17th Edition)');
        styleDropdown.addOption(CitationStyle.HARVARD, 'Harvard');
        styleDropdown.addOption(CitationStyle.IEEE, 'IEEE');
        styleDropdown.addOption(CitationStyle.VANCOUVER, 'Vancouver');
        
        styleDropdown.setValue(this.selectedStyle);
        styleDropdown.onChange(value => {
            this.selectedStyle = value as CitationStyle;
        });
        
        // URL input
        urlContainer.createEl('h3', { text: 'Enter URL' });
        
        new Setting(urlContainer)
            .setName('URL')
            .setDesc('Enter the full URL of the webpage')
            .addText(text => {
                text.setValue(this.urlInput)
                    .onChange(value => {
                        this.urlInput = value;
                    });
            });
        
        // DOI input
        doiContainer.createEl('h3', { text: 'Enter DOI' });
        
        new Setting(doiContainer)
            .setName('DOI')
            .setDesc('Enter the DOI identifier (e.g., 10.1000/xyz123)')
            .addText(text => {
                text.setValue(this.doiInput)
                    .onChange(value => {
                        this.doiInput = value;
                    });
            });
        
        // Manual metadata input
        manualContainer.createEl('h3', { text: 'Enter Citation Metadata' });
        
        new Setting(manualContainer)
            .setName('Title')
            .addText(text => {
                text.setValue(this.manualMetadata.title ?? '')
                    .onChange(value => {
                        this.manualMetadata.title = value;
                    });
            });
            
        new Setting(manualContainer)
            .setName('Authors (comma separated)')
            .addText(text => {
                text.setValue(this.manualMetadata.authors ? this.manualMetadata.authors.join(', ') : '')
                    .onChange(value => {
                        this.manualMetadata.authors = value.split(',').map(a => a.trim()).filter(a => a);
                    });
            });
            
        new Setting(manualContainer)
            .setName('Date (YYYY-MM-DD)')
            .addText(text => {
                text.setValue(this.manualMetadata.date ?? '')
                    .onChange(value => {
                        this.manualMetadata.date = value;
                    });
            });
            
        new Setting(manualContainer)
            .setName('Publisher')
            .addText(text => {
                text.setValue(this.manualMetadata.publisher ?? '')
                    .onChange(value => {
                        this.manualMetadata.publisher = value;
                    });
            });
            
        new Setting(manualContainer)
            .setName('URL (optional)')
            .addText(text => {
                text.setValue(this.manualMetadata.url ?? '')
                    .onChange(value => {
                        this.manualMetadata.url = value;
                    });
            });
        
        // Citation result container
        const resultContainer = contentEl.createDiv({ cls: 'citation-result-container' });
        resultContainer.style.display = 'none';
        
        resultContainer.createEl('h3', { text: 'Generated Citation' });
        
        const citationEl = resultContainer.createDiv({ cls: 'citation-text' });
        
        // Generate button
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        
        const generateButton = new ButtonComponent(buttonContainer)
            .setButtonText('Generate')
            .setCta()
            .onClick(async () => {
                try {
                    let citation: Citation;
                    
                    switch (this.inputMode) {
                        case 'url':
                            if (!this.urlInput) {
                                new Notice('Please enter a URL');
                                return;
                            }
                            citation = await this.citationService.generateCitationFromUrl(this.urlInput || '', this.selectedStyle);
                            break;
                            
                        case 'doi':
                            if (!this.doiInput) {
                                new Notice('Please enter a DOI');
                                return;
                            }
                            citation = await this.citationService.generateCitationFromDOI(this.doiInput || '', this.selectedStyle);
                            break;
                            
                        case 'manual':
                            if (!this.manualMetadata.title || !this.manualMetadata.authors || this.manualMetadata.authors.length === 0) {
                                new Notice('Title and authors are required');
                                return;
                            }
                            citation = await this.citationService.generateCitationFromMetadata(this.manualMetadata, this.selectedStyle);
                            break;
                            
                        default:
                            throw new Error('Invalid input mode');
                    }
                    
                    // Display the citation
                    this.citationResult = citation;
                    citationEl.empty();
                    citationEl.createEl('p', { text: citation.formattedCitation });
                    
                    // Show the result container
                    resultContainer.style.display = 'block';
                    
                    // Enable buttons
                    copyButton.setDisabled(false);
                    insertButton.setDisabled(false);
                    
                } catch (error) {
                    console.error('Error generating citation:', error);
                    new Notice(`Failed to generate citation: ${error.message}`);
                }
            });
        
        // Copy button
        const copyButton = new ButtonComponent(buttonContainer)
            .setButtonText('Copy')
            .setDisabled(true)
            .onClick(() => {
                if (this.citationResult) {
                    navigator.clipboard.writeText(this.citationResult.formattedCitation);
                    new Notice('Citation copied to clipboard');
                }
            });
        
        // Insert button
        const insertButton = new ButtonComponent(buttonContainer)
            .setButtonText('Insert into Note')
            .setDisabled(true)
            .onClick(() => {
                if (this.citationResult) {
                    this.insertCitationIntoNote(this.citationResult);
                }
            });
        
        // Close button
        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
        
        // Set up a watcher for the citation result
        const updateButtonState = () => {
            if (this.citationResult) {
                copyButton.setDisabled(false);
                insertButton.setDisabled(false);
            }
        };
        
        // Set initial input mode UI
        this.updateInputModeUI(urlButton, doiButton, manualButton);
    }
    
    // Helper method to update input mode UI
    private updateInputModeUI(urlButton: HTMLElement, doiButton: HTMLElement, manualButton: HTMLElement) {
        const { contentEl } = this;
        
        // Update button styles
        urlButton.className = this.inputMode === 'url' ? 'active' : '';
        doiButton.className = this.inputMode === 'doi' ? 'active' : '';
        manualButton.className = this.inputMode === 'manual' ? 'active' : '';
        
        // Show/hide input containers
        const urlContainer = contentEl.querySelector<HTMLElement>('.url-container');
        const doiContainer = contentEl.querySelector<HTMLElement>('.doi-container');
        const manualContainer = contentEl.querySelector<HTMLElement>('.manual-container');
        
        if (urlContainer) urlContainer.style.display = this.inputMode === 'url' ? 'block' : 'none';
        if (doiContainer) doiContainer.style.display = this.inputMode === 'doi' ? 'block' : 'none';
        if (manualContainer) manualContainer.style.display = this.inputMode === 'manual' ? 'block' : 'none';
    }
    
    // Insert citation into active note
    private insertCitationIntoNote(citation: Citation) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }
        
        // Safe cast to access editor
        const editor = (activeView as any).editor;
        if (!editor) {
            new Notice('Cannot access editor in current view');
            return;
        }
        const cursor = editor.getCursor();
        
        // Insert the citation at the cursor position
        editor.replaceRange(citation.formattedCitation, cursor);
        
        new Notice('Citation inserted into note');
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class CitationCandidatesModal extends Modal {
    private citations: Citation[];
    private citationService: CitationService;
    private selectedStyle: CitationStyle = CitationStyle.APA;
    
    constructor(app: App, citations: Citation[], citationService: CitationService) {
        super(app);
        this.citations = citations;
        this.citationService = citationService;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Citation Candidates' });
        
        if (this.citations.length === 0) {
            contentEl.createEl('p', { text: 'No citations found in the selected text.' });
            
            // Close button
            const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
            new ButtonComponent(buttonContainer)
                .setButtonText('Close')
                .onClick(() => {
                    this.close();
                });
                
            return;
        }
        
        // Style selection
        const styleContainer = contentEl.createDiv({ cls: 'style-container' });
        styleContainer.createEl('h3', { text: 'Citation Style' });
        
        const styleDropdown = new DropdownComponent(styleContainer);
        
        // Add style options
        styleDropdown.addOption(CitationStyle.APA, 'APA (7th Edition)');
        styleDropdown.addOption(CitationStyle.MLA, 'MLA (9th Edition)');
        styleDropdown.addOption(CitationStyle.CHICAGO, 'Chicago (17th Edition)');
        styleDropdown.addOption(CitationStyle.HARVARD, 'Harvard');
        styleDropdown.addOption(CitationStyle.IEEE, 'IEEE');
        styleDropdown.addOption(CitationStyle.VANCOUVER, 'Vancouver');
        
        styleDropdown.setValue(this.selectedStyle);
        styleDropdown.onChange(async value => {
            this.selectedStyle = value as CitationStyle;
            await this.refreshCitations();
        });
        
        // Citations container
        const citationsContainer = contentEl.createDiv({ cls: 'citations-container' });
        
        // Display each citation
        this.citations.forEach((citation, index) => {
            const citationItem = citationsContainer.createDiv({ cls: 'citation-item' });
            
            // Citation source
            citationItem.createEl('h3', { text: `Source ${index + 1}` });
            
            // Citation metadata
            const metadataDiv = citationItem.createDiv({ cls: 'citation-metadata' });
            
            if (citation.metadata.title) {
                metadataDiv.createEl('p', { text: `Title: ${citation.metadata.title}` });
            }
            
            if (citation.metadata.authors && citation.metadata.authors.length > 0) {
                metadataDiv.createEl('p', { text: `Authors: ${citation.metadata.authors.join(', ')}` });
            }
            
            if (citation.metadata.date) {
                metadataDiv.createEl('p', { text: `Date: ${citation.metadata.date}` });
            }
            
            if (citation.metadata.url) {
                metadataDiv.createEl('p', { text: `URL: ${citation.metadata.url}` });
            }
            
            // Formatted citation
            const formattedDiv = citationItem.createDiv({ cls: 'formatted-citation' });
            formattedDiv.createEl('p', { text: citation.formattedCitation });
            
            // Action buttons
            const actionDiv = citationItem.createDiv({ cls: 'citation-actions' });
            
            new ButtonComponent(actionDiv)
                .setButtonText('Copy')
                .onClick(() => {
                    navigator.clipboard.writeText(citation.formattedCitation);
                    new Notice('Citation copied to clipboard');
                });
            
            new ButtonComponent(actionDiv)
                .setButtonText('Insert')
                .setCta()
                .onClick(() => {
                    this.insertCitationIntoNote(citation);
                });
        });
        
        // Close button
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        new ButtonComponent(buttonContainer)
            .setButtonText('Close')
            .onClick(() => {
                this.close();
            });
    }
    
    // Refresh citations with new style
    private async refreshCitations() {
        try {
            // Update each citation with the new style
            const updatedCitations = await Promise.all(
                this.citations.map(citation => 
                    this.citationService.generateCitationFromMetadata(
                        citation.metadata, 
                        this.selectedStyle
                    )
                )
            );
            
            this.citations = updatedCitations;
            
            // Re-render the modal
            this.close();
            this.open();
        } catch (error) {
            console.error('Error refreshing citations:', error);
            new Notice(`Failed to refresh citations: ${error.message}`);
        }
    }
    
    // Insert citation into active note
    private insertCitationIntoNote(citation: Citation) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }
        
        // Safe cast to access editor
        const editor = (activeView as any).editor;
        if (!editor) {
            new Notice('Cannot access editor in current view');
            return;
        }
        const cursor = editor.getCursor();
        
        // Insert the citation at the cursor position
        editor.replaceRange(citation.formattedCitation, cursor);
        
        new Notice('Citation inserted into note');
        this.close();
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
