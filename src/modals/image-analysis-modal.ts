import { App, ButtonComponent, FileSystemAdapter, Modal, Notice, Setting, TFile, TFolder, MarkdownView, Editor, Events } from 'obsidian';
import { LoadingModal } from './loading-modal'; // Import the new LoadingModal
import { MultiModalService, ImageAnalysisResult, ImageAnalysisType } from '../services/multi-modal';

export class ImageAnalysisModal extends Modal {
    // Add events emitter for communication between components
    private events = new Events();
    private multiModalService: MultiModalService;
    private selectedImage: TFile | null = null;
    private analysisOptions = {
        describe: true,
        ocr: false,
        identifyObjects: false,
        extractInfo: false
    };

    constructor(app: App, multiModalService: MultiModalService) {
        super(app);
        this.multiModalService = multiModalService;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Analyze Image' });
        contentEl.createEl('p', { text: 'Select an image and analysis options:' });
        
        // Image selection section
        const imageSection = contentEl.createDiv({ cls: 'image-selection-section' });
        imageSection.createEl('h3', { text: 'Select Image' });
        
        // Button to browse images
        new ButtonComponent(imageSection)
            .setButtonText('Browse Images')
            .setCta()
            .onClick(() => {
                this.openImageSelector();
            });
        
        // Display selected image info
        const selectedImageInfo = imageSection.createDiv({ cls: 'selected-image-info' });
        selectedImageInfo.createEl('p', { text: 'No image selected' });
        
        // Analysis options section
        const optionsSection = contentEl.createDiv({ cls: 'analysis-options-section' });
        optionsSection.createEl('h3', { text: 'Analysis Options' });
        
        // Describe image option
        new Setting(optionsSection)
            .setName('Describe Image')
            .setDesc('Generate a detailed description of the image content')
            .addToggle(toggle => {
                toggle.setValue(this.analysisOptions.describe)
                    .onChange(value => {
                        this.analysisOptions.describe = value;
                    });
            });
        
        // OCR option
        new Setting(optionsSection)
            .setName('Extract Text (OCR)')
            .setDesc('Extract text visible in the image')
            .addToggle(toggle => {
                toggle.setValue(this.analysisOptions.ocr)
                    .onChange(value => {
                        this.analysisOptions.ocr = value;
                    });
            });
        
        // Identify objects option
        new Setting(optionsSection)
            .setName('Identify Objects')
            .setDesc('Identify and list objects present in the image')
            .addToggle(toggle => {
                toggle.setValue(this.analysisOptions.identifyObjects)
                    .onChange(value => {
                        this.analysisOptions.identifyObjects = value;
                    });
            });
        
        // Extract info option
        new Setting(optionsSection)
            .setName('Extract Information')
            .setDesc('Extract structured information from the image')
            .addToggle(toggle => {
                toggle.setValue(this.analysisOptions.extractInfo)
                    .onChange(value => {
                        this.analysisOptions.extractInfo = value;
                    });
            });
        
        // Action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        
        // Analyze button
        const analyzeButton = new ButtonComponent(buttonContainer)
            .setButtonText('Analyze')
            .setCta()
            .setDisabled(true)
            .onClick(async () => {
                if (!this.selectedImage) {
                    new Notice('Please select an image to analyze');
                    return;
                }

                // Validate the selected image first
                const validateImage = async () => {
                    if (!this.selectedImage) {
                        new Notice('No image selected.');
                        return false;
                    }
                    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
                    if (!imageExtensions.includes(this.selectedImage.extension.toLowerCase())) {
                        new Notice('Selected file is not a supported image type.');
                        return false;
                    }
                    return true;
                };

                if (!await validateImage()) {
                    return;
                }
                
                // Determine the analysis type based on selected options
                let analysisType: ImageAnalysisType;
                if (this.analysisOptions.ocr) {
                    analysisType = ImageAnalysisType.OCR;
                } else if (this.analysisOptions.identifyObjects) {
                    analysisType = ImageAnalysisType.IDENTIFY_OBJECTS;
                } else if (this.analysisOptions.extractInfo) {
                    analysisType = ImageAnalysisType.EXTRACT_INFORMATION;
                } else { // Default to describe if nothing else is selected
                    analysisType = ImageAnalysisType.DESCRIBE;
                }

                try {
                    // Perform analysis with loading indicator
                    const result = await this.performAnalysisWithLoading(this.selectedImage, analysisType);
                    
                    if (result) {
                        // Show analysis result modal
                        new ImageAnalysisResultModal(this.app, result, this.selectedImage, analysisType).open();
                        this.close(); // Close the current ImageAnalysisModal
                    }
                    // If result is null, an error occurred, was notified by performAnalysisWithLoading, and loading modal was closed.
                } catch (error: any) {
                    // This catch block might be redundant if performAnalysisWithLoading handles all its errors,
                    // but kept for safety for unexpected issues during the call itself.
                    console.error('Error in Analyze button onClick (after performAnalysisWithLoading):', error);
                    new Notice(`An unexpected error occurred during analysis: ${error.message}`);
                }
            });
        
        // Cancel button
        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
        
        // Update UI when an image is selected
        this.events.on('image-selected', (file: TFile) => {
            this.selectedImage = file;
            selectedImageInfo.empty();
            selectedImageInfo.createEl('p', { text: `Selected: ${file.name}` });
            
            // Enable analyze button
            analyzeButton.setDisabled(false);
        });
    }
    
