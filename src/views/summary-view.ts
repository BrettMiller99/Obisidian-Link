import { ItemView, WorkspaceLeaf, Notice, ButtonComponent, DropdownComponent, TFile, MarkdownRenderer } from 'obsidian';
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
    private summaryContainerEl: HTMLElement;
    private summaryContentEl: HTMLElement;
    private controlsEl: HTMLElement;
    private loadingEl: HTMLElement;
    private summaryService: SummarizerService;
    private settings: ObsidianLinkSettings;
    private currentContent: string = '';
    private currentSummary: string = '';
    private currentFile: TFile | null = null;
    private currentLevel: SummaryLevel = SummaryLevel.STANDARD;
    private levelDropdown: DropdownComponent;

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

        // Create save button
        const saveButtonContainer = this.controlsEl.createDiv('summary-save-container');
        new ButtonComponent(saveButtonContainer)
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

    async generateSummary(content: string, file: TFile | null): Promise<void> {
        if (!content) {
            new Notice('No content to summarize');
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
