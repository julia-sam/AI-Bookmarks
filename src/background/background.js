// Background service worker for AI Knowledge Base extension
import { aiService } from '../services/aiServices.js';
import { storageService } from '../services/storageService.js';

// Add this function near the top of your background.js file, after the imports
const getUserId = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userId'], (result) => {
      if (result.userId) {
        resolve(result.userId);
      } else {
        // Generate a unique user ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        chrome.storage.local.set({ userId }, () => {
          resolve(userId);
        });
      }
    });
  });
};

// Migration function
const migrateExistingEntries = async () => {
  try {
    const userId = await getUserId();
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['entries'], resolve);
    });
    
    const entries = result.entries || [];
    let updatedCount = 0;
    
    const updatedEntries = entries.map(entry => {
      if (!entry.userId) {
        updatedCount++;
        return { ...entry, userId };
      }
      return entry;
    });
    
    if (updatedCount > 0) {
      await new Promise(resolve => {
        chrome.storage.local.set({ entries: updatedEntries }, resolve);
      });
      console.log(`Migrated ${updatedCount} entries to include userId`);
    }
  } catch (error) {
    console.error('Failed to migrate entries:', error);
  }
};

// Initialize the extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('AI Knowledge Base extension installed');
  
  // Create context menu items
  chrome.contextMenus.create({
    id: "save-selected-text",
    title: "Save to AI Bookmarks",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "save-image",
    title: "Save Image to AI Bookmarks",
    contexts: ["image"]
  });
  
  chrome.contextMenus.create({
    id: "open-dashboard",
    title: "Open AI Bookmarks Dashboard",
    contexts: ["page"]
  });

  // Initialize AI service and migrate entries
  try {
    console.log('Starting AI service initialization...');
    await aiService.initialize();
    console.log('AI service initialized successfully');
    
    // Migrate existing entries
    await migrateExistingEntries();
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Failed to initialize AI service:', error);
    console.error('Error details:', error.message, error.stack);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case "save-selected-text":
        await handleSaveSelectedText(info, tab);
        break;
      case "save-image":
        await handleSaveImageFromContext(info, tab);
        break;
      case "open-dashboard":
        await openDashboard();
        break;
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
    safeNotify({
      title: 'Knowledge Base Error',
      message: `Failed: ${error.message}`
    });
  }
});

// Handle saving selected text from context menu
async function handleSaveSelectedText(info, tab) {
  try {
    console.log('=== STARTING TEXT SAVE PROCESS ===');
    console.log('Selected text:', info.selectionText?.substring(0, 100));
    console.log('Tab info:', { url: tab.url, title: tab.title });
    
    const selectedText = info.selectionText;
    if (!selectedText || selectedText.trim().length === 0) {
      throw new Error('No text selected');
    }

    // Get page context
    console.log('Getting page context...');
    const pageContext = await getPageContext(tab.id);
    console.log('Page context retrieved:', pageContext);
    
    const data = {
      text: selectedText,
      pageContext: pageContext
    };

    // Use the unified handler
    await handleSaveHighlightedText(data, tab);
    console.log('=== TEXT SAVE PROCESS COMPLETED ===');
    
  } catch (error) {
    console.error('=== TEXT SAVE PROCESS FAILED ===');
    console.error('Error in handleSaveSelectedText:', error);
    
    safeNotify({
      title: 'Save Failed',
      message: `Failed to save text: ${error.message}`
    });
  }
}

// Handle saving images from context menu
async function handleSaveImageFromContext(info, tab) {
  try {
    console.log('=== STARTING IMAGE SAVE FROM CONTEXT ===');
    const imageUrl = info.srcUrl;
    
    // Try to get image as base64
    let imageData;
    try {
      imageData = await fetchImageAsBase64(imageUrl);
    } catch (error) {
      console.warn('Could not fetch image data, saving URL only:', error);
    }

    const pageContext = await getPageContext(tab.id);
    
    const data = {
      imageUrl: imageUrl,
      imageData: imageData,
      altText: info.linkUrl || '', // Sometimes alt text is in linkUrl
      pageContext: pageContext
    };

    // Use the unified handler
    await handleSaveImage(data, tab);
    console.log('=== IMAGE SAVE FROM CONTEXT COMPLETED ===');
    
  } catch (error) {
    console.error('=== IMAGE SAVE FROM CONTEXT FAILED ===');
    console.error('Error:', error);
    
    safeNotify({
      title: 'Save Failed',
      message: `Failed to save image: ${error.message}`
    });
  }
}

// UNIFIED HANDLERS - Keep only these versions
// Handle saving highlighted text (unified handler for both context menu and messages)
async function handleSaveHighlightedText(data, tab) {
  try {
    console.log('=== BACKGROUND: SAVING HIGHLIGHTED TEXT ===');
    const userId = await getUserId();
    
    // Normalize incoming keys
    const incomingText = data.text || data.selectedText;
    const pageContext = data.pageContext || data.context;
    if (!incomingText) throw new Error('No text provided');

    if (!aiService.isInitialized) {
      console.log('Initializing AI service...');
      await aiService.initialize();
    }
    const context = { url: tab.url, title: tab.title, pageContext };

    console.log('Saving to AI service...');
    const aiResult = await aiService.saveTextEntry(incomingText, context);

    console.log('Saving to local storage...');
    await storageService.saveEntry({
      id: aiResult.id,
      userId: userId,
      type: 'text',
      content: incomingText,
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString(),
      pageContext,
      aiId: aiResult.id
    });

    safeNotify({
      title: 'Text Saved',
      message: `Saved: "${incomingText.substring(0, 50)}${incomingText.length > 50 ? '...' : ''}"`
    });
    console.log('=== BACKGROUND: TEXT SAVED SUCCESSFULLY ===');
    return { success: true, id: aiResult.id };
  } catch (error) {
    console.error('=== BACKGROUND: SAVE FAILED ===');
    console.error('Error saving highlighted text:', error);
    safeNotify({ 
      title: 'Save Failed', 
      message: error.message || 'Unknown error occurred' 
    });
    throw error;
  }
}

