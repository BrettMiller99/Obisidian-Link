// Mock the Notice class first, before any imports
const mockNotice = jest.fn();

// Mock obsidian with our custom Notice mock
jest.mock('obsidian', () => {
  return {
    ...jest.requireActual('__mocks__/obsidian.js'),
    Notice: mockNotice
  };
});

// Import obsidian types after mocking
import { WorkspaceLeaf, TFile } from 'obsidian';

// Import our modules after mocking
import { SummaryView, SummaryLevel, SUMMARY_VIEW_TYPE } from '../../views/summary-view';
import { SummarizerService } from '../../services/summarizer';
import { ObsidianLinkSettings } from '../../types';
import { AIVendor } from '../../utils/ai-providers';

// Mock the SummarizerService
jest.mock('../../services/summarizer');

describe('SummaryView', () => {
  let summaryView: SummaryView;
  let mockLeaf: WorkspaceLeaf;
  let mockSettings: ObsidianLinkSettings;
  let mockSummarizerService: jest.Mocked<SummarizerService>;

  beforeEach(() => {
    // Setup DOM elements for testing
    document.body.innerHTML = '<div id="test-container"></div>';
    
    // Create mock leaf and settings
    mockLeaf = {} as WorkspaceLeaf;
    mockSettings = {
      vendor: AIVendor.GOOGLE,
      model: 'gemini-1.5-pro',
      maxTokens: 1024,
      temperature: 0.7,
      geminiApiKey: 'mock-api-key',
      openaiApiKey: '',
      anthropicApiKey: ''
    };
    
    // Create mock summarizer service
    mockSummarizerService = new SummarizerService(mockSettings) as jest.Mocked<SummarizerService>;
    mockSummarizerService.summarize = jest.fn().mockResolvedValue('This is a test summary.');
    
    // Create the summary view
    // @ts-ignore - Ignoring constructor argument count for testing
    summaryView = new SummaryView(mockLeaf, mockSettings, mockSummarizerService);
    
    // Mock app object
    (summaryView as any).app = {
      workspace: {
        getLeaf: jest.fn().mockReturnValue({
          openFile: jest.fn().mockResolvedValue(undefined)
        })
      },
      vault: {
        create: jest.fn().mockResolvedValue(undefined),
        getAbstractFileByPath: jest.fn().mockImplementation((path) => {
          // @ts-ignore - Ignoring constructor argument count for testing
          return new TFile(path, path.split('/').pop()?.replace('.md', '') || '');
        })
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('view initialization', () => {
    it('should return the correct view type', () => {
      expect(summaryView.getViewType()).toBe(SUMMARY_VIEW_TYPE);
    });

    it('should return the correct display text', () => {
      expect(summaryView.getDisplayText()).toBe('Gemini Summary');
    });

    it('should return the correct icon', () => {
      expect(summaryView.getIcon()).toBe('file-text');
    });
  });

  describe('onOpen', () => {
    it('should create UI elements when opened', async () => {
      // Mock the containerEl with all required DOM methods
      const mockContainerEl = document.createElement('div');
      mockContainerEl.empty = jest.fn();
      mockContainerEl.addClass = jest.fn();
      mockContainerEl.removeClass = jest.fn();
      
      // Mock createDiv to return elements with required methods
      mockContainerEl.createDiv = jest.fn().mockImplementation(() => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockImplementation(() => {
          const el = document.createElement('span');
          el.empty = jest.fn();
          el.addClass = jest.fn();
          el.removeClass = jest.fn();
          return el;
        });
        div.createDiv = jest.fn().mockImplementation(() => {
          const innerDiv = document.createElement('div');
          innerDiv.empty = jest.fn();
          innerDiv.addClass = jest.fn();
          innerDiv.removeClass = jest.fn();
          innerDiv.createEl = jest.fn().mockReturnValue(document.createElement('div'));
          return innerDiv;
        });
        return div;
      });
      
      // Mock createEl
      mockContainerEl.createEl = jest.fn().mockImplementation(() => {
        const el = document.createElement('div');
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        return el;
      });
      
      // Assign the mock to the view
      (summaryView as any).containerEl = mockContainerEl;
      
      // Mock the DropdownComponent
      (global as any).DropdownComponent = jest.fn().mockImplementation(() => {
        return {
          selectEl: document.createElement('select'),
          onChange: jest.fn(),
          setValue: jest.fn(),
          addOption: jest.fn()
        };
      });
      
      // Mock the ButtonComponent
      (global as any).ButtonComponent = jest.fn().mockImplementation(() => {
        return {
          buttonEl: document.createElement('button'),
          onClick: jest.fn(),
          setDisabled: jest.fn(),
          setCta: jest.fn()
        };
      });
      
      await summaryView.onOpen();
      
      // Check if UI elements were created
      expect(mockContainerEl.empty).toHaveBeenCalled();
      expect(mockContainerEl.addClass).toHaveBeenCalledWith('obsidian-link-summary-view');
      expect(mockContainerEl.createDiv).toHaveBeenCalled();
    });
  });

  describe('generateSummary', () => {
    let mockFile: TFile;
    let mockContainerEl: any;

    beforeEach(() => {
      mockFile = {} as TFile;
      
      // Create a mock containerEl with all required DOM methods
      mockContainerEl = document.createElement('div');
      mockContainerEl.empty = jest.fn();
      mockContainerEl.addClass = jest.fn();
      mockContainerEl.removeClass = jest.fn();
      
      // Mock createDiv to return elements with required methods
      mockContainerEl.createDiv = jest.fn().mockImplementation(() => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockImplementation(() => {
          const el = document.createElement('span');
          el.empty = jest.fn();
          el.addClass = jest.fn();
          el.removeClass = jest.fn();
          return el;
        });
        div.createDiv = jest.fn().mockImplementation(() => {
          const innerDiv = document.createElement('div');
          innerDiv.empty = jest.fn();
          innerDiv.addClass = jest.fn();
          innerDiv.removeClass = jest.fn();
          innerDiv.createEl = jest.fn().mockReturnValue(document.createElement('div'));
          return innerDiv;
        });
        return div;
      });
      
      // Mock createEl
      mockContainerEl.createEl = jest.fn().mockImplementation(() => {
        const el = document.createElement('div');
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        return el;
      });
      
      // Assign the mock to the view
      (summaryView as any).containerEl = mockContainerEl;
      
      // Create mock UI elements
      (summaryView as any).summaryContentEl = document.createElement('div');
      (summaryView as any).summaryContentEl.empty = jest.fn();
      (summaryView as any).summaryContentEl.createEl = jest.fn().mockReturnValue(document.createElement('div'));
      
      (summaryView as any).loadingEl = document.createElement('div');
      (summaryView as any).loadingEl.addClass = jest.fn();
      (summaryView as any).loadingEl.removeClass = jest.fn();
    });

    it('should show an error notice if no content is provided', async () => {
      await summaryView.generateSummary('', mockFile);
      
      expect(mockNotice).toHaveBeenCalledWith('No content to summarize');
    });

    it('should call the summarizer service with the correct level', async () => {
      const content = 'Test content';
      (summaryView as any).currentLevel = SummaryLevel.DETAILED;
      
      await summaryView.generateSummary(content, mockFile);
      
      expect(mockSummarizerService.summarize).toHaveBeenCalledWith(content, SummaryLevel.DETAILED);
    });

    it('should update the UI with the summary', async () => {
      const content = 'Test content';
      const summary = 'Test summary';
      mockSummarizerService.summarize.mockResolvedValue(summary);
      
      await summaryView.generateSummary(content, mockFile);
      
      expect((summaryView as any).currentSummary).toBe(summary);
      expect((summaryView as any).currentFile).toBe(mockFile);
      expect((summaryView as any).currentContent).toBe(content);
    });

    it('should handle errors during summary generation', async () => {
      const error = new Error('Test error');
      mockSummarizerService.summarize.mockRejectedValue(error);
      
      // Mock the DOM elements needed for error display
      (summaryView as any).summaryContentEl = {
        empty: jest.fn(),
        createEl: jest.fn()
      };
      
      await summaryView.generateSummary('Test content', mockFile);
      
      // Check that the error is displayed in the UI
      expect((summaryView as any).summaryContentEl.createEl).toHaveBeenCalledWith('p', { 
        text: `Error generating summary: ${error.message}`,
        cls: 'summary-error'
      });
    });
  });

  describe('saveToNote', () => {
    beforeEach(async () => {
      // Setup the view
      // Create a mock containerEl with all required DOM methods
      const mockContainerEl = document.createElement('div');
      mockContainerEl.empty = jest.fn();
      mockContainerEl.addClass = jest.fn();
      mockContainerEl.removeClass = jest.fn();
      
      // Mock createDiv to return elements with required methods
      mockContainerEl.createDiv = jest.fn().mockImplementation(() => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockImplementation(() => {
          const el = document.createElement('span');
          el.empty = jest.fn();
          el.addClass = jest.fn();
          el.removeClass = jest.fn();
          return el;
        });
        div.createDiv = jest.fn().mockImplementation(() => {
          const innerDiv = document.createElement('div');
          innerDiv.empty = jest.fn();
          innerDiv.addClass = jest.fn();
          innerDiv.removeClass = jest.fn();
          innerDiv.createEl = jest.fn().mockReturnValue(document.createElement('div'));
          return innerDiv;
        });
        return div;
      });
      
      // Mock createEl
      mockContainerEl.createEl = jest.fn().mockImplementation(() => {
        const el = document.createElement('div');
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        return el;
      });
      
      // Assign the mock to the view
      (summaryView as any).containerEl = mockContainerEl;
      
      // Mock the vault
      (summaryView as any).app = {
        vault: {
          create: jest.fn().mockResolvedValue(null)
        }
      };
    });

    it('should show an error notice if no summary is available', async () => {
      (summaryView as any).currentSummary = '';
      
      await summaryView.saveToNote();
      
      expect(mockNotice).toHaveBeenCalledWith('No summary to save');
    });

    it('should create a new note with the summary', async () => {
      const summary = 'This is a test summary';
      (summaryView as any).currentSummary = summary;
      (summaryView as any).currentFile = { basename: 'Test File' } as TFile;
      
      await summaryView.saveToNote();
      
      expect((summaryView as any).app.vault.create).toHaveBeenCalledWith(
        'Test File Summary.md',
        expect.stringContaining(summary)
      );
      expect(mockNotice).toHaveBeenCalledWith('Summary saved to "Test File Summary"');
    });

    it('should handle errors when saving the note', async () => {
      const summary = 'This is a test summary';
      (summaryView as any).currentSummary = summary;
      (summaryView as any).currentFile = { basename: 'Test File' } as TFile;
      
      const error = new Error('Test error');
      ((summaryView as any).app.vault.create as jest.Mock).mockRejectedValueOnce(error);
      
      await summaryView.saveToNote();
      
      expect(mockNotice).toHaveBeenCalledWith(`Failed to save summary: ${error.message}`);
    });
  });
});
