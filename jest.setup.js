// Set up DOM environment for testing
global.document = document;
global.window = window;
global.navigator = {
  userAgent: 'node.js',
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Jest will automatically use the mock from __mocks__/obsidian.js
