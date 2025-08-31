// Content script for AI Knowledge Base extension
console.log('AI Knowledge Base content script loaded');

// State management
let lastSelection = null;

// Initialize content script
initialize();

function initialize() {
  console.log('Initializing content script...');
  
  // Listen for image interactions
  document.addEventListener('contextmenu', handleRightClick);
  document.addEventListener('mouseover', handleImageHover);
  document.addEventListener('mouseout', handleImageMouseOut);
  
  // Listen for text selection for context menu
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('keyup', handleTextSelection);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle text selection (store for context menu use)
function handleTextSelection(event) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    // Store current selection for context menu
    lastSelection = {
      text: selectedText,
      range: selection.getRangeAt(0).cloneRange(),
      context: getSelectionContext(selection),
      timestamp: new Date().toISOString()
    };
    
    console.log('Text selection stored for context menu:', selectedText.substring(0, 50));
  } else {
    lastSelection = null;
  }
}

// Handle right-click events
function handleRightClick(event) {
  const target = event.target;
  
  // Handle image right-click
  if (target.tagName === 'IMG' && target.src) {
    console.log('Right-clicked on image:', target.src);
    // Context menu will handle this via background script
  }
  
  // Handle text selection right-click
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    console.log('Right-clicked on selected text:', selectedText.substring(0, 50));
    // Context menu will handle this via background script
  }
}

// Handle image hover (visual feedback)
function handleImageHover(event) {
  const target = event.target;
  
  if (target.tagName === 'IMG' && target.src && !target.hasAttribute('data-kb-hover')) {
    target.setAttribute('data-kb-hover', 'true');
    
    // Store original title
    if (target.title) {
      target.setAttribute('data-original-title', target.title);
    }
    
    // Add visual indication and tooltip
    target.style.outline = '2px solid #4285f4';
    target.style.outlineOffset = '2px';
    target.title = (target.getAttribute('data-original-title') || target.alt || '') + ' (Right-click to save to AI Bookmarks)';
  }
}

// Handle image mouse out
function handleImageMouseOut(event) {
  const target = event.target;
  
  if (target.tagName === 'IMG' && target.hasAttribute('data-kb-hover')) {
    target.removeAttribute('data-kb-hover');
    target.style.outline = '';
    target.style.outlineOffset = '';
    
    // Restore original title
    const originalTitle = target.getAttribute('data-original-title');
    if (originalTitle) {
      target.title = originalTitle;
      target.removeAttribute('data-original-title');
    } else {
      target.title = target.alt || '';
    }
  }
}

// Get context around selection
function getSelectionContext(selection) {
  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement || range.commonAncestorContainer;
    
    // Get surrounding text
    const contextRange = document.createRange();
    contextRange.selectNodeContents(container);
    const fullText = contextRange.toString();
    
    // Find selected text position and extract context
    const selectedText = selection.toString();
    const selectedIndex = fullText.indexOf(selectedText);
    
    const contextStart = Math.max(0, selectedIndex - 200);
    const contextEnd = Math.min(fullText.length, selectedIndex + selectedText.length + 200);
    
    return {
      before: fullText.substring(contextStart, selectedIndex).trim(),
      after: fullText.substring(selectedIndex + selectedText.length, contextEnd).trim(),
      containingElement: container.tagName || 'TEXT',
      nearbyHeadings: getNearbyHeadings(container),
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  } catch (error) {
    console.error('Error getting selection context:', error);
    return {
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  }
}

// Get nearby headings for context
function getNearbyHeadings(elementOrSelection) {
  const headings = [];
  let element;

  // Handle both selection objects and DOM elements
  if (elementOrSelection && elementOrSelection.rangeCount) {
    // It's a selection object
    const range = elementOrSelection.getRangeAt(0);
    element = range.commonAncestorContainer;
    
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
  } else {
    // It's a DOM element
    element = elementOrSelection;
  }

  if (!element) return headings;
  
  // Look for headings in parent elements
  let current = element;
  while (current && current !== document.body && headings.length < 3) {
    if (current.tagName && /^H[1-6]$/.test(current.tagName)) {
      headings.unshift(current.textContent.trim());
    }
    current = current.parentElement;
  }
  
  // Look for nearby headings if it was a selection
  if (elementOrSelection && elementOrSelection.rangeCount) {
    const range = elementOrSelection.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    for (const heading of allHeadings) {
      if (headings.length >= 5) break;
      
      const headingRect = heading.getBoundingClientRect();
      const distance = Math.abs(headingRect.top - rangeRect.top);
      
      if (distance < 200 && !headings.includes(heading.textContent.trim())) {
        headings.push(heading.textContent.trim());
      }
    }
  }
  
  return headings;
}

// Save selected text (called from background script via context menu)
function saveSelectedText() {
  console.log('=== CONTENT: SAVING SELECTED TEXT ===');
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText && (!lastSelection || !lastSelection.text)) {
    console.log('No text selected');
    showMessage('Please select some text first', 'error');
    return;
  }

  const textToSave = selectedText || lastSelection.text;
  console.log('Selected text:', textToSave.substring(0, 100));

  // Show saving message
  showMessage('Saving text...', 'info');

  // Get page context
  const pageContext = {
    selectedText: textToSave,
    nearbyText: getNearbyText(selection.rangeCount > 0 ? selection : null),
    pageTitle: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 5).map(h => h.textContent.trim()),
    nearbyHeadings: getNearbyHeadings(selection.rangeCount > 0 ? selection : lastSelection?.context?.nearbyHeadings || [])
  };

  console.log('Sending message to background script...');

  // Send message to background script
  chrome.runtime.sendMessage({
    type: 'SAVE_HIGHLIGHTED_TEXT',
    text: textToSave,
    selectedText: textToSave,
    pageContext: pageContext
  }, (response) => {
    console.log('Response received:', response);
    
    if (chrome.runtime.lastError) {
      console.error('Error saving text:', chrome.runtime.lastError);
      showMessage('Error saving text: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.success) {
      console.log('Text saved successfully:', response);
      showMessage('Text saved to knowledge base!', 'success');
      // Clear selection after successful save
      window.getSelection().removeAllRanges();
      lastSelection = null;
    } else {
      const errorMsg = response?.error || 'Failed to save text';
      console.error('Failed to save text:', errorMsg);
      showMessage(errorMsg, 'error');
    }
  });
}

