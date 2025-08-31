document.addEventListener('DOMContentLoaded', async () => {
  // Load existing settings
  const stored = await chrome.storage.local.get(['hfApiKey', 'pineconeApiKey']);
  
  if (stored.hfApiKey) {
    document.getElementById('hfKey').value = stored.hfApiKey;
  }
  
  if (stored.pineconeApiKey) {
    document.getElementById('pineconeKey').value = stored.pineconeApiKey;
  }
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    hfApiKey: document.getElementById('hfKey').value.trim(),
    pineconeApiKey: document.getElementById('pineconeKey').value.trim()
  };
  
  // Validate keys
  if (!settings.hfApiKey || !settings.hfApiKey.startsWith('hf_')) {
    alert('Please enter a valid Hugging Face API key (starts with hf_)');
    return;
  }
  
  if (!settings.pineconeApiKey || !settings.pineconeApiKey.startsWith('pcsk_')) {
    alert('Please enter a valid Pinecone API key (starts with pcsk_)');
    return;
  }
  
  await chrome.storage.local.set(settings);
  
  // Show success message
  const button = e.target.querySelector('button');
  const originalText = button.textContent;
  button.textContent = 'Settings Saved!';
  button.style.backgroundColor = '#4CAF50';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.backgroundColor = '';
  }, 2000);
});