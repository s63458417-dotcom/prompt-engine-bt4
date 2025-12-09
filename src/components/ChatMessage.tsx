import { User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className={cn("flex gap-4 p-4 animate-fade-in", isUser ? "bg-transparent" : "bg-surface/50")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isUser ? "bg-muted" : "bg-primary/20"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="text-sm text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  );
}