// Helper function to get nearby text
function getNearbyText(selection) {
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.parentElement || range.commonAncestorContainer;
    return container.textContent?.substring(0, 500) || '';
  }
  return '';
}

// Save image function
function saveImage(img) {
  console.log('=== CONTENT: SAVING IMAGE ===');
  console.log('Image URL:', img.src);
  console.log('Image alt:', img.alt);
  
  // Show loading message
  showMessage('Saving image...', 'info');
  
  const imageData = {
    imageUrl: img.src,
    altText: img.alt || img.title || '',
    pageContext: {
      pageTitle: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 5).map(h => h.textContent.trim()),
      nearbyHeadings: getNearbyHeadingsForElement(img),
      imageCaption: getImageCaption(img),
      imageContext: getImageContext(img)
    }
  };

  console.log('Sending image save message:', imageData);

  chrome.runtime.sendMessage({
    type: 'SAVE_IMAGE',
    imageUrl: imageData.imageUrl,
    altText: imageData.altText,
    pageContext: imageData.pageContext
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error saving image:', chrome.runtime.lastError);
      showMessage('Error saving image: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.success) {
      console.log('Image saved successfully:', response);
      showMessage('Image saved to knowledge base!', 'success');
    } else {
      console.error('Failed to save image:', response?.error);
      showMessage(response?.error || 'Failed to save image', 'error');
    }
  });
}

// Helper function to get nearby headings for an element
function getNearbyHeadingsForElement(element) {
  const headings = [];
  let current = element;
  
  // Look up the DOM tree for headings
  while (current && current !== document.body && headings.length < 3) {
    if (current.tagName && /^H[1-6]$/.test(current.tagName)) {
      headings.unshift(current.textContent.trim());
    }
    current = current.parentElement;
  }
  
  // Look for nearby headings
  if (headings.length < 3) {
    const rect = element.getBoundingClientRect();
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    for (const heading of allHeadings) {
      if (headings.length >= 5) break;
      
      const headingRect = heading.getBoundingClientRect();
      const distance = Math.abs(headingRect.top - rect.top);
      
      if (distance < 300 && !headings.includes(heading.textContent.trim())) {
        headings.push(heading.textContent.trim());
      }
    }
  }
  
  return headings;
}

// Get image caption
function getImageCaption(img) {
  // Look for figure caption
  const figure = img.closest('figure');
  if (figure) {
    const caption = figure.querySelector('figcaption');
    if (caption) return caption.textContent.trim();
  }
  
  // Look for nearby caption-like elements
  const parent = img.parentElement;
  if (parent) {
    const caption = parent.querySelector('.caption, .image-caption, .wp-caption-text');
    if (caption) return caption.textContent.trim();
  }
  
  return '';
}

// Get image context
function getImageContext(img) {
  const context = [];
  
  // Get surrounding text
  let element = img.parentElement;
  while (element && context.length < 3) {
    const text = element.textContent?.trim();
    if (text && text.length > 20 && text !== img.alt) {
      context.push(text.substring(0, 200));
    }
    element = element.parentElement;
  }
  
  return context;
}

// Show message to user
function showMessage(text, type = 'success') {
  console.log('Showing message:', text, type);
  
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.kb-message');
  existingMessages.forEach(msg => msg.remove());
  
  const message = document.createElement('div');
  message.className = 'kb-message';
  message.textContent = text;
  
  let bgColor = '#4CAF50'; // success
  if (type === 'error') bgColor = '#f44336';
  if (type === 'info') bgColor = '#2196F3';
  if (type === 'warning') bgColor = '#ff9800';
  
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(message);
  
  setTimeout(() => {
    if (message.parentNode) {
      message.parentNode.removeChild(message);
    }
  }, 3000);
}

// Handle messages from background script
function handleMessage(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'SAVE_IMAGE_FROM_CONTEXT':
      // Handle saving image from context menu
      if (message.imageUrl) {
        const img = { 
          src: message.imageUrl, 
          alt: message.altText || '', 
          title: message.altText || '' 
        };
        saveImage(img);
      }
      break;
    
    case 'SAVE_TEXT_FROM_CONTEXT':
      // Handle saving text from context menu
      saveSelectedText();
      break;
    
    case 'SEARCH_RESULTS':
      // Handle search results if needed
      break;
    
    case 'GET_SELECTION':
      sendResponse({
        text: lastSelection?.text || '',
        context: lastSelection?.context || {}
      });
      break;
    
    default:
      console.log('Unknown message type:', message.type);
  }
}

// Display search results (for future search overlay)
function displaySearchResults(results) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<p style="padding: 10px; color: #666;">No results found</p>';
    return;
  }
  
  resultsContainer.innerHTML = results.map(result => `
    <div style="
      padding: 10px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
    " onclick="window.open('${result.metadata.url}', '_blank')">
      <h4 style="margin: 0 0 5px 0; font-size: 14px;">${result.metadata.title || 'Untitled'}</h4>
      <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">
        ${result.metadata.content?.substring(0, 150) || ''}...
      </p>
      <small style="color: #999;">Score: ${result.score?.toFixed(3)}</small>
    </div>
  `).join('');
}

console.log('Content script initialization complete');
