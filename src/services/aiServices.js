import { getAPIConfig, validateAPIConfig } from '../config/apiConfig.js';

class HuggingFaceService {
  constructor(config) {
    this.config = config;
  }

  async getEmbedding(text) {
    const url = `${this.config.huggingFace.baseUrl}/models/${this.config.huggingFace.model}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.huggingFace.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        })
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`HF embeddings error ${resp.status}: ${errorText}`);
      }
      
      const data = await resp.json();
      
      // Handle different response formats
      let vec;
      if (Array.isArray(data)) {
        if (data.length && Array.isArray(data[0])) {
          // Token-level embeddings - need to pool
          vec = this.meanPool(data);
        } else if (data.length && typeof data[0] === 'number') {
          // Already flat array
          vec = data;
        } else if (data[0]?.embedding) {
          vec = data[0].embedding;
        }
      } else if (data.embedding && Array.isArray(data.embedding)) {
        vec = data.embedding;
      }
      
      if (!Array.isArray(vec)) {
        throw new Error('Unexpected embedding format');
      }
      
      if (vec.length !== this.config.pinecone.dimension) {
        console.warn(`[HF] embedding dimension ${vec.length} != expected ${this.config.pinecone.dimension}`);
      }
      
      return this.normalize(vec);
    } catch (error) {
      console.error('[HF] embedding failure:', error);
      throw error;
    }
  }

  meanPool(tokenEmbeddings) {
    const len = tokenEmbeddings.length;
    if (!len) return [];
    const dim = tokenEmbeddings[0].length;
    const pooled = new Array(dim).fill(0);
    
    for (const tok of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) {
        pooled[i] += tok[i];
      }
    }
    
    for (let i = 0; i < dim; i++) {
      pooled[i] /= len;
    }
    
    return pooled;
  }

  normalize(vector) {
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) || 1;
    return vector.map(x => x / norm);
  }

  async testConnection() {
    try {
      const embedding = await this.getEmbedding('health check');
      return Array.isArray(embedding) && embedding.length > 0;
    } catch {
      return false;
    }
  }
}

class PineconeService {
  constructor(config) {
    this.config = config;
    const pc = config.pinecone;
    this.baseHost = pc.customHost || `${pc.indexName}-${pc.projectId}.svc.${pc.environment}.pinecone.io`;
    this.baseUrl = `https://${this.baseHost}`;
    this.apiVersion = '2025-04';
  }

  async upsertVectors(vectors) {
    const resp = await fetch(`${this.baseUrl}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.pinecone.apiKey,
        'X-Pinecone-Api-Version': this.apiVersion
      },
      body: JSON.stringify({ vectors })
    });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Pinecone upsert error body:', errorText);
      throw new Error(`Pinecone upsert failed ${resp.status}: ${errorText}`);
    }
    
    return resp.json();
  }

  async queryVectors(vector, topK = 10, includeMetadata = true) {
    const resp = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.pinecone.apiKey,
        'X-Pinecone-Api-Version': this.apiVersion
      },
      body: JSON.stringify({ vector, topK, includeMetadata })
    });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Pinecone query error body:', errorText);
      throw new Error(`Pinecone query failed ${resp.status}: ${errorText}`);
    }
    
    return resp.json();
  }

  async deleteVectors(ids) {
    const resp = await fetch(`${this.baseUrl}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.pinecone.apiKey,
        'X-Pinecone-Api-Version': this.apiVersion
      },
      body: JSON.stringify({ ids })
    });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('Pinecone delete error body:', errorText);
      throw new Error(`Pinecone delete failed ${resp.status}: ${errorText}`);
    }
    
    return resp.json();
  }
}

class AIService {
  constructor() {
    this.hfService = null;
    this.pineconeService = null;
    this.isInitialized = false;
    this.config = null;
  }

