import { useRef, useEffect, useState } from "react";
import { Send, Loader2, Copy, Check, Terminal } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  stealthMode: boolean;
  onSendMessage: (message: string) => void;
  apiEndpoint: string;
  model: string;
}

export function ChatArea({
  messages,
  isLoading,
  stealthMode,
  onSendMessage,
  apiEndpoint,
  model,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getEndpointLabel = (endpoint: string) => {
    if (!endpoint) return "No endpoint";
    if (endpoint.includes("openai")) return "openai.com";
    if (endpoint.includes("anthropic")) return "anthropic.com";
    if (endpoint.includes("google")) return "google.ai";
    if (endpoint.includes("mistral")) return "mistral.ai";
    if (endpoint.includes("groq")) return "groq.com";
    if (endpoint.includes("cohere")) return "cohere.ai";
    if (endpoint.includes("localhost")) return "localhost (Ollama)";
    try {
      return new URL(endpoint).hostname;
    } catch {
      return endpoint;
    }
  };

  const handleCopyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground font-mono">
            {getEndpointLabel(apiEndpoint)}
          </span>
          <span className="text-xs text-muted-foreground/50">|</span>
          <span className="text-sm text-foreground font-mono">
            {model || "No model"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stealthMode && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary/20 text-primary rounded uppercase tracking-wider animate-pulse">
              Stealth On
            </span>
          )}
          <span className="px-2 py-0.5 text-xs font-medium bg-surface text-muted-foreground rounded">
            {messages.length} messages
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md px-4">
              <div className="w-20 h-20 mx-auto rounded-xl bg-primary/10 flex items-center justify-center glow-crimson-subtle">
                <span className="text-4xl">🔓</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Ready to Test</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Configure your API settings, select a jailbreak template or write your own, 
                  then start testing AI model vulnerabilities
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-lg bg-surface/50 border border-border">
                  <p className="text-xs font-semibold text-primary">Step 1</p>
                  <p className="text-xs text-muted-foreground mt-1">Select a provider & enter API key</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border">
                  <p className="text-xs font-semibold text-primary">Step 2</p>
                  <p className="text-xs text-muted-foreground mt-1">Choose a jailbreak template</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border">
                  <p className="text-xs font-semibold text-primary">Step 3</p>
                  <p className="text-xs text-muted-foreground mt-1">Send test prompts</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border">
                  <p className="text-xs font-semibold text-primary">Step 4</p>
                  <p className="text-xs text-muted-foreground mt-1">Analyze responses</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <div key={message.id} className="relative group">
                <ChatMessage message={message} />
                <button
                  onClick={() => handleCopyMessage(message)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded bg-surface/80 hover:bg-surface border border-border"
                >
                  {copiedId === message.id ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 p-6 bg-surface/30">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/20">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-sm text-foreground">Generating response...</span>
                  <span className="text-xs text-muted-foreground">Analyzing model behavior</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-surface/30">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter test query..."
            disabled={isLoading}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 font-mono"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send • Use templates for pre-built jailbreaks
        </p>
      </div>
    </main>
  );
}