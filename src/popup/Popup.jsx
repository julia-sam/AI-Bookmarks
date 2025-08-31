import React, { useState, useEffect } from 'react';

function Popup() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState([
    'Research', 'Work', 'Sports', 'Technology', 'Politics', 'Art', 'Lifestyle', 'Science', 'Health', 'Food'
  ]);
  const [bookmarks, setBookmarks] = useState([]);
  const [hfApiKey, setHfApiKey] = useState('');
  const [pineconeApiKey, setPineconeApiKey] = useState('');

  useEffect(() => {
    loadRecentEntries();
  }, []);

  useEffect(() => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      console.log('Loaded bookmarks:', result.bookmarks);
      setBookmarks(result.bookmarks || []);
    });
  }, []);

  useEffect(() => {
    const checkAPIKeys = async () => {
      const stored = await chrome.storage.local.get(['hfApiKey', 'pineconeApiKey']);
      if (!stored.hfApiKey || !stored.pineconeApiKey) {
        setMessage('Please configure your API keys in the extension options.');
      } else {
        setHfApiKey(stored.hfApiKey);
        setPineconeApiKey(stored.pineconeApiKey);
      }
    };
    
    checkAPIKeys();
  }, []);

  const loadRecentEntries = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_ENTRIES',
        limit: 10
      });
      
      if (response && !response.error) {
        setRecentEntries(response);
      }
    } catch (error) {
      console.error('Failed to load recent entries:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      // Search through recent entries locally instead of using AI service
      const allEntries = await chrome.runtime.sendMessage({
        type: 'GET_ALL_ENTRIES' // New message type to get all entries, not just recent
      });

      const filteredResults = allEntries.filter(entry => {
        const searchTerm = searchQuery.toLowerCase();
        return (
          entry.content?.toLowerCase().includes(searchTerm) ||
          entry.title?.toLowerCase().includes(searchTerm) ||
          entry.alt?.toLowerCase().includes(searchTerm) ||
          entry.url?.toLowerCase().includes(searchTerm) ||
          entry.pageContext?.nearbyHeadings?.some(heading => 
            heading.toLowerCase().includes(searchTerm)
          )
        );
      });

      setSearchResults(filteredResults);
      
    } catch (error) {
      console.error('Search failed:', error);
      setMessage(`Search failed: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEntry = async (entryId) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_ENTRY',
        entryId
      });
      
      // Refresh recent entries
      loadRecentEntries();
      
      // Remove from search results if present
      setSearchResults(results => results.filter(r => r.id !== entryId));
    } catch (error) {
      console.error('Failed to delete entry:', error);
      setMessage('Failed to delete entry');
    }
  };

  const categorizeEntry = async (entryId, category) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CATEGORIZE_ENTRY',
        entryId,
        category
      });
      
      loadRecentEntries();
    } catch (error) {
      console.error('Failed to categorize entry:', error);
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('dashboard.html') 
    });
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const renderEntryCard = (entry, showActions = true) => (
    <div key={entry.id || entry.timestamp} className="entry-card">
      <div className="entry-header">
        <span className={`entry-type ${entry.type}`}>{entry.type}</span>
        <span className="entry-date">
          {new Date(entry.timestamp).toLocaleDateString()}
        </span>
      </div>
      
      {entry.type === 'text' ? (
        <div className="entry-content">
          <p className="entry-text">{entry.content}</p>
          {entry.pageContext?.nearbyHeadings?.length > 0 && (
            <div className="entry-context">
              <strong>Context:</strong> {entry.pageContext.nearbyHeadings[0]}
            </div>
          )}
        </div>
      ) : entry.type === 'image' ? (
        <div className="entry-content">
          <img 
            src={entry.imageUrl} 
            alt={entry.alt || 'Saved image'} 
            className="entry-image"
            onClick={() => window.open(entry.imageUrl, '_blank')}
          />
          {entry.alt && <p className="entry-alt">{entry.alt}</p>}
        </div>
      ) : null}
      
      <div className="entry-footer">
        <a 
          href={entry.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="entry-source"
        >
          {entry.title || new URL(entry.url).hostname}
        </a>
        
        {showActions && (
          <div className="entry-actions">
            <select 
              onChange={(e) => categorizeEntry(entry.id, e.target.value)}
              value={entry.category || ''}
              className="category-select"
            >
              <option value="">No category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button 
              onClick={() => deleteEntry(entry.id)}
              className="delete-btn"
              title="Delete entry"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>AI Bookmarks</h1>
        <div className="tab-buttons">
          <button 
            className={activeTab === 'search' ? 'active' : ''}
            onClick={() => setActiveTab('search')}
          >
            Search
          </button>
          <button 
            className={activeTab === 'recent' ? 'active' : ''}
            onClick={() => setActiveTab('recent')}
          >
            Recent
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Move API key warning here for better visibility */}
      {(!hfApiKey || !pineconeApiKey) && (
        <div className="api-key-warning">
          <p>⚠️ API keys required for full functionality</p>
          <button onClick={openOptions} className="setup-btn">
            Configure API Keys
          </button>
        </div>
      )}

      <div className="popup-content">
        {activeTab === 'search' && (
          <div className="search-tab">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your bookmarks..."
                className="search-input"
              />
              <button type="submit" disabled={isLoading} className="search-btn">
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map(entry => renderEntryCard(entry))
              ) : searchQuery && !isLoading ? (
                <p className="no-results">No results found</p>
              ) : null}
            </div>

            <div className="dashboard-link">
              <button onClick={openDashboard} className="dashboard-btn">
                Open Full Dashboard
              </button>
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="recent-tab">
            <h2>Recent Entries</h2>
            <div className="recent-entries">
              {recentEntries.length > 0 ? (
                recentEntries.map(entry => renderEntryCard(entry))
              ) : (
                <div className="no-entries">
                  <p>No entries yet</p>
                  <p className="help-text">
                    Highlight text on any webpage or right-click images to save them to your bookmarks
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Popup;
