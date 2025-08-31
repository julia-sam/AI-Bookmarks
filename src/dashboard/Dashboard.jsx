import React, { useState, useEffect } from 'react';

function Dashboard() {
  const [bookmarks, setBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    textEntries: 0,
    imageEntries: 0,
    categories: {}
  });

  const categories = ['All', 'Research', 'Work', 'Sports', 'Technology', 'Politics', 'Art', 'Lifestyle', 'Science', 'Health', 'Food'];
  const types = ['All', 'text', 'image'];

  useEffect(() => {
    loadBookmarks();
  }, []);

  useEffect(() => {
    filterBookmarks();
  }, [bookmarks, searchTerm, selectedCategory, selectedType]);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_ENTRIES'
      });

      if (response && Array.isArray(response)) {
        setBookmarks(response);
        calculateStats(response);
      } else {
        setBookmarks([]);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
      setError('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const textEntries = data.filter(item => item.type === 'text').length;
    const imageEntries = data.filter(item => item.type === 'image').length;
    
    const categoryCounts = {};
    data.forEach(item => {
      const category = item.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    setStats({
      total: data.length,
      textEntries,
      imageEntries,
      categories: categoryCounts
    });
  };

  const filterBookmarks = () => {
    let filtered = bookmarks;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bookmark =>
        bookmark.content?.toLowerCase().includes(term) ||
        bookmark.title?.toLowerCase().includes(term) ||
        bookmark.alt?.toLowerCase().includes(term) ||
        bookmark.url?.toLowerCase().includes(term) ||
        bookmark.pageContext?.nearbyHeadings?.some(heading => 
          heading.toLowerCase().includes(term)
        )
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(bookmark => 
        bookmark.category === selectedCategory || 
        (selectedCategory === 'Uncategorized' && !bookmark.category)
      );
    }

    // Filter by type
    if (selectedType !== 'All') {
      filtered = filtered.filter(bookmark => bookmark.type === selectedType);
    }

    setFilteredBookmarks(filtered);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
  };

  const deleteBookmark = async (id) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_ENTRY',
        entryId: id
      });
      
      // Refresh bookmarks
      loadBookmarks();
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      setError('Failed to delete bookmark');
    }
  };

  const categorizeBookmark = async (id, category) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CATEGORIZE_ENTRY',
        entryId: id,
        category
      });
      
      // Update local state
      setBookmarks(prev => prev.map(bookmark => 
        bookmark.id === id ? { ...bookmark, category } : bookmark
      ));
    } catch (error) {
      console.error('Failed to categorize bookmark:', error);
      setError('Failed to categorize bookmark');
    }
  };

  const clearAllBookmarks = async () => {
    if (!confirm('Are you sure you want to delete ALL bookmarks? This cannot be undone.')) return;

    try {
      // Delete each bookmark
      for (const bookmark of bookmarks) {
        await chrome.runtime.sendMessage({
          type: 'DELETE_ENTRY',
          entryId: bookmark.id
        });
      }
      
      loadBookmarks();
    } catch (error) {
      console.error('Failed to clear bookmarks:', error);
      setError('Failed to clear bookmarks');
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your bookmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>AI Bookmarks Dashboard</h1>
          <div className="header-actions">
            <button onClick={clearAllBookmarks} className="btn btn-danger">
              Clear All
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-btn">×</button>
        </div>
      )}

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="stats-section">
            <h3>Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.textEntries}</div>
                <div className="stat-label">Text</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.imageEntries}</div>
                <div className="stat-label">Images</div>
              </div>
            </div>
          </div>

          <div className="filters-section">
            <h3>Filters</h3>
            
            <div className="filter-group">
              <label>Category</label>
              <div className="filter-buttons">
                {categories.map(category => (
                  <button
                    key={category}
                    className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => handleCategoryChange(category)}
                  >
                    {category}
                    {category !== 'All' && (
                      <span className="count">
                        {category === 'Uncategorized' 
                          ? stats.categories[''] || 0
                          : stats.categories[category] || 0
                        }
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label>Type</label>
              <div className="filter-buttons">
                {types.map(type => (
                  <button
                    key={type}
                    className={`filter-btn ${selectedType === type ? 'active' : ''}`}
                    onClick={() => handleTypeChange(type)}
                  >
                    {type === 'All' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="search-section">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={handleSearch}
                className="search-input"
              />
              <div className="search-results-count">
                {filteredBookmarks.length} of {bookmarks.length} bookmarks
              </div>
            </div>
          </div>

          <div className="bookmarks-grid">
            {filteredBookmarks.length > 0 ? (
              filteredBookmarks.map(bookmark => (
                <div key={bookmark.id} className={`bookmark-card ${bookmark.type}`}>
                  <div className="bookmark-header">
                    <span className={`bookmark-type ${bookmark.type}`}>
                      {bookmark.type}
                    </span>
                    <div className="bookmark-actions">
                      <select
                        value={bookmark.category || ''}
                        onChange={(e) => categorizeBookmark(bookmark.id, e.target.value)}
                        className="category-select"
                      >
                        <option value="">No category</option>
                        {categories.slice(1).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteBookmark(bookmark.id)}
                        className="delete-btn"
                        title="Delete bookmark"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="bookmark-content">
                    {bookmark.type === 'text' ? (
                      <div className="text-content">
                        <p className="bookmark-text">{bookmark.content}</p>
                        {bookmark.pageContext?.nearbyHeadings?.length > 0 && (
                          <div className="context-info">
                            <strong>Context:</strong> {bookmark.pageContext.nearbyHeadings[0]}
                          </div>
                        )}
                      </div>
                    ) : bookmark.type === 'image' ? (
                      <div className="image-content">
                        <img
                          src={bookmark.imageUrl}
                          alt={bookmark.alt || 'Saved image'}
                          className="bookmark-image"
                          onClick={() => window.open(bookmark.imageUrl, '_blank')}
                        />
                        {bookmark.alt && (
                          <p className="image-alt">{bookmark.alt}</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="bookmark-footer">
                    <div className="bookmark-meta">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bookmark-source"
                        title={bookmark.url}
                      >
                        {bookmark.title || new URL(bookmark.url).hostname}
                      </a>
                      <span className="bookmark-date">
                        {formatDate(bookmark.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-bookmarks">
                {bookmarks.length === 0 ? (
                  <div className="empty-state">
                    <h3>No bookmarks yet</h3>
                    <p>Start saving text and images from web pages to build your AI-powered bookmark collection!</p>
                  </div>
                ) : (
                  <div className="no-results">
                    <h3>No bookmarks match your filters</h3>
                    <p>Try adjusting your search terms or filter settings.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;