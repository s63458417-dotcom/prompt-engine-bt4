import { useRef, useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { Button } from "@/components/ui/button";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  stealthMode: boolean;
  onSendMessage: (message: string) => void;
  apiEndpoint: string;
}

export function ChatArea({
  messages,
  isLoading,
  stealthMode,
  onSendMessage,
  apiEndpoint,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const getEndpointLabel = (endpoint: string) => {
    if (endpoint.includes("openai")) return "openai.com";
    if (endpoint.includes("anthropic")) return "anthropic.com";
    return new URL(endpoint).hostname;
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <span className="text-sm text-muted-foreground font-mono">
          {apiEndpoint ? getEndpointLabel(apiEndpoint) : "No endpoint"}
        </span>
        {stealthMode && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-primary/20 text-primary rounded uppercase tracking-wider">
            Stealth On
          </span>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center glow-crimson-subtle">
                <span className="text-3xl">🔓</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Ready to Test</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your API and jailbreak prompt, then start testing
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-4 p-4 bg-surface/50">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">Generating response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter query..."
            disabled={isLoading}
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
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
      </div>
    </main>
  );
}
