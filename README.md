# AI Bookmarks Chrome Extension

A Chrome extension that allows you to save highlighted text and images from any webpage to an AI-powered bookmarks using Pinecone vector database and Hugging Face embeddings.

<img src="https://github.com/julia-sam/AI-Bookmarks/blob/master/popup.png?raw=true" width="300" height="600">
<img src="https://github.com/julia-sam/AI-Bookmarks/blob/master/dashboard.png?raw=true" width="600" height="600">

## Features

- **Text Highlighting**: Select any text on a webpage and save it to your bookmarks with context
- **Image Saving**: Right-click any image and save it to your bookmarks
- **Semantic Search**: Find saved content by meaning, not just keywords
- **Smart Context**: Automatically captures surrounding context and page information
- **Categorization**: Organize entries with custom categories
- **Cross-Page Access**: Access your bookmarks from any webpage
- **Visual Interface**: Clean React-based popup and web dashboard

## How It Works

1. **Save Content**: Highlight text or right-click images to save them
2. **AI Processing**: Content is processed using Hugging Face embeddings
3. **Vector Storage**: Embeddings are stored in Pinecone vector database
4. **Smart Retrieval**: Search uses semantic similarity for intelligent results

## Usage

### Saving Content

#### Text Highlighting
- **Method 1**: Highlight text on any webpage
- **Method 2**: Use keyboard shortcut `Ctrl+Shift+S` (Cmd+Shift+S on Mac)
- **Method 3**: Right-click selected text and choose "Save to AI Bookmarks"

#### Image Saving
- Right-click any image and select "Save Image to AI Bookmarks"
- Images are saved with their URL, alt text, and surrounding context

### Searching Your AI Bookmarks

- **Via Popup**: Click extension icon → Search tab → enter query
- **Semantic Search**: Search by meaning - "machine learning concepts" will find relevant content even if those exact words aren't in the saved text
- **Context-Aware**: Results include surrounding context and source information

### Organization

- **Categories**: Assign categories to entries for better organization
- **Recent View**: Quick access to recently saved content
- **Contextual Information**: Each entry includes source page, nearby headings, and timestamp

## Features in Detail

### Smart Context Capture
- Automatically extracts surrounding text for better context
- Captures nearby headings for reference
- Stores page title, URL, and metadata

### Visual Indicators
- **Keyboard Shortcuts**: Quick access with customizable shortcuts
- **Success Feedback**: Visual confirmation when content is saved

### Search Capabilities
- **Semantic Search**: Uses AI embeddings to find content by meaning
- **Relevance Scoring**: Results ranked by similarity
- **Metadata Display**: Shows source, date, and context for each result

### Data Management
- **Categories**: Organize content with custom categories
- **Statistics**: Track usage patterns and content types
- **Export/Import**: Backup and transfer your knowledge base

## User Interface

### Content Script Features
- **Text Selection Detection**: Automatically detects text selection
- **Visual Feedback**: Loading, success, and error states
- **Keyboard Shortcuts**: Quick save functionality
- **Context Menu Integration**: Right-click options for images

### Popup Interface
- **Search Tab**: Semantic search with results display
- **Recent Tab**: Quick access to recently saved content
- **Settings Tab**: API configuration and usage instructions
- **Category Management**: Organize and filter content

## Privacy & Security

- All content is stored in your personal Pinecone index
- API keys stored locally in Chrome storage (encrypted by Chrome)
- No data sent to third parties except Hugging Face and Pinecone APIs
- Content processing happens via secure API calls
- Local storage used for caching and quick access

## Keyboard Shortcuts

- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac): Save selected text
- `Ctrl+Shift+K` (Windows/Linux) or `Cmd+Shift+K` (Mac): Toggle highlight mode


