import { User, Bot, AlertCircle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

// Function to detect and format code blocks
const formatMessageContent = (content: string, onCopyCode: (code: string) => void) => {
  // Split content by code blocks (```...```)
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  const parts = content.split(codeBlockRegex);

  return parts.map((part, index) => {
    // Check if this part is a code block
    if (part.startsWith("```") && part.endsWith("```")) {
      // Extract language if specified (after the first ```)
      const firstNewlineIndex = part.indexOf("\n");
      let language = "";
      let codeContent = part.slice(3, -3); // Remove surrounding ```

      if (firstNewlineIndex !== -1) {
        // Extract language from first line
        language = part.substring(3, firstNewlineIndex);
        codeContent = part.slice(firstNewlineIndex + 1, -3);
      } else {
        // No language specified - just remove the backticks
        codeContent = part.slice(3, -3);
      }

      return (
        <div key={index} className="relative group">
          <div className="flex items-center justify-between">
            <div className="text-xs bg-surface border border-border rounded-t-md px-3 py-1 font-mono">
              {language || "code"}
            </div>
            <button
              onClick={() => onCopyCode(codeContent)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-surface/80 hover:bg-surface border border-border"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <pre className="whitespace-pre-wrap p-4 bg-surface border border-t-0 border-border rounded-b-md text-sm overflow-x-auto">
            <code>{codeContent}</code>
          </pre>
        </div>
      );
    }

    // Regular text content - split by lines to handle regular content and inline code
    const textLines = part.split("\n");
    return (
      <div key={index}>
        {textLines.map((line, lineIndex) => {
          // Process each line for inline code (backticks)
          const inlineCodeRegex = /(`[^`]*`)/g;
          const lineParts = line.split(inlineCodeRegex);

          return (
            <p key={lineIndex} className="mb-1 last:mb-0">
              {lineParts.map((linePart, partIndex) => {
                if (linePart.startsWith("`") && linePart.endsWith("`")) {
                  const inlineCode = linePart.slice(1, -1);
                  return (
                    <code key={partIndex} className="bg-surface px-1.5 py-0.5 rounded text-sm font-mono border border-border">
                      {inlineCode}
                    </code>
                  );
                }
                return <span key={partIndex}>{linePart}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  });
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("Error:");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(message.id);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

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
          className={`text-sm leading-relaxed break-words font-mono ${
            isError ? "text-red-400" : "text-foreground/90"
          }`}
        >
          {formatMessageContent(message.content, handleCopyCode)}
        </div>
      </div>
    </div>
  );
}
