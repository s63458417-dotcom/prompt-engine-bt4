import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Message } from "@/components/ChatMessage";

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  api_endpoint: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageDB {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (apiEndpoint: string, model: string): Promise<Conversation | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "New Conversation",
          api_endpoint: apiEndpoint,
          model: model,
        })
        .select()
        .single();

      if (error) throw error;
      
      setConversations(prev => [data, ...prev]);
      setCurrentConversation(data);
      return data;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title })
        .eq("id", conversationId);

      if (error) throw error;
      
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, title } : c)
      );
    } catch (error) {
      console.error("Failed to update conversation title:", error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const saveMessage = async (conversationId: string, role: "user" | "assistant", content: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role,
        content,
      });

      if (error) throw error;

      // Update conversation's updated_at
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  };

  const loadConversationMessages = async (conversationId: string): Promise<Message[]> => {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((m: ChatMessageDB) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  };

  const logUsage = async (apiEndpoint: string, model: string) => {
    if (!user) return;

    try {
      await supabase.from("usage_logs").insert({
        user_id: user.id,
        api_endpoint: apiEndpoint,
        model,
      });
    } catch (error) {
      console.error("Failed to log usage:", error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    loading,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    saveMessage,
    loadConversationMessages,
    logUsage,
    fetchConversations,
  };
}
