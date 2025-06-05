# Obsidian-Link

A powerful plugin for Obsidian that enhances your note-taking experience with AI-powered intelligent search, web scraping, summarization, and content generation capabilities.

## Table of Contents
- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## Features

### Web Scraping
- **Intelligent Content Extraction**: Automatically extracts meaningful content from websites and converts it to well-formatted Markdown
- **CORS-Error Free**: Uses a proxy solution to avoid CORS errors when scraping websites
- **Organized Storage**: All web scrapes are automatically saved to a dedicated "Web scrapes" folder
- **Clean Formatting**: Removes clutter and presents only the valuable content from websites
- **Keyboard Support**: Press Enter to quickly scrape after entering a URL
- **Smart Content Detection**: Automatically identifies and extracts the main content from web pages

### Note Summarization
- **Smart Summarization**: Generate concise, contextually-aware summaries of your notes or selected text
- **New Note Creation**: Summaries are saved as new notes with links back to the original content
- **Customizable Output**: Control the length and style of summaries through plugin settings

### Smart Search
- **AI-Powered Search**: Find relevant information across your vault using natural language
- **Semantic Understanding**: Goes beyond keyword matching to understand the meaning of your search
- **Relevance Explanations**: Provides detailed explanations of why each result is relevant to your query
- **Highlighted Results**: Key sections in search results are highlighted for quick reference
- **Context-Aware**: Understands the context of your notes and search queries
- **Multi-Document Search**: Searches across all your notes to find the most relevant information

### Content Generation & Summarization
- **Context-Aware Generation**: Create new content based on your existing notes and queries
- **Smart Summarization**: Generate concise, contextually-aware summaries of your notes or selected text
- **Customizable Parameters**: Adjust temperature and token limits to control generation style
- **Seamless Integration**: Generated content can be inserted directly into your notes
- **Multiple AI Providers**: Supports Google Gemini, OpenAI, and Anthropic models
- **Model Selection**: Choose the best AI model for your specific needs

## How It Works

Obsidian-Link leverages powerful AI models to enhance your Obsidian experience:

1. **API Integration**: The plugin communicates with advanced AI services to process your requests
2. **Local Processing**: Your vault's content is processed locally for search indexing
3. **Secure Authentication**: Your API key is stored securely and used only for authorized requests
4. **Modular Architecture**: The plugin uses separate services for web scraping, summarization, search, and highlighting

## Installation

### Method 1: Manual Installation
1. Download the latest release from the [GitHub repository](https://github.com/BrettMiller99/obsidian-link/releases)
2. Extract the zip file into your Obsidian plugins folder: `{vault}/.obsidian/plugins/obsidian-link/`
3. Restart Obsidian
4. Enable the plugin in Obsidian settings > Community plugins

### Method 2: Using BRAT (Beta Reviewer's Auto-update Tool)
1. Install the BRAT plugin from Obsidian's Community Plugins
2. Add the repository URL in BRAT settings
3. Click "Add Plugin"
4. Enable the plugin in Obsidian settings > Community plugins

## Configuration

1. Get an API key from one of the supported AI providers:
   - [Google AI Studio](https://aistudio.google.com/) for Gemini models
   - [OpenAI](https://platform.openai.com/) for GPT models
   - [Anthropic](https://console.anthropic.com/) for Claude models

2. Set up your chosen API key using one of these methods:
   - **Plugin Settings (Recommended)**: 
     - Go to Settings > Community Plugins > Obsidian-Link
     - Enter your API key in the designated field
   - **Environment File (For Development)**: 
     - Copy `.env.example` to `.env` in the project root
     - Add your API key: `GEMINI_API_KEY=your_api_key_here`

3. Configure optional settings:
   - Model selection (Gemini Pro or other available models)
   - Temperature (controls creativity level)
   - Maximum tokens for responses
   - Default folder for web scrapes and summaries

## Usage

### Web Scraping
1. Click the globe icon in the ribbon or use the command palette (Ctrl+P) and search for "Gemini: Scrape Website"
2. Enter the URL of the website you want to scrape
3. Press Enter or click "Scrape"
4. A new note will be created in the "Web scrapes" folder with the extracted content

### Note Summarization
1. Select text in your note that you want to summarize
2. Use the command palette (Ctrl+P) and select "Gemini: Summarize Selection"
3. A new note will be created with the AI-generated summary and a link back to the original note

### Smart Search
1. Use the command palette (Ctrl+P) and search for "Gemini: Smart Search"
2. Enter your search query using natural language
3. Press Enter to execute the search
4. Review results with relevance explanations and highlighted key sections
5. Click on a result to open the note with highlights automatically applied

## Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Obsidian API knowledge

### Setup
```bash
# Clone the repository
git clone https://github.com/BrettMiller99/obsidian-link.git

# Install dependencies
cd obsidian-link
npm install

# Build the plugin
npm run build
```

## Changelog

### v1.0.0 (Current)
- Initial release with core functionality
- Web scraping with intelligent content extraction
- Note summarization with context awareness
- AI-powered smart search
- Content generation capabilities

## Contributing

Contributions are welcome! If you'd like to contribute to Obsidian-Link, please follow these steps:

1. Fork the repository
2. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request

Please ensure your code follows the project's coding standards and includes appropriate tests.

## License

MIT
