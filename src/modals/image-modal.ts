import { App, Modal, TFile, Notice } from 'obsidian';
import { MultiModalService } from '../services/multi-modal';

export class ImageAnalysisModal extends Modal {
    private selectedFile: TFile | null = null;

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

        // Create file selector
        const fileSelector = contentEl.createEl('input', {
            type: 'file',
            attr: {
                accept: 'image/*'
            }
        });

        fileSelector.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            if (!target.files || target.files.length === 0) {
                return;
            }

            const file = target.files[0];
            await this.analyzeImage(file);
        });

        // Or allow dropping an image
        contentEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        contentEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
                return;
            }

            const file = e.dataTransfer.files[0];
            if (!file.type.startsWith('image/')) {
                new Notice('Please drop an image file');
                return;
            }

            await this.analyzeImage(file);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async analyzeImage(file: File) {
        try {
            new Notice('Analyzing image...');
            // Use the DESCRIBE analysis type by default
            const analysis = await this.multiModal.analyzeImage(
                file as unknown as TFile, 
                'describe' as any
            );
            
            // Create a new note with the analysis
            const fileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
            const filePath = `image-analysis/${fileName}-analysis.md`;
            
            // Create image-analysis folder if it doesn't exist
            const folder = this.app.vault.getAbstractFileByPath('image-analysis');
            if (!folder) {
                await this.app.vault.createFolder('image-analysis');
            }
            
            // Create the note content
            const content = [
                `# Image Analysis: ${fileName}`,
                '',
                '## Analysis Results',
                analysis.text || 'No analysis available',
                '',
                '## Objects Detected',
                ...(analysis.objects?.map(obj => `- ${obj.name} (${Math.round(obj.confidence * 100)}%)`) || []),
                '',
                '## Full Text',
                analysis.text || 'No text detected',
                '',
                '## Analysis Date',
                new Date().toISOString(),
            ].join('\n');
            
            await this.app.vault.create(filePath, content);
            this.close();
        } catch (error) {
            console.error('Error analyzing image:', error);
            new Notice('Failed to analyze image. Please try again.');
        }
    }
}
