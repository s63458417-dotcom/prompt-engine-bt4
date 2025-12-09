import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Eye, EyeOff, RefreshCw, Skull, Shield, Zap, Download, 
  TestTube, BookOpen, BarChart3, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, LogOut, Settings
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromptTemplates } from "./PromptTemplates";
import { ResponseAnalysis } from "./ResponseAnalysis";
import { Message } from "./ChatMessage";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ConfigSidebarProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  apiEndpoint: string;
  setApiEndpoint: (endpoint: string) => void;
  model: string;
  setModel: (model: string) => void;
  stealthMode: boolean;
  setStealthMode: (stealth: boolean) => void;
  jailbreakPrompt: string;
  setJailbreakPrompt: (prompt: string) => void;
  onWipeMemory: () => void;
  messages: Message[];
  isAdmin?: boolean;
  onSignOut?: () => void;
}

const PROVIDERS = [
  { 
    id: "openai", 
    name: "OpenAI", 
    endpoint: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini"]
  },
  { 
    id: "anthropic", 
    name: "Anthropic", 
    endpoint: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]
  },
  { 
    id: "google", 
    name: "Google AI", 
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"]
  },
  { 
    id: "mistral", 
    name: "Mistral AI", 
    endpoint: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mixtral-8x22b"]
  },
  { 
    id: "groq", 
    name: "Groq", 
    endpoint: "https://api.groq.com/openai/v1",
    models: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
  },
  { 
    id: "cohere", 
    name: "Cohere", 
    endpoint: "https://api.cohere.ai/v1",
    models: ["command-r-plus", "command-r", "command"]
  },
  { 
    id: "ollama", 
    name: "Ollama (Local)", 
    endpoint: "http://localhost:11434/v1",
    models: ["llama3.1", "llama3", "mistral", "mixtral", "phi3", "qwen2"]
  },
  { 
    id: "custom", 
    name: "Custom Endpoint", 
    endpoint: "",
    models: []
  },
];

type SectionId = "api" | "templates" | "analysis";

export function ConfigSidebar({
  apiKey,
  setApiKey,
  apiEndpoint,
  setApiEndpoint,
  model,
  setModel,
  stealthMode,
  setStealthMode,
  jailbreakPrompt,
  setJailbreakPrompt,
  onWipeMemory,
  messages,
  isAdmin,
  onSignOut,
}: ConfigSidebarProps) {
  const navigate = useNavigate();
  const [showApiKey, setShowApiKey] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [expandedSections, setExpandedSections] = useState<SectionId[]>(["api"]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "success" | "error">("none");

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider);

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.id !== "custom") {
      setApiEndpoint(provider.endpoint);
      if (provider.models.length > 0) {
        setModel(provider.models[0]);
      }
    }
    setConnectionStatus("none");
  };

  const handleModelChange = (value: string) => {
    if (value === "custom") {
      setModel(customModel || "");
    } else {
      setModel(value);
    }
  };

  const handleCustomEndpointChange = (value: string) => {
    setCustomEndpoint(value);
    setApiEndpoint(value);
  };

  const handleCustomModelChange = (value: string) => {
    setCustomModel(value);
    setModel(value);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast.error("Please enter your API key first");
      return;
    }

    setTestingConnection(true);
    setConnectionStatus("none");

    try {
      const { data, error } = await supabase.functions.invoke("jailbreak-test", {
        body: {
          apiKey,
          apiEndpoint,
          model,
          jailbreakPrompt: "You are a helpful assistant.",
          userMessage: "Hello, this is a connection test. Reply with 'Connection successful!'",
          stealthMode: false,
          conversationHistory: [],
          testMode: true,
        },
      });

      if (error) throw error;

      if (data.response) {
        setConnectionStatus("success");
        toast.success("Connection successful!");
      } else {
        throw new Error("No response received");
      }
    } catch (error) {
      setConnectionStatus("error");
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleExportLogs = () => {
    if (messages.length === 0) {
      toast.error("No messages to export");
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      config: {
        provider: selectedProvider,
        endpoint: apiEndpoint,
        model,
        stealthMode,
      },
      jailbreakPrompt,
      conversation: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jailbreak-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Session exported successfully");
  };

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
      navigate("/auth");
    }
  };

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-crimson-subtle">
              <Skull className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">JailbreakLab</h1>
              <p className="text-xs text-muted-foreground">AI Pentesting Suite v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="h-8 w-8"
                title="Admin Panel"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* API Config Section */}
        <div className="border-b border-sidebar-border">
          <button
            onClick={() => toggleSection("api")}
            className="w-full flex items-center justify-between p-4 hover:bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">API Configuration</span>
            </div>
            {expandedSections.includes("api") ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {expandedSections.includes("api") && (
            <div className="p-4 pt-0 space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Provider
                </label>
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="w-full bg-input border-border">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API Key..."
                    className="w-full bg-input border border-border rounded-md px-3 py-2 pr-10 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Custom Endpoint (only for custom provider) */}
              {selectedProvider === "custom" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Custom Endpoint
                  </label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => handleCustomEndpointChange(e.target.value)}
                    placeholder="https://your-api.com/v1"
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your OpenAI-compatible API endpoint
                  </p>
                </div>
              )}

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Model
                </label>
                {currentProvider && currentProvider.models.length > 0 ? (
                  <Select value={model} onValueChange={handleModelChange}>
                    <SelectTrigger className="w-full bg-input border-border">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProvider.models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Model</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => handleCustomModelChange(e.target.value)}
                    placeholder="Enter model name..."
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}

                {model === "custom" && currentProvider?.models.length > 0 && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => handleCustomModelChange(e.target.value)}
                    placeholder="Enter custom model name..."
                    className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              {/* Test Connection Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleTestConnection}
                disabled={testingConnection || !apiKey}
              >
                {testingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : connectionStatus === "success" ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : connectionStatus === "error" ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                {testingConnection ? "Testing..." : "Test Connection"}
              </Button>

              {/* Stealth Mode */}
              <div className="flex items-center justify-between p-3 bg-surface/50 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Stealth Mode</h3>
                  <p className="text-xs text-muted-foreground">Base64 Obfuscation</p>
                </div>
                <Switch checked={stealthMode} onCheckedChange={setStealthMode} />
              </div>

              {/* Jailbreak Injection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Jailbreak Injection
                  </label>
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <textarea
                  value={jailbreakPrompt}
                  onChange={(e) => setJailbreakPrompt(e.target.value)}
                  placeholder="Enter jailbreak prompt..."
                  className="w-full h-32 bg-input border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Prompt Templates Section */}
        <div className="border-b border-sidebar-border">
          <button
            onClick={() => toggleSection("templates")}
            className="w-full flex items-center justify-between p-4 hover:bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Prompt Templates</span>
            </div>
            {expandedSections.includes("templates") ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {expandedSections.includes("templates") && (
            <div className="p-4 pt-0">
              <PromptTemplates onSelectTemplate={setJailbreakPrompt} />
            </div>
          )}
        </div>

        {/* Response Analysis Section */}
        <div className="border-b border-sidebar-border">
          <button
            onClick={() => toggleSection("analysis")}
            className="w-full flex items-center justify-between p-4 hover:bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Response Analysis</span>
            </div>
            {expandedSections.includes("analysis") ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {expandedSections.includes("analysis") && (
            <div className="p-4 pt-0">
              <ResponseAnalysis messages={messages} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleExportLogs}
        >
          <Download className="w-4 h-4" />
          Export Session
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
          onClick={onWipeMemory}
        >
          <RefreshCw className="w-4 h-4" />
          Wipe Memory
        </Button>
      </div>
    </aside>
  );
}
