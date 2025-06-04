import { App, Modal } from 'obsidian';

export class LoadingModal extends Modal {
    private message: string;

    constructor(app: App, message: string = 'Analyzing image, please wait...') {
        super(app);
        this.message = message;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Clear previous content
        contentEl.addClass('obsidian-link-loading-modal-content'); // Add class to contentEl for overall styling

        // Main container for spinner and text, to help with flex layout
        const container = contentEl.createDiv({ cls: 'obsidian-link-loading-container' });

        // Spinner element
        container.createDiv({ cls: 'obsidian-link-spinner' });

        // Loading text
        const loadingText = container.createEl('p', { text: this.message });
        loadingText.addClass('obsidian-link-loading-text');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.removeClass('obsidian-link-loading-modal-content');
    }

    // Method to update the message if needed while the modal is open
    setMessage(newMessage: string) {
        this.message = newMessage;
        if (this.containerEl.isShown()) { // Check if modal is currently open
            this.onOpen(); // Re-render content with new message
        }
    }
}
