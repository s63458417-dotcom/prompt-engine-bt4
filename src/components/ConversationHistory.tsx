import { useState } from "react";
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Conversation } from "@/hooks/useConversations";

interface ConversationHistoryProps {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  onSelect: (conversation: Conversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationHistory({
  conversations,
  currentConversation,
  loading,
  onSelect,
  onNew,
  onDelete,
}: ConversationHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full gap-2 justify-start"
        onClick={onNew}
      >
        <Plus className="w-4 h-4" />
        New Chat
      </Button>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No conversations yet
        </p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                currentConversation?.id === conv.id
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-surface/50 text-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{conv.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(conv.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity"
                disabled={deletingId === conv.id}
              >
                {deletingId === conv.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 text-destructive" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
