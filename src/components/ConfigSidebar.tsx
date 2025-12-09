import { useState } from "react";
import { Eye, EyeOff, RefreshCw, Skull, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
  { value: "custom", label: "Custom Model" },
];

const ENDPOINTS = [
  { value: "https://api.openai.com/v1", label: "OpenAI" },
  { value: "https://api.anthropic.com/v1", label: "Anthropic" },
  { value: "custom", label: "Custom Endpoint" },
];

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
}: ConfigSidebarProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customModel, setCustomModel] = useState("");

  const handleEndpointChange = (value: string) => {
    if (value === "custom") {
      setApiEndpoint(customEndpoint);
    } else {
      setApiEndpoint(value);
    }
  };

  const handleModelChange = (value: string) => {
    if (value === "custom") {
      setModel(customModel);
    } else {
      setModel(value);
    }
  };

  return (
    <aside className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-crimson-subtle">
            <Skull className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">JailbreakLab</h1>
            <p className="text-xs text-muted-foreground">AI Pentesting Suite</p>
          </div>
        </div>
      </div>

      {/* Config Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* API Access */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            API Access
          </h2>
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
        </section>

        {/* Endpoint */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Endpoint
          </h2>
          <Select onValueChange={handleEndpointChange} defaultValue="https://api.openai.com/v1">
            <SelectTrigger className="w-full bg-input border-border">
              <SelectValue placeholder="Select endpoint" />
            </SelectTrigger>
            <SelectContent>
              {ENDPOINTS.map((endpoint) => (
                <SelectItem key={endpoint.value} value={endpoint.value}>
                  {endpoint.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {apiEndpoint === "custom" && (
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => {
                setCustomEndpoint(e.target.value);
                setApiEndpoint(e.target.value);
              }}
              placeholder="https://your-api.com/v1"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </section>

        {/* Model */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Model
          </h2>
          <div className="flex gap-2">
            <Select onValueChange={handleModelChange} defaultValue="gpt-4o">
              <SelectTrigger className="flex-1 bg-input border-border">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="shrink-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {model === "custom" && (
            <input
              type="text"
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                setModel(e.target.value);
              }}
              placeholder="model-name"
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </section>

        {/* Stealth Mode */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Stealth Mode</h2>
              <p className="text-xs text-muted-foreground">Base64 Obfuscation</p>
            </div>
            <Switch checked={stealthMode} onCheckedChange={setStealthMode} />
          </div>
        </section>

        {/* Jailbreak Injection */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jailbreak Injection
            </h2>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <textarea
            value={jailbreakPrompt}
            onChange={(e) => setJailbreakPrompt(e.target.value)}
            placeholder="Enter jailbreak prompt..."
            className="w-full h-48 bg-input border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </section>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
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
