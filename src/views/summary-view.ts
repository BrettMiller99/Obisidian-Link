import { ItemView, WorkspaceLeaf, Notice, ButtonComponent, DropdownComponent, TFile, MarkdownRenderer, MarkdownView } from 'obsidian';
import { SummarizerService } from '../services/summarizer';
import { ObsidianLinkSettings } from '../types';

export const SUMMARY_VIEW_TYPE = 'obsidian-link-summary-view';

export enum SummaryLevel {
    BRIEF = 'brief',
    STANDARD = 'standard',
    DETAILED = 'detailed'
}

export class SummaryView extends ItemView {
    // contentEl is already defined in the parent ItemView class
    protected summaryContainerEl: HTMLElement;
    protected summaryContentEl: HTMLElement;
    protected controlsEl: HTMLElement;
    protected loadingEl: HTMLElement;
    protected summaryService: SummarizerService;
    protected settings: ObsidianLinkSettings;
    protected currentContent: string = '';
    protected currentSummary: string = '';
    protected currentFile: TFile | null = null;
    protected currentLevel: SummaryLevel = SummaryLevel.STANDARD;
    protected levelDropdown: DropdownComponent;

    constructor(
        leaf: WorkspaceLeaf, 
        settings: ObsidianLinkSettings,
        summaryService: SummarizerService
    ) {
        super(leaf);
        this.settings = settings;
        this.summaryService = summaryService;
    }

    getViewType(): string {
        return SUMMARY_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Gemini Summary';
    }

    getIcon(): string {
        return 'file-text';
    }

    async onOpen(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('obsidian-link-summary-view');

        // Create controls container
        this.controlsEl = containerEl.createDiv('summary-controls');
        
        // Create level selector
        const levelContainer = this.controlsEl.createDiv('summary-level-container');
        levelContainer.createEl('span', { text: 'Summary Level: ' });
        
        this.levelDropdown = new DropdownComponent(levelContainer)
            .addOption(SummaryLevel.BRIEF, 'Brief')
            .addOption(SummaryLevel.STANDARD, 'Standard')
            .addOption(SummaryLevel.DETAILED, 'Detailed')
            .setValue(this.currentLevel)
            .onChange(async (value: SummaryLevel) => {
                this.currentLevel = value;
                if (this.currentContent) {
                    await this.generateSummary(this.currentContent, this.currentFile);
                }
            });

        // Create button container
        const buttonContainer = this.controlsEl.createDiv('summary-button-container');
        
        // Create summarize current note button
        new ButtonComponent(buttonContainer)
            .setButtonText('Summarize Current Note')
            .setIcon('file-text')
            .onClick(async () => {
                // Try to get the active markdown view
                let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                
                // If not found, try getting it from the most recent leaf
                if (!activeView) {
                    const leaves = this.app.workspace.getLeavesOfType('markdown');
                    if (leaves.length > 0) {
                        const leaf = leaves[0];
                        if (leaf.view instanceof MarkdownView) {
                            activeView = leaf.view;
                        }
                    }
                }
                
                // If still not found, show error
                if (!activeView) {
                    new Notice('Please open a markdown file to summarize');
                    return;
                }
                
                if (!activeView.file) {
                    new Notice('No file associated with the current view');
                    return;
                }
                
                const content = await this.app.vault.read(activeView.file);
                await this.generateSummary(content, activeView.file);
            });

        // Create save button
        new ButtonComponent(buttonContainer)
            .setButtonText('Save to Note')
            .setIcon('save')
            .onClick(() => this.saveToNote());

        // Create loading indicator
        this.loadingEl = containerEl.createDiv('summary-loading');
        this.loadingEl.createEl('div', { cls: 'dot-pulse' });
        this.loadingEl.style.display = 'none';

        // Create content container
        this.summaryContainerEl = containerEl.createDiv('summary-container');
        this.summaryContentEl = this.summaryContainerEl.createDiv('summary-content');
        this.summaryContentEl.createEl('p', { 
            text: 'Select text in a document and use the "Summarize in Pane" command to generate a summary.'
        });
    }

