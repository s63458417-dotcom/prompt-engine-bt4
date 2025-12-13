import { User, Bot, AlertCircle } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("Error:");

  return (
    <div className={`flex gap-4 p-6 ${isUser ? "bg-background" : "bg-surface/30"}`}>
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isUser 
            ? "bg-primary/20 text-primary" 
            : isError 
              ? "bg-red-500/20 text-red-400"
              : "bg-secondary/50 text-foreground"
        }`}
      >
        {isUser ? (
          <User className="w-5 h-5" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Bot className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-semibold ${isError ? "text-red-400" : "text-foreground"}`}>
            {isUser ? "You" : isError ? "Error" : "AI Response"}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        <div 
          className={`text-sm leading-relaxed whitespace-pre-wrap break-words font-mono ${
            isError ? "text-red-400" : "text-foreground/90"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
