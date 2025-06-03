import ObsidianLinkPlugin from '../main';
import { SummaryView, SUMMARY_VIEW_TYPE } from '../views/summary-view';
import { SummarizerService } from '../services/summarizer';
import { AIVendor } from '../utils/ai-providers';
import { App, Editor, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';

// Mock the Obsidian API
jest.mock('obsidian');

// Mock the services
jest.mock('../services/summarizer');
jest.mock('../services/search');
jest.mock('../services/web-scraper');

describe('ObsidianLinkPlugin', () => {
  let plugin: ObsidianLinkPlugin;
  let mockApp: jest.Mocked<App>;
  let mockWorkspace: any;
  let mockVault: any;

  beforeEach(() => {
    // Setup mock app
    mockWorkspace = {
      getLeavesOfType: jest.fn().mockReturnValue([]),
      getRightLeaf: jest.fn().mockReturnValue({
        setViewState: jest.fn().mockResolvedValue(undefined)
      }),
      revealLeaf: jest.fn(),
      getLeaf: jest.fn().mockReturnValue({
        openFile: jest.fn().mockResolvedValue(undefined)
      }),
      on: jest.fn(),
      off: jest.fn()
    };
    
    mockVault = {
      create: jest.fn().mockResolvedValue(undefined),
      getAbstractFileByPath: jest.fn().mockImplementation((path) => {
        // @ts-ignore - Ignoring constructor argument count for testing
        return new TFile(path, path.split('/').pop()?.replace('.md', '') || '');
      })
    };
    
    mockApp = {
      workspace: mockWorkspace,
      vault: mockVault,
    } as unknown as jest.Mocked<App>;
    
    // Create plugin instance with a proper manifest
    const mockManifest = { id: 'obsidian-link', name: 'Obsidian Link' } as any;
    plugin = new ObsidianLinkPlugin(mockApp, mockManifest);
    
    // Mock settings and services
    plugin.settings = {
      vendor: AIVendor.GOOGLE,
      model: 'gemini-1.5-pro',
      maxTokens: 1024,
      temperature: 0.7,
      geminiApiKey: 'mock-api-key',
      openaiApiKey: '',
      anthropicApiKey: ''
    };
    
    plugin.summarizer = new SummarizerService(plugin.settings) as jest.Mocked<SummarizerService>;
    (plugin.summarizer as jest.Mocked<SummarizerService>).summarize = jest.fn().mockResolvedValue('This is a test summary.');
  });

  describe('ensureSummaryViewOpen', () => {
    it('should return existing leaf if summary view is already open', () => {
      const mockLeaf = {} as WorkspaceLeaf;
      mockWorkspace.getLeavesOfType.mockReturnValueOnce([mockLeaf]);
      
      const result = plugin.ensureSummaryViewOpen();
      
      expect(result).toBe(mockLeaf);
      expect(mockWorkspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });

    it('should create a new leaf if summary view is not open', () => {
      const mockLeaf = {
        setViewState: jest.fn().mockResolvedValue(undefined)
      } as unknown as WorkspaceLeaf;
      mockWorkspace.getRightLeaf.mockReturnValueOnce(mockLeaf);
      
      const result = plugin.ensureSummaryViewOpen();
      
      expect(result).toBe(mockLeaf);
      expect(mockLeaf.setViewState).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SUMMARY_VIEW_TYPE,
          active: true
        })
      );
      expect(mockWorkspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });

    it('should return null if unable to create a leaf', () => {
      mockWorkspace.getRightLeaf.mockReturnValueOnce(null);
      
      const result = plugin.ensureSummaryViewOpen();
      
      expect(result).toBeNull();
    });
  });

  describe('commands', () => {
    let mockEditor: jest.Mocked<Editor>;
    let mockView: jest.Mocked<MarkdownView>;
    let mockFile: TFile;
    let mockCommands: any[];

    beforeEach(() => {
      // Mock editor and view
      // @ts-ignore - Ignoring constructor argument count for testing
      mockFile = new TFile('test/path.md', 'Test File');
      mockEditor = {
        getSelection: jest.fn().mockReturnValue('Test selection')
      } as unknown as jest.Mocked<Editor>;
      mockView = {
        editor: mockEditor,
        file: mockFile
      } as unknown as jest.Mocked<MarkdownView>;
      
      // Mock addCommand to capture commands
      mockCommands = [];
      plugin.addCommand = jest.fn().mockImplementation((command) => {
        mockCommands.push(command);
        return { id: command.id };
      });
      
      // Mock registerView
      plugin.registerView = jest.fn();
      
      // Call onload to register commands
      plugin.onload();
    });

    it('should register the summary view', () => {
      expect(plugin.registerView).toHaveBeenCalledWith(
        SUMMARY_VIEW_TYPE,
        expect.any(Function)
      );
    });

    it('should register the summarize-selection-in-pane command', () => {
      const command = mockCommands.find(cmd => cmd.id === 'summarize-selection-in-pane');
      expect(command).toBeDefined();
    });

    it('should register the open-summary-view command', () => {
      const command = mockCommands.find(cmd => cmd.id === 'open-summary-view');
      expect(command).toBeDefined();
    });

    it('should handle the summarize-selection-in-pane command', async () => {
      // Set up the API key to avoid early return
      (plugin.settings as any).geminiApiKey = 'mock-api-key';
      (plugin.settings as any).vendor = 'google';
      
      // Create a mock summary leaf with a properly mocked SummaryView
      const mockSummaryView = {
        generateSummary: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockSummaryLeaf = {
        view: mockSummaryView
      } as unknown as WorkspaceLeaf;
      
      // Clear previous mock implementations
      jest.clearAllMocks();
      
      // Mock ensureSummaryViewOpen to return our mock leaf
      const ensureSummaryViewSpy = jest.spyOn(plugin, 'ensureSummaryViewOpen')
        .mockImplementation(() => mockSummaryLeaf);
      
      // Find the command
      const command = mockCommands.find(cmd => cmd.id === 'summarize-selection-in-pane');
      expect(command).toBeDefined();
      
      // Execute the command
      if (command && command.editorCallback) {
        await command.editorCallback(mockEditor, mockView);
      } else {
        fail('Command not found or editorCallback not defined');
      }
      
      // Verify the expected behavior
      expect(ensureSummaryViewSpy).toHaveBeenCalled();
      expect(mockSummaryView.generateSummary).toHaveBeenCalledWith('Test selection', mockFile);
      expect(mockWorkspace.revealLeaf).toHaveBeenCalledWith(mockSummaryLeaf);
    });
  });
});
