import { AIVendor } from '../utils/ai-providers';

export interface ObsidianLinkSettings {
  vendor: AIVendor;
  model: string;
  maxTokens: number;
  temperature: number;
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
}

export function getApiKeyForVendor(settings: ObsidianLinkSettings, vendor: AIVendor): string {
  switch (vendor) {
    case AIVendor.GOOGLE:
      return settings.geminiApiKey;
    case AIVendor.OPENAI:
      return settings.openaiApiKey;
    case AIVendor.ANTHROPIC:
      return settings.anthropicApiKey;
    default:
      return '';
  }
}
