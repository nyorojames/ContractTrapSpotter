document.addEventListener('DOMContentLoaded', async () => {
  const providerEl = document.getElementById('provider') as HTMLSelectElement;
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
  const modelEl = document.getElementById('model') as HTMLInputElement;
  const mockLlmEl = document.getElementById('mockLlm') as HTMLInputElement;
  const saveBtn = document.getElementById('save') as HTMLButtonElement;
  const statusEl = document.getElementById('status') as HTMLDivElement;

  // Load saved settings
  const saved = await chrome.storage.local.get([
    'llm_provider',
    'llm_api_key',
    'llm_model',
    'mock_llm',
  ]);

  if (saved.llm_provider) providerEl.value = saved.llm_provider;
  if (saved.llm_api_key) apiKeyEl.value = saved.llm_api_key;
  if (saved.llm_model) modelEl.value = saved.llm_model;
  if (saved.mock_llm) mockLlmEl.checked = true;

  // Save
  saveBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({
        llm_provider: providerEl.value,
        llm_api_key: apiKeyEl.value,
        llm_model: modelEl.value || undefined,
        mock_llm: mockLlmEl.checked,
      });

      statusEl.className = 'status success';
      statusEl.textContent = '✓ Settings saved successfully.';
    } catch (err) {
      statusEl.className = 'status error';
      statusEl.textContent = `✗ Error saving: ${err}`;
    }

    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  });
});
