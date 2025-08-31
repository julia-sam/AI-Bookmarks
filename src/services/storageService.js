// Storage service for AI Knowledge Base extension
export class StorageService {
  constructor() {
    this.STORAGE_KEY = 'ai_knowledge_base';
    this.ENTRIES_KEY = 'entries'; 
    this.CATEGORIES_KEY = 'kb_categories';
  }

  async saveEntry(entry) {
    try {
      console.log('=== STORAGE SERVICE: SAVING ENTRY ===');
      console.log('Entry:', entry);

      const existingData = await this.getAllEntriesRaw(); // Use raw method that doesn't filter by userId
      const newEntry = {
        id: entry.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: entry.userId, 
        type: entry.type,
        content: entry.content || entry.text,
        imageUrl: entry.imageUrl,
        url: entry.url,
        title: entry.title,
        timestamp: entry.timestamp || new Date().toISOString(),
        category: entry.category || '',
        pageContext: entry.pageContext,
        aiId: entry.aiId
      };

      existingData.push(newEntry);

      await chrome.storage.local.set({
        [this.ENTRIES_KEY]: existingData
      });

      console.log('=== STORAGE SERVICE: ENTRY SAVED SUCCESSFULLY ===');
      console.log('Total entries:', existingData.length);
      
      return newEntry;
    } catch (error) {
      console.error('=== STORAGE SERVICE: SAVE FAILED ===');
      console.error('Error saving entry:', error);
      throw error;
    }
  }

  // Add this helper method that gets all entries without userId filtering
  async getAllEntriesRaw() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.ENTRIES_KEY], (result) => {
        resolve(result[this.ENTRIES_KEY] || []);
      });
    });
  }

  async getAllEntries(userId) {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.ENTRIES_KEY], (result) => { // Use this.ENTRIES_KEY consistently
        const allEntries = result[this.ENTRIES_KEY] || [];
        console.log(`Storage service: Retrieved ${allEntries.length} total entries`);
        
        if (!userId) {
          console.log('No userId provided, returning all entries');
          resolve(allEntries);
          return;
        }
        
        // Filter entries by user ID
        const userEntries = allEntries.filter(entry => entry.userId === userId);
        console.log(`Storage service: Filtered to ${userEntries.length} entries for user ${userId}`);
        
        resolve(userEntries);
      });
    });
  }

  async getRecentEntries(limit = 10, userId = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.ENTRIES_KEY], (result) => { // Use this.ENTRIES_KEY consistently
        let entries = result[this.ENTRIES_KEY] || [];
        console.log(`Storage service: Retrieved ${entries.length} total entries`);
        
        // Filter by user if userId is provided
        if (userId) {
          entries = entries.filter(entry => entry.userId === userId);
          console.log(`Storage service: Filtered to ${entries.length} entries for user ${userId}`);
        }
        
        // Sort by timestamp and limit
        const recentEntries = entries
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit);
        
        console.log(`Storage service: Returning ${recentEntries.length} recent entries`);
        resolve(recentEntries);
      });
    });
  }

  async deleteEntry(entryId) {
    try {
      const existingData = await this.getAllEntriesRaw(); // Use raw method
      const filteredData = existingData.filter(entry => entry.id !== entryId);
      
      await chrome.storage.local.set({
        [this.ENTRIES_KEY]: filteredData
      });
      
      console.log(`Entry ${entryId} deleted from storage`);
      return true;
    } catch (error) {
      console.error('Error deleting entry from storage:', error);
      throw error;
    }
  }

  async categorizeEntry(entryId, category) {
    try {
      const existingData = await this.getAllEntriesRaw(); // Use raw method
      const entry = existingData.find(e => e.id === entryId);
      
      if (entry) {
        entry.category = category;
        await chrome.storage.local.set({
          [this.ENTRIES_KEY]: existingData
        });
        console.log(`Entry ${entryId} categorized as ${category}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error categorizing entry:', error);
      throw error;
    }
  }

  async searchEntries(query, userId = null) {
    try {
      const allEntries = await this.getAllEntries(userId); // Pass userId
      const lowercaseQuery = query.toLowerCase();
      
      return allEntries.filter(entry => {
        const searchableText = [
          entry.content,
          entry.title,
          entry.category,
          entry.pageContext?.nearbyHeadings?.join(' ')
        ].join(' ').toLowerCase();
        
        return searchableText.includes(lowercaseQuery);
      });
    } catch (error) {
      console.error('Error searching entries:', error);
      return [];
    }
  }
}

export const storageService = new StorageService();
