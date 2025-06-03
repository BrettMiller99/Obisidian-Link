export enum AIVendor {
  GOOGLE = 'google',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic'
}

export class AIProvider {
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  apiKey: string;

  generateText = jest.fn().mockImplementation((prompt: string) => {
    return Promise.resolve('This is mock AI-generated text.');
  });
}

export class AIProviderFactory {
  static getProvider(vendor: AIVendor, apiKey: string): AIProvider {
    return new AIProvider(apiKey);
  }
  
  static createProvider(options: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  }): AIProvider {
    return new AIProvider(options.apiKey);
  }
}