    /**
     * Sets the content to be summarized
     * @param content The content to summarize
     */
    public setContent(content: string): void {
        this.currentContent = content;
    }

    /**
     * Sets the current file being summarized
     * @param file The file being summarized
     */
    public setFile(file: TFile | null): void {
        this.currentFile = file;
    }

    /**
     * Generates a summary for the given content and file
     * @param content The content to summarize
     * @param file The file being summarized
     */
    public async generateSummary(content: string, file: TFile | null): Promise<void> {
        if (!content) {
            new Notice('No content to summarize');
            return;
        }

        // Check if summary service is available
        if (!this.summaryService) {
            new Notice('Summarizer service is not available. Please check your API key and try again.');
            console.error('Summarizer service is not initialized');
            return;
        }

        this.currentContent = content;
        this.currentFile = file;
        
        // Show loading indicator
        this.summaryContentEl.empty();
        this.loadingEl.style.display = 'flex';
        
        try {
            // Generate summary with the selected level
            this.currentSummary = await this.summaryService.summarize(
                content, 
                this.currentLevel
            );
            
            // Display the summary
            this.summaryContentEl.empty();
            
            if (file) {
                const sourceEl = this.summaryContentEl.createEl('div', { cls: 'summary-source' });
                sourceEl.createEl('small', { 
                    text: `Summarized from: ${file.basename}` 
                });
                this.summaryContentEl.createEl('hr');
            }
            
            const formattedSummary = this.formatSummaryContent(this.currentSummary);
            this.summaryContentEl.appendChild(formattedSummary);
        } catch (error) {
            this.summaryContentEl.empty();
            this.summaryContentEl.createEl('p', { 
                text: `Error generating summary: ${error.message}`,
                cls: 'summary-error'
            });
        } finally {
            // Hide loading indicator
            this.loadingEl.style.display = 'none';
        }
    }

    private formatSummaryContent(summary: string): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        
        // Render markdown content properly using the imported MarkdownRenderer
        MarkdownRenderer.renderMarkdown(summary, tempDiv, '', this);
        
        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }
        
        return fragment;
    }

    async saveToNote(): Promise<void> {
        if (!this.currentSummary) {
            new Notice('No summary to save');
            return;
        }

        try {
            // Generate a filename based on the source file
            const sourceTitle = this.currentFile ? this.currentFile.basename : 'Untitled';
            const newNoteTitle = `${sourceTitle} Summary`;
            
            // Determine the folder to save in (same as source file or root)
            const folder = this.currentFile?.parent?.path || '';
            const newNotePath = `${folder ? folder + '/' : ''}${newNoteTitle}.md`;
            
            // Create content with source reference
            const vendorName = this.settings.vendor.charAt(0).toUpperCase() + this.settings.vendor.slice(1);
            let content = '';
            
            if (this.currentFile) {
                content += `*Generated from [${sourceTitle}](${this.currentFile.path}) using Obsidian-Link (${vendorName}).*\n\n`;
            } else {
                content += `*Generated using Obsidian-Link (${vendorName}).*\n\n`;
            }
            
            // Add summary level information
            content += `*Summary level: ${this.currentLevel.charAt(0).toUpperCase() + this.currentLevel.slice(1)}*\n\n`;
            
            // Add the summary content
            content += this.currentSummary;
            
            // Create the new file
            await this.app.vault.create(newNotePath, content);
            
            // Show success message
            new Notice(`Summary saved to "${newNoteTitle}"`);
            
            // Open the new file
            const newFile = this.app.vault.getAbstractFileByPath(newNotePath);
            if (newFile instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(newFile);
            }
        } catch (error) {
            new Notice(`Failed to save summary: ${error.message}`);
        }
    }

    async onClose(): Promise<void> {
        // Clean up resources if needed
    }
}
