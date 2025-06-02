# Obsidian-Gemini Link

A plugin for Obsidian that integrates with Google's Gemini AI to enhance your note-taking experience.

## Features

- **Web Scraping**: Extract meaningful content from websites directly into your Obsidian notes
- **Note Summarization**: Generate concise summaries of your notes using Gemini AI
- **Smart Search**: Use AI-powered search to find relevant information across your vault
- **Content Generation**: Generate content based on your existing notes and queries

## Installation

1. Download the latest release from the GitHub repository
2. Extract the zip file into your Obsidian plugins folder: `{vault}/.obsidian/plugins/`
3. Enable the plugin in Obsidian settings > Community plugins

## Configuration

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Set up your API key using one of these methods:
   - **Environment File (Recommended for Development)**: 
     - Copy `.env.example` to `.env` in the project root
     - Add your API key to the `.env` file: `GEMINI_API_KEY=your_api_key_here`
     - The `.env` file is git-ignored for security
   - **Plugin Settings**: Enter your API key in the plugin settings panel in Obsidian

## Usage

### Web Scraping
Use the command palette (Ctrl+P) and search for "Gemini: Scrape Website" or use the ribbon icon.

### Note Summarization
Select text in your note and use the command palette to select "Gemini: Summarize Selection" or right-click and select from the context menu.

### Smart Search
Use the command palette and search for "Gemini: Smart Search" to search your vault with AI assistance.

## Development

### Prerequisites
- Node.js 16+
- npm or yarn
- Obsidian API knowledge

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-gemini-link.git

# Install dependencies
cd obsidian-gemini-link
npm install

# Build the plugin
npm run build
```

## License

MIT
