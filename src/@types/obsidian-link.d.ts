import { App, Modal, TFile } from 'obsidian';
import { WebScraperService } from '../services/web-scraper';
import { SearchService } from '../services/search';
import { SearchResult } from 'services/search';
import { MultiModalService } from '../services/multi-modal';

declare module 'obsidian' {
    interface Workspace {
        getLeavesOfType(viewType: 'search-results' | 'web-scraper' | 'image-analysis'): any[];
    }
}

declare module 'obsidian-link' {
    export class WebScraperModal extends Modal {
        constructor(app: App, scraper: WebScraperService);
        onOpen(): void;
        onClose(): void;
    }

    export class SearchResultsModal extends Modal {
        constructor(app: App, results: SearchResult[], searchService: SearchService);
        onOpen(): void;
        onClose(): void;
    }

    export class ImageAnalysisModal extends Modal {
        constructor(app: App, file: TFile, multiModalService: MultiModalService);
        onOpen(): void;
        onClose(): void;
    }
}