  async initialize() {
    try {
      console.log('Initializing AI service...');
      
      // Get config from storage
      this.config = await getAPIConfig();
      
      // Validate configuration
      const validation = await validateAPIConfig();
      if (!validation.isValid) {
        throw new Error('API configuration invalid: ' + validation.errors.join(', '));
      }

      // Initialize services with config
      this.hfService = new HuggingFaceService(this.config);
      this.pineconeService = new PineconeService(this.config);
      
      // Test connection
      await this.hfService.testConnection();
      
      this.isInitialized = true;
      console.log('AI service initialized successfully');
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async embedText(text) {
    await this.ensureInitialized();
    return this.hfService.getEmbedding(text);
  }

  async saveTextEntry(text, context, metadata = {}) {
    await this.ensureInitialized();
    
    const pageCtx = context?.pageContext || {};
    const headings = pageCtx.nearbyHeadings || pageCtx.headings || [];
    
    // Create embedding from text + context
    const embeddingText = `${text}\n${context?.title || ''}\n${headings.join(' ')}`;
    const embedding = await this.hfService.getEmbedding(embeddingText);
    
    const id = `text_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const vector = {
      id,
      values: embedding,
      metadata: {
        type: 'text',
        content: text,
        url: context?.url || '',
        title: context?.title || '',
        headings: headings.slice(0, 15),
        metaDescription: pageCtx.metaDescription || '',
        contextSnippet: (pageCtx.nearbyText || pageCtx.selectedText || '').slice(0, 500),
        category: metadata.category || '',
        timestamp: metadata.timestamp || new Date().toISOString()
      }
    };
    
    await this.pineconeService.upsertVectors([vector]);
    return { success: true, id };
  }

  async saveImageEntry(imageUrl, context, metadata = {}) {
    await this.ensureInitialized();
    
    const pageCtx = context?.pageContext || {};
    const headings = pageCtx.nearbyHeadings || pageCtx.headings || [];
    
    // Create embedding from alt text + context
    const embeddingText = `${context?.altText || ''} ${context?.title || ''} ${headings.join(' ')}`;
    const embedding = await this.hfService.getEmbedding(embeddingText);
    
    const id = `image_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const vector = {
      id,
      values: embedding,
      metadata: {
        type: 'image',
        imageUrl,
        alt: context?.altText || '',
        url: context?.url || '',
        title: context?.title || '',
        headings: headings.slice(0, 15),
        category: metadata.category || '',
        timestamp: metadata.timestamp || new Date().toISOString()
      }
    };
    
    await this.pineconeService.upsertVectors([vector]);
    return { success: true, id };
  }

  async searchEntries(query, topK = 20) {
    await this.ensureInitialized();
    
    console.log('[AI] searchEntries query:', query);
    const queryVector = await this.hfService.getEmbedding(query);
    console.log('[AI] query embedding length:', queryVector.length);
    
    let results;
    try {
      results = await this.pineconeService.queryVectors(queryVector, topK, true);
    } catch (error) {
      console.warn('[AI] Pinecone query failed, returning empty matches:', error.message);
      results = { matches: [] };
    }
    
    const matches = (results.matches || []).map(match => ({
      id: match.id,
      score: match.score,
      metadata: {
        type: match.metadata?.type,
        content: match.metadata?.content,
        imageUrl: match.metadata?.imageUrl,
        alt: match.metadata?.alt,
        url: match.metadata?.url,
        title: match.metadata?.title,
        headings: match.metadata?.headings || [],
        metaDescription: match.metadata?.metaDescription || '',
        contextSnippet: match.metadata?.contextSnippet || '',
        category: match.metadata?.category || '',
        timestamp: match.metadata?.timestamp
      }
    }));
    
    console.log('[AI] Pinecone matches:', matches.length);
    return matches;
  }

  async deleteEntry(entryId) {
    await this.ensureInitialized();
    await this.pineconeService.deleteVectors([entryId]);
    return { success: true };
  }
}

export const aiService = new AIService();
