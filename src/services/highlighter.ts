import { App, MarkdownView, TFile, EditorRange, Notice } from 'obsidian';
import { SearchService } from './search';

/**
 * Service to handle highlighting text in opened notes
 */
export class HighlighterService {
    private app: App;
    private searchService: SearchService;
    private activeHighlights: Map<string, HTMLElement[]> = new Map();
    
    constructor(app: App, searchService: SearchService) {
        this.app = app;
        this.searchService = searchService;
    }
    
    /**
     * Apply highlighting to a file when it's opened
     * @param file The file to highlight
     */
    public async highlightFile(file: TFile): Promise<void> {
        // Wait a moment for the editor to fully load
        // Use a longer timeout to ensure the editor is fully loaded
        setTimeout(() => this.applyHighlighting(file), 500);
        
        // Also register a one-time event listener for layout changes
        // This helps catch cases where the editor might not be ready at the first timeout
        const layoutChangeHandler = this.app.workspace.on('layout-change', () => {
            setTimeout(() => {
                this.applyHighlighting(file);
                // Remove this handler after it fires once
                this.app.workspace.offref(layoutChangeHandler);
            }, 300);
        });
    }
    
    /**
     * Apply highlighting to the active view if it matches the file
     * @param file The file to highlight
     */
    private async applyHighlighting(file: TFile): Promise<void> {
        // Find the leaf that contains this file
        let targetView: MarkdownView | null = null;
        
        // Check all leaves to find the one with our file
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
                targetView = leaf.view;
            }
        });
        
        if (!targetView) {
            // If we can't find the view, try the active view as a fallback
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView || activeView.file?.path !== file.path) {
                return;
            }
            targetView = activeView;
        }
        
        // Get highlight info for this file
        const highlightInfo = this.searchService.getHighlightInfo(file.path);
        if (!highlightInfo) {
            return;
        }
        
        // Clear any existing highlights for this file
        this.clearHighlightsForFile(file.path);
        
        // Get the editor from the view
        const editor = targetView.editor;
        const content = editor.getValue();
        
        // Create a container for the highlights
        const highlightElements: HTMLElement[] = [];
        
        // Add CSS for highlights if not already added
        this.ensureHighlightCSS();
        
        // Highlight terms
        if (highlightInfo.terms && highlightInfo.terms.length > 0) {
            for (const term of highlightInfo.terms) {
                if (term.length < 3) continue; // Skip very short terms
                
                // Find all occurrences of the term
                const regex = new RegExp(this.escapeRegExp(term), 'gi');
                let match;
                
                while ((match = regex.exec(content)) !== null) {
                    const start = match.index;
                    const end = start + match[0].length;
                    
                    // Get the position in the editor
                    const startPos = editor.offsetToPos(start);
                    const endPos = editor.offsetToPos(end);
                    
                    // Create a temporary mark in the editor
                    const marker = document.createElement('div');
                    marker.addClass('gemini-search-highlight');
                    
                    // Add the marker to the DOM near the editor
                    const editorElement = targetView.contentEl.querySelector('.cm-editor');
                    if (editorElement) {
                        editorElement.appendChild(marker);
                        
                        // Get the coordinates of the text in the editor
                        const editorRect = editorElement.getBoundingClientRect();
                        
                        // Get the coordinates of the text
                        const from = { line: startPos.line, ch: startPos.ch };
                        const to = { line: endPos.line, ch: endPos.ch };
                        
                        // Use the editor's coordinate system to position the highlight
                        const posFrom = editor.posToOffset(from);
                        const posTo = editor.posToOffset(to);
                        
                        // Create a text marker in the editor
                        const textRange = {
                            from: from,
                            to: to
                        };
                        
                        // Set the marker position using CSS
                        marker.style.position = 'absolute';
                        marker.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                        marker.style.borderRadius = '3px';
                        marker.style.padding = '0 2px';
                        marker.style.zIndex = '10';
                        
                        // Position the marker using line and character information
                        // Since we can't directly access CodeMirror coordinates, we'll use a different approach
                        const lineElement = editorElement.querySelector(`.cm-line:nth-child(${startPos.line + 1})`);
                        
                        if (lineElement) {
                            // Approximate positioning based on line elements
                            const lineRect = lineElement.getBoundingClientRect();
                            const editorRect = editorElement.getBoundingClientRect();
                            
                            marker.style.top = `${lineRect.top - editorRect.top}px`;
                            marker.style.left = `${lineRect.left - editorRect.left}px`;
                            marker.style.height = `${lineRect.height}px`;
                            marker.style.width = 'auto';
                            marker.style.pointerEvents = 'none'; // Allow clicking through the highlight
                        }
                        
                        highlightElements.push(marker);
                    }
                }
            }
        }
        
        // Highlight relevant section if provided
        if (highlightInfo.relevantSection) {
            const section = highlightInfo.relevantSection.trim();
            if (section.length > 10) {
                const index = content.indexOf(section);
                if (index !== -1) {
                    // Create a notice to inform the user
                    new Notice(`Relevant section found in ${file.basename}`);
                    
                    // Scroll to the section
                    const start = index;
                    const end = start + section.length;
                    const startPos = editor.offsetToPos(start);
                    const endPos = editor.offsetToPos(end);
                    
                    // Create a highlight for the section
                    const sectionMarker = document.createElement('div');
                    sectionMarker.addClass('gemini-search-section-highlight');
                    
                    // Add the marker to the DOM
                    const editorElement = targetView.contentEl.querySelector('.cm-editor');
                    if (editorElement) {
                        editorElement.appendChild(sectionMarker);
                        
                        // Position the marker using line elements
                        const lineElement = editorElement.querySelector(`.cm-line:nth-child(${startPos.line + 1})`);
                        if (lineElement) {
                            // Approximate positioning based on line elements
                            const lineRect = lineElement.getBoundingClientRect();
                            const editorRect = editorElement.getBoundingClientRect();
                            
                            sectionMarker.style.position = 'absolute';
                            sectionMarker.style.top = `${lineRect.top - editorRect.top}px`;
                            sectionMarker.style.left = `${lineRect.left - editorRect.left}px`;
                            sectionMarker.style.height = `${lineRect.height}px`;
                            sectionMarker.style.width = 'auto';
                            sectionMarker.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
                            sectionMarker.style.borderRadius = '3px';
                            sectionMarker.style.padding = '0 2px';
                            sectionMarker.style.zIndex = '10';
                            sectionMarker.style.pointerEvents = 'none';
                            
                            highlightElements.push(sectionMarker);
                        }
                    }
                    
                    // Scroll to the section
                    editor.setCursor(startPos);
                    editor.scrollIntoView({
                        from: startPos,
                        to: endPos
                    }, true);
                }
            }
        }
        
        // Store the highlights for later cleanup
        if (highlightElements.length > 0) {
            this.activeHighlights.set(file.path, highlightElements);
        }
    }
    
    /**
     * Ensure the CSS for highlights is added to the document
     */
    private ensureHighlightCSS(): void {
        // Check if our styles are already added
        if (!document.getElementById('gemini-search-highlight-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'gemini-search-highlight-styles';
            styleEl.textContent = `
                .gemini-search-highlight {
                    background-color: rgba(255, 255, 0, 0.3);
                    border-radius: 3px;
                    padding: 0 2px;
                }
                .gemini-search-section-highlight {
                    background-color: rgba(0, 255, 0, 0.2);
                    border-radius: 3px;
                    padding: 0 2px;
                }
            `;
            document.head.appendChild(styleEl);
        }
    }
    
    /**
     * Create a highlight marker element
     * @param text Text to display in the marker
     * @returns HTML element for the marker
     */
    private createHighlightMarker(text: string): HTMLElement {
        const marker = document.createElement('div');
        marker.addClass('gemini-search-highlight');
        marker.style.position = 'absolute';
        marker.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        marker.style.borderRadius = '3px';
        marker.style.padding = '0 2px';
        marker.style.zIndex = '10';
        marker.style.pointerEvents = 'none';
        return marker;
    }
    
    /**
     * Create a highlight marker for a relevant section
     * @param text Text to display in the marker
     * @returns HTML element for the marker
     */
    private createSectionHighlightMarker(text: string): HTMLElement {
        const marker = document.createElement('div');
        marker.addClass('gemini-search-section-highlight');
        marker.style.position = 'absolute';
        marker.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        marker.style.borderRadius = '3px';
        marker.style.padding = '0 2px';
        marker.style.zIndex = '10';
        marker.style.pointerEvents = 'none';
        return marker;
    }
    
    /**
     * Clear all highlights for a specific file
     * @param path File path
     */
    public clearHighlightsForFile(path: string): void {
        const highlights = this.activeHighlights.get(path);
        if (highlights) {
            for (const highlight of highlights) {
                highlight.remove();
            }
            this.activeHighlights.delete(path);
        }
    }
    
    /**
     * Clear all active highlights
     */
    public clearAllHighlights(): void {
        for (const [path, highlights] of this.activeHighlights.entries()) {
            for (const highlight of highlights) {
                highlight.remove();
            }
        }
        this.activeHighlights.clear();
    }
    
    /**
     * Escape special characters in a string for use in a regular expression
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