// Handle saving images (unified handler)
async function handleSaveImage(data, tab) {
  try {
    console.log('=== BACKGROUND: SAVING IMAGE ===');
    const userId = await getUserId();
    
    console.log('Image data:', data);

    // Initialize AI service if needed
    if (!aiService.isInitialized) {
      console.log('Initializing AI service...');
      await aiService.initialize();
    }

    const context = {
      url: tab.url,
      title: tab.title,
      altText: data.altText,
      pageContext: data.pageContext
    };

    // Save to AI service
    console.log('Saving image to AI service...');
    const aiResult = await aiService.saveImageEntry(data.imageUrl, context);
    console.log('AI service result:', aiResult);

    // Save to local storage
    console.log('Saving to local storage...');
    const storageEntry = {
      id: aiResult.id,
      userId: userId,
      type: 'image',
      imageUrl: data.imageUrl,
      alt: data.altText,
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString(),
      pageContext: data.pageContext,
      aiId: aiResult.id
    };
    
    await storageService.saveEntry(storageEntry);
    console.log('Image saved to local storage');

    // Show success notification
    safeNotify({ title: 'Image Saved', message: 'Image saved to knowledge base' });

    console.log('=== BACKGROUND: IMAGE SAVED SUCCESSFULLY ===');
    return { success: true, id: aiResult.id };

  } catch (error) {
    console.error('=== BACKGROUND: IMAGE SAVE FAILED ===');
    console.error('Error saving image:', error);
    
    safeNotify({ 
      title: 'Save Failed', 
      message: error.message || 'Unknown error occurred' 
    });
    throw error;
  }
}

// Get additional page context
async function getPageContext(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        return {
          selectedText: window.getSelection().toString(),
          nearbyText: getNearbyText(),
          pageTitle: document.title,
          metaDescription: document.querySelector('meta[name="description"]')?.content || '',
          headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 5).map(h => h.textContent.trim())
        };
        
        function getNearbyText() {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.parentElement || range.commonAncestorContainer;
            return container.textContent?.substring(0, 500) || '';
          }
          return '';
        }
      }
    });
    
    return results[0]?.result || {};
  } catch (error) {
    console.error('Failed to get page context:', error);
    return {};
  }
}

// Fetch image as base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return null;
  }
}

// Open dashboard
async function openDashboard() {
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('dashboard.html') 
  });
}

// Set up message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('=== BACKGROUND: RECEIVED MESSAGE ===');
  console.log('Message type:', request.type);
  console.log('Message data:', request);

  switch (request.type) {
    case 'GET_ALL_ENTRIES':
      (async () => {
        try {
          const userId = await getUserId();
          const entries = await storageService.getAllEntries(userId);
          sendResponse(entries);
        } catch (error) {
          console.error('Failed to get all entries:', error);
          sendResponse([]);
        }
      })();
      return true;

    case 'GET_RECENT_ENTRIES':
      (async () => {
        try {
          console.log('Getting recent entries...');
          const userId = await getUserId();
          const entries = await storageService.getRecentEntries(request.limit || 10, userId);
          console.log('Returning', entries.length, 'recent entries');
          sendResponse(entries);
        } catch (error) {
          console.error('Failed to get recent entries:', error);
          sendResponse([]);
        }
      })();
      return true;

    case 'SEARCH_KNOWLEDGE_BASE':
      (async () => {
        try {
          console.log('[bg] search query:', request.query);
          const results = await aiService.searchEntries(request.query);
          console.log('[bg] aiResults length:', results.length);
          
          sendResponse({ 
            success: true, 
            results: results,
            error: null 
          });
          
        } catch (error) {
          console.error('Search failed:', error);
          sendResponse({ 
            success: false, 
            results: [], 
            error: error.message 
          });
        }
      })();
      return true;

    case 'DELETE_ENTRY':
      (async () => {
        try {
          await storageService.deleteEntry(request.entryId);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to delete entry:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'CATEGORIZE_ENTRY':
      (async () => {
        try {
          await storageService.categorizeEntry(request.entryId, request.category);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to categorize entry:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    // Add this case to your message listener switch statement (around line 340)
    case 'SAVE_HIGHLIGHTED_TEXT':
      (async () => {
        try {
          console.log('=== HANDLING SAVE_HIGHLIGHTED_TEXT MESSAGE ===');
          console.log('Request data:', request);
          const result = await handleSaveHighlightedText(request, sender.tab);
          sendResponse({ success: true, id: result.id });
        } catch (error) {
          console.error('Failed to save highlighted text from content:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'SAVE_IMAGE':
      (async () => {
        try {
          console.log('=== HANDLING SAVE_IMAGE MESSAGE ===');
          console.log('Request data:', request);
          const result = await handleSaveImage(request, sender.tab);
          sendResponse({ success: true, id: result.id });
        } catch (error) {
          console.error('Failed to save image from content:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      console.log('Unknown message type:', request.type);
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

// Utility function for safe notifications
const ICON_48 = 'icons/icon48.png';

function safeNotify({ title = 'AI KB', message = '' } = {}) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: ICON_48,
      title,
      message
    });
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

console.log('Background script loaded and ready');
