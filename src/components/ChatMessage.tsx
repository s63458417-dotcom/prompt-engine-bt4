import { User, Bot, AlertCircle, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match && match[1] ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return !inline ? (
    <div className="relative bg-zinc-800 rounded-lg my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-700 rounded-t-lg">
        <span className="text-xs text-gray-300">{lang}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-300 hover:text-white"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={lang}
        PreTag="div"
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  ) : (
    <code className="text-sm bg-zinc-700 text-white px-1 rounded" {...props}>
      {children}
    </code>
  );
};

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
        <ReactMarkdown
          className={`text-sm leading-relaxed whitespace-pre-wrap break-words font-mono ${
            isError ? "text-red-400" : "text-foreground/90"
          }`}
          rehypePlugins={[rehypeRaw]}
          remarkPlugins={[remarkGfm]}
          components={{
            code: CodeBlock,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
