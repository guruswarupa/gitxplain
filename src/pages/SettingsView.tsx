/**
 * Settings View Component
 * Configure AI providers, API keys, and app preferences
 */

import React, { useState, useEffect } from 'react';
import { Settings, Key, Cpu, Check, AlertCircle, Eye, EyeOff, Save } from 'lucide-react';
import { useCommitStoryStore } from '../store/commitStoryStore';

interface AISettings {
  provider: string;
  model: string;
  openaiKey: string;
  groqKey: string;
  openrouterKey: string;
  geminiKey: string;
  chutesKey: string;
  ollamaBaseUrl: string;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-3.5-turbo'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'openrouter', name: 'OpenRouter', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'] },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'] },
  { id: 'chutes', name: 'Chutes AI', models: ['deepseek-ai/DeepSeek-V3-0324', 'meta-llama/Llama-3.3-70B-Instruct'] },
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3.2', 'llama3.1', 'codellama', 'mistral'] },
];

export default function SettingsView() {
  const { currentProject } = useCommitStoryStore();
  const [settings, setSettings] = useState<AISettings>({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    openaiKey: '',
    groqKey: '',
    openrouterKey: '',
    geminiKey: '',
    chutesKey: '',
    ollamaBaseUrl: 'http://127.0.0.1:11434/v1',
  });
  
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installingHook, setInstallingHook] = useState(false);
  const [hookStatus, setHookStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await window.electronAPI.storeGet('settings');
      if (storedSettings?.ai) {
        setSettings(prev => ({ ...prev, ...storedSettings.ai }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      await window.electronAPI.storeSet('settings', { ai: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleProviderChange = (provider: string) => {
    const providerConfig = PROVIDERS.find(p => p.id === provider);
    setSettings(prev => ({
      ...prev,
      provider,
      model: providerConfig?.models[0] || '',
    }));
  };

  const toggleShowKey = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleInstallHook = async () => {
    if (!currentProject) return;

    setInstallingHook(true);
    setHookStatus(null);
    try {
      const result = await window.electronAPI.gitxplainInstallHook(currentProject.path, 'post-commit');
      if (result.error) {
        setHookStatus({
          type: 'error',
          message: result.error,
        });
      } else {
        setHookStatus({
          type: 'success',
          message: result.output || 'Installed post-commit hook successfully.',
        });
      }
    } catch (error: any) {
      setHookStatus({
        type: 'error',
        message: error.message || 'Failed to install hook.',
      });
    } finally {
      setInstallingHook(false);
    }
  };

  const currentProvider = PROVIDERS.find(p => p.id === settings.provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Settings className="w-7 h-7" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure AI providers and API keys for commit explanations
        </p>
      </div>

      {/* Provider Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          AI Provider
        </h2>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id)}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                settings.provider === provider.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">{provider.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {provider.models[0]}
              </div>
            </button>
          ))}
        </div>

        {/* Model Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Model</label>
          <select
            value={settings.model}
            onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
            className="w-full p-3 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {currentProvider?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* API Keys */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          API Keys
        </h2>
        
        <div className="space-y-4">
          {/* OpenAI */}
          <div className={settings.provider === 'openai' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              OpenAI API Key
              {settings.provider === 'openai' && <span className="text-primary ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKeys.openai ? 'text' : 'password'}
                value={settings.openaiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, openaiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full p-3 pr-10 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('openai')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Groq */}
          <div className={settings.provider === 'groq' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              Groq API Key
              {settings.provider === 'groq' && <span className="text-primary ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKeys.groq ? 'text' : 'password'}
                value={settings.groqKey}
                onChange={(e) => setSettings(prev => ({ ...prev, groqKey: e.target.value }))}
                placeholder="gsk_..."
                className="w-full p-3 pr-10 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('groq')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.groq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OpenRouter */}
          <div className={settings.provider === 'openrouter' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              OpenRouter API Key
              {settings.provider === 'openrouter' && <span className="text-primary ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKeys.openrouter ? 'text' : 'password'}
                value={settings.openrouterKey}
                onChange={(e) => setSettings(prev => ({ ...prev, openrouterKey: e.target.value }))}
                placeholder="sk-or-..."
                className="w-full p-3 pr-10 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('openrouter')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.openrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Gemini */}
          <div className={settings.provider === 'gemini' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              Google Gemini API Key
              {settings.provider === 'gemini' && <span className="text-primary ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKeys.gemini ? 'text' : 'password'}
                value={settings.geminiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, geminiKey: e.target.value }))}
                placeholder="AIza..."
                className="w-full p-3 pr-10 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('gemini')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Chutes */}
          <div className={settings.provider === 'chutes' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              Chutes AI API Key
              {settings.provider === 'chutes' && <span className="text-primary ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKeys.chutes ? 'text' : 'password'}
                value={settings.chutesKey}
                onChange={(e) => setSettings(prev => ({ ...prev, chutesKey: e.target.value }))}
                placeholder="cpk_..."
                className="w-full p-3 pr-10 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('chutes')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.chutes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Ollama */}
          <div className={settings.provider === 'ollama' ? '' : 'opacity-50'}>
            <label className="block text-sm font-medium mb-2">
              Ollama Base URL
              {settings.provider === 'ollama' && <span className="text-primary ml-1">*</span>}
            </label>
            <input
              type="text"
              value={settings.ollamaBaseUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
              placeholder="http://127.0.0.1:11434/v1"
              className="w-full p-3 rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ollama runs locally - no API key needed
            </p>
          </div>
        </div>
      </div>

      {/* Git Hooks */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Git Hooks</h2>
        <div className="p-4 border border-border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-4">
            Install the gitxplain post-commit hook for this repository to automate commit explanations.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleInstallHook}
              disabled={!currentProject || installingHook}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {installingHook ? 'Installing...' : 'Install Post-Commit Hook'}
            </button>
            {!currentProject && (
              <span className="text-xs text-muted-foreground">Select a repository to enable hook installation.</span>
            )}
          </div>
          {hookStatus && (
            <p className={`mt-3 text-sm ${hookStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {hookStatus.message}
            </p>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-8 p-4 bg-accent rounded-lg border border-border">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">API Key Security</p>
            <p className="text-muted-foreground">
              API keys are stored locally on your machine using electron-store. 
              They are never sent to any server other than the AI provider you select.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
        
        {saved && (
          <span className="text-sm text-green-600">
            Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