    // Method to open image selector
    private async openImageSelector() {
        // Get all image files in the vault
        const imageFiles = this.app.vault.getFiles().filter(file => {
            const extension = file.extension.toLowerCase();
            return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension);
        });
        
        // Check for embedded images in the active note
        const embeddedImages = this.getEmbeddedImagesInActiveNote();
        
        if (imageFiles.length === 0 && embeddedImages.length === 0) {
            new Notice('No image files found in your vault or current note');
            return;
        }
        
        // Open image selector modal
        new ImageSelectorModal(this.app, imageFiles, embeddedImages, (file: TFile) => {
            this.events.trigger('image-selected', file);
        }).open();
    }

    /**
     * Finds embedded images in the active note
     * @returns Array of image files that are embedded in the active note
     */
    private getEmbeddedImagesInActiveNote(): TFile[] {
        const embeddedImages: TFile[] = [];
        
        // Get the active markdown view
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return embeddedImages;
        
        // Get the editor content
        const editor = activeView.editor;
        const content = editor.getValue();
        
        // Find all embedded image references using regex
        // Match both ![[image.png]] and ![alt](image.png) formats
        const wikiLinkRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp))\]\]/g;
        const markdownLinkRegex = /!\[[^\]]*\]\(([^)]+\.(png|jpg|jpeg|gif|webp))\)/g;
        
        // Process wiki-style links: ![[image.png]]
        let match;
        while ((match = wikiLinkRegex.exec(content)) !== null) {
            const imagePath = match[1].trim();
            const imageFile = this.app.vault.getFiles().find(file => 
                file.path === imagePath || file.path.endsWith(`/${imagePath}`)
            );
            
            if (imageFile && !embeddedImages.includes(imageFile)) {
                embeddedImages.push(imageFile);
            }
        }
        
        // Process markdown-style links: ![alt](image.png)
        while ((match = markdownLinkRegex.exec(content)) !== null) {
            const imagePath = match[1].trim();
            // Handle relative paths
            const imageFile = this.app.vault.getFiles().find(file => 
                file.path === imagePath || file.path.endsWith(`/${imagePath}`)
            );
            
            if (imageFile && !embeddedImages.includes(imageFile)) {
                embeddedImages.push(imageFile);
            }
        }
        
        return embeddedImages;
    }

    private async performAnalysisWithLoading(file: TFile, analysisType: ImageAnalysisType): Promise<ImageAnalysisResult | null> {
        if (!this.multiModalService) {
            new Notice('MultiModalService is not available. Cannot analyze image.');
            return null;
        }

        const loadingModal = new LoadingModal(this.app, `Analyzing image for ${analysisType}...`);
        loadingModal.open();

        try {
            const result = await this.multiModalService.analyzeImage(file, analysisType);
            return result;
        } catch (error: any) {
            console.error(`Error during image analysis (${analysisType}):`, error);
            new Notice(`Failed to analyze image for ${analysisType}: ${error.message}`);
            return null;
        } finally {
            loadingModal.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Modal for selecting an image
export class ImageSelectorModal extends Modal {
    private imageFiles: TFile[];
    private embeddedImages: TFile[];
    private onSelect: (file: TFile) => void;

    constructor(app: App, imageFiles: TFile[], embeddedImages: TFile[], onSelect: (file: TFile) => void) {
        super(app);
        this.imageFiles = imageFiles;
        this.embeddedImages = embeddedImages;
        this.onSelect = onSelect;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Select an Image' });
        
        // Display embedded images from current note first if available
        if (this.embeddedImages.length > 0) {
            const embeddedSection = contentEl.createDiv({ cls: 'embedded-section' });
            embeddedSection.createEl('h3', { text: 'Images in Current Note' });
            
            const embeddedList = embeddedSection.createDiv({ cls: 'image-list embedded-images' });
            
            this.embeddedImages.forEach(file => {
                const fileItem = embeddedList.createDiv({ cls: 'image-item embedded-image' });
                
                new Setting(fileItem)
                    .setName(file.name)
                    .setDesc('Embedded in current note')
                    .addButton(button => {
                        button.setButtonText('Select')
                            .setCta()
                            .onClick(() => {
                                this.onSelect(file);
                                this.close();
                            });
                    });
            });
            
            // Add a separator
            contentEl.createEl('hr');
        }
        
        // Group vault images by folder
        const imagesByFolder: Record<string, TFile[]> = {};
        
        this.imageFiles.forEach(file => {
            const folderPath = file.parent ? file.parent.path : '/';
            if (!imagesByFolder[folderPath]) {
                imagesByFolder[folderPath] = [];
            }
            imagesByFolder[folderPath].push(file);
        });
        
        // Add a header for vault images
        if (Object.keys(imagesByFolder).length > 0) {
            contentEl.createEl('h3', { text: 'All Images in Vault' });
        }
        
        // Create folder sections
        Object.entries(imagesByFolder).forEach(([folderPath, files]) => {
            const folderSection = contentEl.createDiv({ cls: 'folder-section' });
            folderSection.createEl('h4', { text: folderPath === '/' ? 'Root' : folderPath });
            
            const imageList = folderSection.createDiv({ cls: 'image-list' });
            
            files.forEach(file => {
                // Skip if this file is already in the embedded images list
                if (this.embeddedImages.some(embeddedFile => embeddedFile.path === file.path)) {
                    return;
                }
                
                const fileItem = imageList.createDiv({ cls: 'image-item' });
                
                new Setting(fileItem)
                    .setName(file.name)
                    .addButton(button => {
                        button.setButtonText('Select')
                            .setCta()
                            .onClick(() => {
                                this.onSelect(file);
                                this.close();
                            });
                    });
            });
        });
        
        // Cancel button
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        new ButtonComponent(buttonContainer)
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

// Modal for displaying image analysis results
export class ImageAnalysisResultModal extends Modal {
    private result: ImageAnalysisResult;
    private imageFile: TFile;
    private analysisType: ImageAnalysisType;
    
    constructor(app: App, result: ImageAnalysisResult, imageFile: TFile, analysisType: ImageAnalysisType) {
        super(app);
        this.result = result;
        this.imageFile = imageFile;
        this.analysisType = analysisType;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: `Analysis Results: ${this.imageFile.name}` });
        
        // Create tabs for different result types
        const tabContainer = contentEl.createDiv({ cls: 'tab-container' });
        const contentContainer = contentEl.createDiv({ cls: 'content-container' });
        
        // Create tabs based on available results
        const tabs: Record<string, HTMLElement> = {};
        
        // Display description for DESCRIBE analysis type
        if (this.analysisType === ImageAnalysisType.DESCRIBE) {
            tabs['Description'] = this.createResultSection(contentContainer, 'description', this.result.text);
        }
        
        if (this.result.text) {
            tabs['Text (OCR)'] = this.createResultSection(contentContainer, 'ocr', this.result.text);
        }
        
        if (this.result.objects && this.result.objects.length > 0) {
            tabs['Objects'] = this.createResultSection(contentContainer, 'objects', 
                this.result.objects.map(obj => `- ${obj.name} (Confidence: ${Math.round(obj.confidence * 100)}%)`).join('\n')
            );
        }
        
        // Display information for EXTRACT_INFORMATION analysis type
        if (this.analysisType === ImageAnalysisType.EXTRACT_INFORMATION) {
            tabs['Information'] = this.createResultSection(contentContainer, 'information', this.result.text);
        }
        
        // Create tab buttons
        Object.entries(tabs).forEach(([tabName, contentEl], index) => {
            const tabButton = tabContainer.createEl('button', { 
                text: tabName,
                cls: index === 0 ? 'tab-button active' : 'tab-button'
            });
            
            // Show only the first tab content initially
            contentEl.style.display = index === 0 ? 'block' : 'none';
            
            tabButton.addEventListener('click', () => {
                // Hide all content sections
                Object.values(tabs).forEach(el => {
                    el.style.display = 'none';
                });
                
                // Deactivate all tab buttons
                tabContainer.querySelectorAll('.tab-button').forEach(el => {
                    el.classList.remove('active');
                });
                
                // Activate the clicked tab
                tabButton.classList.add('active');
                contentEl.style.display = 'block';
            });
        });
        
        // Add buttons for inserting results into note
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        
        // Insert into current note button
        new ButtonComponent(buttonContainer)
            .setButtonText('Insert into Current Note')
            .setCta()
            .onClick(async () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                
                if (!activeView) {
                    new Notice('No active markdown view');
                    return;
                }
                
                const editor = activeView.editor;
                const cursor = editor.getCursor();
                
                // Format the results for insertion
                let content = `## Analysis of ${this.imageFile.name}\n\n`;
                
                // For description type results
                if (this.analysisType === ImageAnalysisType.DESCRIBE) {
                    content += `### Description\n${this.result.text}\n\n`;
                }
                
                if (this.result.text) {
                    content += `### Extracted Text\n${this.result.text}\n\n`;
                }
                
                if (this.result.objects && this.result.objects.length > 0) {
                    content += `### Identified Objects\n`;
                    this.result.objects.forEach(obj => {
                        content += `- ${obj.name} (Confidence: ${Math.round(obj.confidence * 100)}%)\n`;
                    });
                    content += '\n';
                }
                
                // For information extraction type results
                if (this.analysisType === ImageAnalysisType.EXTRACT_INFORMATION) {
                    content += `### Additional Information\n${this.result.text}\n\n`;
                }
                
                // Insert the content at the cursor position
                editor.replaceRange(content, cursor);
                
                new Notice('Analysis results inserted into note');
                this.close();
            });
        
        // Create new note button
        new ButtonComponent(buttonContainer)
            .setButtonText('Create New Note')
            .onClick(async () => {
                try {
                    // Format the results for the new note
                    let content = `# Analysis of ${this.imageFile.name}\n\n`;
                    content += `![[${this.imageFile.path}]]\n\n`;
                    
                    // For description type results
                    if (this.analysisType === ImageAnalysisType.DESCRIBE) {
                        content += `## Description\n${this.result.text}\n\n`;
                    }
                    
                    if (this.result.text) {
                        content += `## Extracted Text\n${this.result.text}\n\n`;
                    }
                    
                    if (this.result.objects && this.result.objects.length > 0) {
                        content += `## Identified Objects\n`;
                        this.result.objects.forEach(obj => {
                            content += `- ${obj.name} (Confidence: ${Math.round(obj.confidence * 100)}%)\n`;
                        });
                        content += '\n';
                    }
                    
                    // For information extraction type results
                    if (this.analysisType === ImageAnalysisType.EXTRACT_INFORMATION) {
                        content += `## Additional Information\n${this.result.text}\n\n`;
                    }
                    
                    // Create a new note
                    const fileName = `Analysis of ${this.imageFile.basename}`;
                    const newFile = await this.app.vault.create(`${fileName}.md`, content);
                    
                    // Open the new file
                    this.app.workspace.openLinkText(newFile.path, '', true);
                    
                    new Notice('New note created with analysis results');
                    this.close();
                } catch (error) {
                    console.error('Error creating new note:', error);
                    new Notice(`Failed to create new note: ${error.message}`);
                }
            });
        
        // Close button
        new ButtonComponent(buttonContainer)
            .setButtonText('Close')
            .onClick(() => {
                this.close();
            });
    }
    
    // Helper method to create a result section
    private createResultSection(container: HTMLElement, id: string, content: string): HTMLElement {
        const section = container.createDiv({ cls: 'result-section', attr: { id: `result-${id}` } });
        
        const contentEl = section.createDiv({ cls: 'result-content' });
        contentEl.createEl('pre', { text: content });
        
        // Add copy button
        const copyButton = section.createEl('button', { 
            text: 'Copy', 
            cls: 'copy-button'
        });
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            new Notice('Copied to clipboard');
        });
        
        return section;
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
