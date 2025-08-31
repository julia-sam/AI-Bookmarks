// API Configuration - Users provide their own keys via options page

export const API_CONFIG = {
  // Default configuration (no keys for production)
  huggingFace: {
    apiKey: '', // Will be loaded from storage
    model: 'BAAI/bge-large-en-v1.5',
    baseUrl: 'https://api-inference.huggingface.co'
  },
  
  pinecone: {
    apiKey: '', // Will be loaded from storage
    indexName: 'llama-text-embed-v2-index',
    projectId: '472f820a-59c9-4852-a21b-0ba3cb90f1c1',
    environment: 'us-east-1-aws',
    customHost: 'llama-text-embed-v2-index-k0893oj.svc.aped-4627-b74a.pinecone.io',
    dimension: 1024
  }
};

// Function to get API config from storage
export async function getAPIConfig() {
  const stored = await chrome.storage.local.get(['hfApiKey', 'pineconeApiKey']);
  
  return {
    huggingFace: {
      apiKey: stored.hfApiKey || '',
      model: 'BAAI/bge-large-en-v1.5',
      baseUrl: 'https://api-inference.huggingface.co'
    },
    pinecone: {
      apiKey: stored.pineconeApiKey || '',
      indexName: 'llama-text-embed-v2-index',
      projectId: '472f820a-59c9-4852-a21b-0ba3cb90f1c1',
      environment: 'us-east-1-aws',
      customHost: 'llama-text-embed-v2-index-k0893oj.svc.aped-4627-b74a.pinecone.io',
      dimension: 1024
    }
  };
}

// Validation function
export async function validateAPIConfig() {
  const config = await getAPIConfig();
  const errors = [];
  const { huggingFace, pinecone } = config;

  console.log('Validating API Configuration:');
  console.log('HF API Key:', huggingFace.apiKey ? 'Present' : 'Missing');
  console.log('Pinecone API Key:', pinecone.apiKey ? 'Present' : 'Missing');
  
  if (!huggingFace.apiKey || huggingFace.apiKey.length < 10) {
    errors.push('Hugging Face API key not configured. Please set it in the extension options.');
  }
  
  if (!pinecone.apiKey || pinecone.apiKey.length < 10) {
    errors.push('Pinecone API key not configured. Please set it in the extension options.');
  }

  console.log('Validation errors:', errors);
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
