import { App, Modal, Notice, TFile, Setting } from 'obsidian';
import { MultiModalService, ImageAnalysisType } from '../services/multi-modal';

export class ImageAnalysisModal extends Modal {
    private file: TFile | null = null;
    private analysisResult: string = '';
    private analysisType: ImageAnalysisType = ImageAnalysisType.DESCRIBE;

    constructor(
        app: App,
        private multiModal: MultiModalService
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Image Analysis' });

        // Add analysis type selection
        new Setting(contentEl)
            .setName('Analysis Type')
            .setDesc('Select the type of analysis to perform on the image')
            .addDropdown(dropdown => {
                dropdown
                    .addOption(ImageAnalysisType.DESCRIBE, 'Describe Image')
                    .addOption(ImageAnalysisType.OCR, 'Extract Text (OCR)')
                    .addOption(ImageAnalysisType.IDENTIFY_OBJECTS, 'Identify Objects')
                    .setValue(this.analysisType)
                    .onChange((value: string) => {
                        this.analysisType = value as ImageAnalysisType;
                    });
            });

        // Add file upload/selection UI
        const fileInput = contentEl.createEl('input', {
            attr: {
                type: 'file',
                accept: 'image/*',
                style: 'display: none;'
            }
        });

        const uploadButton = contentEl.createEl('button', {
            text: 'Select Image',
            cls: 'mod-cta'
        });

        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                await this.analyzeImage(file);
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async analyzeImage(file: File | TFile) {
        try {
            let result: string;
            
            if (file instanceof TFile) {
                // Handle TFile from Obsidian
                const fileContent = await this.app.vault.readBinary(file);
                const base64Content = this.arrayBufferToBase64(fileContent);
                const analysis = await this.multiModal.analyzeImage(file, this.analysisType);
                result = analysis.text;
            } else {
                // Handle File from file input
                const arrayBuffer = await file.arrayBuffer();
                const base64Content = this.arrayBufferToBase64(arrayBuffer);
                const analysis = await this.multiModal.analyzeImage(file as unknown as TFile, this.analysisType);
                result = analysis.text;
            }
            
            this.analysisResult = result;
            this.renderResults();
        } catch (error) {
            console.error('Error analyzing image:', error);
            new Notice('Failed to analyze image. Please try again.');
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private renderResults() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Analysis Results' });
        
        // Create a container for the image and results
        const container = contentEl.createDiv({ cls: 'image-analysis-container' });
        
        // Display the image
        if (this.file) {
            const img = container.createEl('img', {
                cls: 'image-preview',
                attr: {
                    src: this.app.vault.getResourcePath(this.file)
                }
            });
            img.style.maxWidth = '100%';
            img.style.maxHeight = '300px';
            img.style.marginBottom = '1em';
        }
        
        // Display the analysis results
        const resultsDiv = container.createDiv({ cls: 'image-analysis-results' });
        resultsDiv.createEl('h3', { text: 'Analysis:' });
        resultsDiv.createEl('p', { text: this.analysisResult });
        
        // Add a button to copy the results
        new Setting(container)
            .addButton(btn => {
                btn.setButtonText('Copy to Clipboard')
                    .onClick(() => {
                        navigator.clipboard.writeText(this.analysisResult);
                        new Notice('Analysis results copied to clipboard!');
                    });
            });
    }
}
