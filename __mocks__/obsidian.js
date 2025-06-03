// Mock for Obsidian API
module.exports = {
  // Classes
  PluginSettingTab: class {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = document.createElement('div');
      // Add DOM manipulation methods
      this.containerEl.empty = jest.fn();
      this.containerEl.addClass = jest.fn();
      this.containerEl.removeClass = jest.fn();
      this.containerEl.createEl = jest.fn().mockImplementation((tag, attrs) => {
        const el = document.createElement(tag);
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        el.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        return el;
      });
      this.containerEl.createDiv = jest.fn().mockImplementation((cls) => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        return div;
      });
    }
    display() {}
    hide() {}
  },
  
  Modal: class {
    constructor(app) {
      this.app = app;
      this.contentEl = document.createElement('div');
      // Add DOM manipulation methods
      this.contentEl.empty = jest.fn();
      this.contentEl.addClass = jest.fn();
      this.contentEl.removeClass = jest.fn();
      this.contentEl.createEl = jest.fn().mockImplementation((tag, attrs) => {
        const el = document.createElement(tag);
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        el.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        return el;
      });
      this.contentEl.createDiv = jest.fn().mockImplementation((cls) => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        return div;
      });
    }
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
  },
  
  ItemView: class {
    constructor(leaf) {
      this.leaf = leaf;
      this.contentEl = document.createElement('div');
      // Add DOM manipulation methods
      this.contentEl.empty = jest.fn();
      this.contentEl.addClass = jest.fn();
      this.contentEl.removeClass = jest.fn();
      this.contentEl.createEl = jest.fn().mockImplementation((tag, attrs) => {
        const el = document.createElement(tag);
        el.empty = jest.fn();
        el.addClass = jest.fn();
        el.removeClass = jest.fn();
        el.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        el.createDiv = jest.fn().mockReturnValue(document.createElement('div'));
        el.createSpan = jest.fn().mockReturnValue(document.createElement('span'));
        return el;
      });
      this.contentEl.createDiv = jest.fn().mockImplementation((cls) => {
        const div = document.createElement('div');
        div.empty = jest.fn();
        div.addClass = jest.fn();
        div.removeClass = jest.fn();
        div.createEl = jest.fn().mockReturnValue(document.createElement('div'));
        div.createDiv = jest.fn().mockReturnValue(document.createElement('div'));
        div.createSpan = jest.fn().mockReturnValue(document.createElement('span'));
        return div;
      });
      this.contentEl.createSpan = jest.fn().mockReturnValue(document.createElement('span'));
    }
    getViewType() { return 'mock-view'; }
    getDisplayText() { return 'Mock View'; }
    onload() {}
    onunload() {}
  },
  
  WorkspaceLeaf: class {
    constructor() {
      this.view = null;
    }
    getViewState() { return { type: 'mock-view' }; }
    setViewState(state) { return Promise.resolve(); }
  },
  
  MarkdownView: class {
    constructor() {
      this.editor = {
        getSelection: () => 'Mock selection'
      };
      this.file = {
        path: 'mock/path.md',
        basename: 'path'
      };
    }
  },
  
  MarkdownRenderer: {
    renderMarkdown: (markdown, el, sourcePath, component) => {
      el.innerHTML = markdown;
      return Promise.resolve();
    }
  },
  
  TFile: class {
    constructor(path, basename) {
      this.path = path;
      this.basename = basename || path.split('/').pop().replace('.md', '');
    }
  },
  
  // UI Components
  Setting: class {
    constructor(containerEl) {
      this.containerEl = containerEl;
    }
    setName(name) { return this; }
    setDesc(desc) { return this; }
    addText(cb) { return this; }
    addDropdown(cb) { return this; }
    addButton(cb) { return this; }
  },
  
  ButtonComponent: class {
    constructor(containerEl) {
      this.containerEl = containerEl;
    }
    setButtonText(text) { return this; }
    setIcon(icon) { return this; }
    onClick(callback) { return this; }
    setClass(className) { return this; }
  },
  
  DropdownComponent: class {
    constructor(containerEl) {
      this.containerEl = containerEl;
    }
    addOption(value, display) { return this; }
    setValue(value) { return this; }
    onChange(callback) { return this; }
  },
  
  // Utilities
  Notice: jest.fn(),
  
  // Plugin API
  Plugin: class {
    constructor(app, manifest) {
      this.app = app;
      this.manifest = manifest;
    }
    
    addRibbonIcon(icon, title, callback) { return { remove: () => {} }; }
    addStatusBarItem() { return document.createElement('div'); }
    addCommand(command) { return { id: command.id }; }
    addSettingTab(tab) {}
    registerView(type, viewCreator) {}
    registerEvents() {}
    loadData() { return Promise.resolve({}); }
    saveData(data) { return Promise.resolve(); }
  }
};
