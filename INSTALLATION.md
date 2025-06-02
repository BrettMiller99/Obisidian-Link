# Installation Guide

This guide will help you set up and install the Obsidian-Gemini Link plugin for development and testing.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Obsidian](https://obsidian.md/) (v0.15.0 or higher)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

## Development Setup

1. Clone this repository to your local machine:

```bash
git clone https://github.com/yourusername/obsidian-gemini-link.git
cd obsidian-gemini-link
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Build the plugin:

```bash
npm run build
# or
yarn build
```

4. Create a symbolic link to your Obsidian plugins folder:

For testing during development, you can create a symbolic link from your development folder to your Obsidian plugins folder.

**macOS/Linux:**
```bash
ln -s /path/to/obsidian-gemini-link /path/to/your/obsidian/vault/.obsidian/plugins/obsidian-gemini-link
```

**Windows:**
```bash
mklink /D "C:\path\to\your\obsidian\vault\.obsidian\plugins\obsidian-gemini-link" "C:\path\to\obsidian-gemini-link"
```

5. Enable the plugin in Obsidian:
   - Open Obsidian
   - Go to Settings > Community plugins
   - Turn off "Safe mode" if it's on
   - Enable "Gemini Link" from the list of installed plugins

## Getting a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Navigate to the API keys section
4. Create a new API key
5. Copy the API key and paste it into the plugin settings in Obsidian

## Configuration

After installing the plugin:

1. Open Obsidian Settings
2. Navigate to the "Gemini Link" section
3. Enter your Gemini API key
4. Configure other settings as needed:
   - Model selection (Gemini Pro or Gemini Pro Vision)
   - Max tokens for generation
   - Temperature setting for creativity

## Troubleshooting

If you encounter any issues:

- Check the console for error messages (Ctrl+Shift+I in Obsidian)
- Ensure your API key is valid and has not expired
- Verify that you have an active internet connection
- Make sure you're using a compatible version of Obsidian

## Support

If you need help or want to report a bug, please open an issue on the GitHub repository.
