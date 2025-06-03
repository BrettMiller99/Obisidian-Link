import { ItemView, WorkspaceLeaf } from 'obsidian';
import { SummarizerService } from '../services/summarizer';
import { ObsidianLinkSettings } from '../types';

export enum SummaryLevel {
  BRIEF = 'brief',
  STANDARD = 'standard',
  DETAILED = 'detailed'
}

export const SUMMARY_VIEW_TYPE = 'summary-view';

export class SummaryView extends ItemView {
  settings: ObsidianLinkSettings;
  summarizer: SummarizerService;
  currentFile: any;
  currentContent: string;
  currentSummary: string;
  summaryLevel: SummaryLevel;
  containerEl: any;

  constructor(leaf: WorkspaceLeaf, settings: ObsidianLinkSettings, summarizer: SummarizerService) {
    super(leaf);
    this.settings = settings;
    this.summarizer = summarizer;
    this.summaryLevel = SummaryLevel.STANDARD;
    this.containerEl = document.createElement('div');
    this.containerEl.empty = jest.fn();
    this.containerEl.addClass = jest.fn();
    this.containerEl.removeClass = jest.fn();
    this.containerEl.createEl = jest.fn().mockImplementation(() => {
      const el = document.createElement('div');
      el.empty = jest.fn();
      el.addClass = jest.fn();
      el.removeClass = jest.fn();
      el.createEl = jest.fn().mockReturnValue(document.createElement('div'));
      el.createDiv = jest.fn().mockReturnValue(document.createElement('div'));
      return el;
    });
    this.containerEl.createDiv = jest.fn().mockImplementation(() => {
      const div = document.createElement('div');
      div.empty = jest.fn();
      div.addClass = jest.fn();
      div.removeClass = jest.fn();
      div.createEl = jest.fn().mockReturnValue(document.createElement('div'));
      div.createDiv = jest.fn().mockReturnValue(document.createElement('div'));
      return div;
    });
  }
  
  getViewType(): string {
    return SUMMARY_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'Summary View';
  }
  
  async onOpen(): Promise<void> {
    // Mock implementation
  }

  async onClose(): Promise<void> {
    // Mock implementation
  }
  
  async generateSummary(content: string, file: any): Promise<void> {
    this.currentFile = file;
    this.currentSummary = await this.summarizer.summarize(content, this.summaryLevel, true);
    return Promise.resolve();
  }
  
  async saveToNote(): Promise<void> {
    return Promise.resolve();
  }
}
