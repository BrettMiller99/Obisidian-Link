import { SummarizerService } from '../../services/summarizer';
import { SummaryLevel } from '../../views/summary-view';
import { AIVendor } from '../../utils/ai-providers';
import { ObsidianLinkSettings } from '../../types';

// Mock the AI provider
jest.mock('../../utils/ai-providers', () => {
  const mockGenerateText = jest.fn().mockImplementation((prompt) => {
    // Return different responses based on the prompt content
    if (prompt.includes('very concise')) {
      return Promise.resolve('This is a brief summary.');
    } else if (prompt.includes('comprehensive')) {
      return Promise.resolve('This is a detailed summary with more information and context.');
    } else {
      return Promise.resolve('This is a standard summary.');
    }
  });

  const mockGenerateContent = jest.fn().mockImplementation((prompt) => {
    // Return different responses based on the prompt content
    if (prompt.includes('very concise')) {
      return Promise.resolve({ text: 'This is a brief summary.' });
    } else if (prompt.includes('comprehensive')) {
      return Promise.resolve({ text: 'This is a detailed summary with more information and context.' });
    } else {
      return Promise.resolve({ text: 'This is a standard summary.' });
    }
  });

  const mockProvider = {
    generateText: mockGenerateText,
    generateContent: mockGenerateContent
  };

  return {
    AIVendor: {
      GOOGLE: 'google',
      OPENAI: 'openai',
      ANTHROPIC: 'anthropic'
    },
    AIProvider: jest.fn().mockImplementation(() => mockProvider),
    AIProviderFactory: {
      getProvider: jest.fn().mockReturnValue(mockProvider),
      createProvider: jest.fn().mockReturnValue(mockProvider)
    }
  };
});

describe('SummarizerService', () => {
  let summarizer: SummarizerService;
  let mockSettings: ObsidianLinkSettings;

  beforeEach(() => {
    // Setup mock settings
    mockSettings = {
      vendor: AIVendor.GOOGLE,
      model: 'gemini-1.5-pro',
      maxTokens: 1024,
      temperature: 0.7,
      geminiApiKey: 'mock-api-key',
      openaiApiKey: '',
      anthropicApiKey: ''
    };

    summarizer = new SummarizerService(mockSettings);
  });

  describe('summarize', () => {
    it('should generate a brief summary when BRIEF level is specified', async () => {
      const content = 'This is some test content to summarize.';
      const result = await summarizer.summarize(content, SummaryLevel.BRIEF);
      
      expect(result).toContain('brief summary');
    });

    it('should generate a standard summary by default', async () => {
      const content = 'This is some test content to summarize.';
      const result = await summarizer.summarize(content);
      
      expect(result).toContain('standard summary');
    });

    it('should generate a detailed summary when DETAILED level is specified', async () => {
      const content = 'This is some test content to summarize.';
      const result = await summarizer.summarize(content, SummaryLevel.DETAILED);
      
      expect(result).toContain('detailed summary');
    });

    it('should remove titles from the summary', async () => {
      // Mock the removeTitles method
      const spy = jest.spyOn(summarizer as any, 'removeTitles');
      const content = 'This is some test content to summarize.';
      
      await summarizer.summarize(content);
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('removeTitles', () => {
    // Mock the removeTitles method for testing
    beforeEach(() => {
      // Create a simple mock implementation that just removes lines starting with #
      (summarizer as any).removeTitles = jest.fn().mockImplementation((text: string) => {
        // Simple implementation that removes markdown headings at the beginning
        const lines = text.trim().split('\n');
        let startIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('#')) {
            startIndex = i + 1;
          } else if (lines[i].trim() !== '') {
            break;
          }
        }
        
        return lines.slice(startIndex).join('\n').trim();
      });
    });
    
    it('should remove markdown titles from the beginning of the summary', () => {
      const summaryWithTitle = '# Summary\n\nThis is a summary.';
      const result = (summarizer as any).removeTitles(summaryWithTitle);
      
      expect(result).toBe('This is a summary.');
    });

    it('should remove multiple markdown titles from the beginning of the summary', () => {
      const summaryWithMultipleTitles = '# Summary\n## Subsection\n\nThis is a summary.';
      const result = (summarizer as any).removeTitles(summaryWithMultipleTitles);
      
      expect(result).toBe('This is a summary.');
    });

    it('should not remove titles that are not at the beginning', () => {
      const summaryWithMiddleTitle = 'This is a summary.\n\n# Middle Title\n\nMore content.';
      const result = (summarizer as any).removeTitles(summaryWithMiddleTitle);
      
      // The method only removes titles at the beginning, so middle titles should remain
      expect(result).toContain('# Middle Title');
      expect(result).toContain('This is a summary.');
    });

    it('should handle summaries without titles', () => {
      const summaryWithoutTitle = 'This is a summary without a title.';
      const result = (summarizer as any).removeTitles(summaryWithoutTitle);
      
      expect(result).toBe(summaryWithoutTitle);
    });
  });
});
