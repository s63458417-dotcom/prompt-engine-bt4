import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, Cloud, BarChart3, Loader2, ChevronDown, ChevronRight,
  User, Calendar, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
}

interface ConversationWithMessages {
  id: string;
  user_id: string;
  title: string;
  api_endpoint: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface UserEndpoint {
  id: string;
  user_id: string;
  name: string;
  endpoint_url: string;
  model_name: string | null;
  created_at: string;
}

interface UsageLog {
  id: string;
  user_id: string;
  api_endpoint: string;
  model: string | null;
  created_at: string;
}

interface UsageStats {
  totalRequests: number;
  endpointBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}

export function AdminUserActivity() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [userEndpoints, setUserEndpoints] = useState<UserEndpoint[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserData(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchUserData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch conversations
      const { data: convData } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      setConversations(convData || []);

      // Fetch user endpoints
      const { data: endpointsData } = await supabase
        .from("user_endpoints")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setUserEndpoints(endpointsData || []);

      // Fetch usage logs for stats
      const { data: usageData } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("user_id", userId);

      // Calculate stats
      if (usageData) {
        const endpointBreakdown: Record<string, number> = {};
        const modelBreakdown: Record<string, number> = {};

        usageData.forEach((log: UsageLog) => {
          const endpoint = log.api_endpoint || "Unknown";
          const model = log.model || "Unknown";
          
          endpointBreakdown[endpoint] = (endpointBreakdown[endpoint] || 0) + 1;
          modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
        });

        setUsageStats({
          totalRequests: usageData.length,
          endpointBreakdown,
          modelBreakdown,
        });
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationMessages = async (convId: string) => {
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      setConversations(prev =>
        prev.map(c =>
          c.id === convId ? { ...c, messages: data || [] } : c
        )
      );
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const toggleConversation = async (convId: string) => {
    if (expandedConvId === convId) {
      setExpandedConvId(null);
    } else {
      setExpandedConvId(convId);
      const conv = conversations.find(c => c.id === convId);
      if (!conv?.messages) {
        await loadConversationMessages(convId);
      }
    }
  };

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* User Selection */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">Select User:</label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose a user..." />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedUserId ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a user to view their activity</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Usage Statistics */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Usage Statistics</h3>
              </div>
              
              {usageStats ? (
                <div className="space-y-4">
                  <div className="text-center py-4 bg-surface/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{usageStats.totalRequests}</p>
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">By Endpoint</p>
                    {Object.entries(usageStats.endpointBreakdown).slice(0, 5).map(([endpoint, count]) => (
                      <div key={endpoint} className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground font-mono text-xs">
                          {endpoint.includes("openai") ? "OpenAI" : 
                           endpoint.includes("anthropic") ? "Anthropic" : 
                           endpoint.includes("google") ? "Google" : 
                           endpoint.slice(0, 20)}
                        </span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">By Model</p>
                    {Object.entries(usageStats.modelBreakdown).slice(0, 5).map(([model, count]) => (
                      <div key={model} className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground font-mono text-xs">{model}</span>
                        <span className="font-medium text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No usage data</p>
              )}
            </div>

            {/* Saved Endpoints */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Saved Endpoints ({userEndpoints.length})
                </h3>
              </div>

              {userEndpoints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No saved endpoints</p>
              ) : (
                <div className="space-y-2">
                  {userEndpoints.map((endpoint) => (
                    <div key={endpoint.id} className="p-2 bg-surface/50 rounded-lg">
                      <p className="text-sm font-medium text-foreground">{endpoint.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {endpoint.endpoint_url}
                      </p>
                      {endpoint.model_name && (
                        <p className="text-xs text-primary mt-1">{endpoint.model_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conversations */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  Chat History ({conversations.length} conversations)
                </h3>
              </div>

              {conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No conversations found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {conversations.map((conv) => (
                    <div key={conv.id}>
                      <button
                        onClick={() => toggleConversation(conv.id)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-surface/50 transition-colors text-left"
                      >
                        {expandedConvId === conv.id ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{conv.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {conv.model || "No model"}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conv.updated_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </button>

                      {expandedConvId === conv.id && conv.messages && (
                        <div className="px-4 pb-4">
                          <div className="bg-surface/50 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                            {conv.messages.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center">No messages</p>
                            ) : (
                              conv.messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  className={`p-3 rounded-lg ${
                                    msg.role === "user"
                                      ? "bg-primary/10 border-l-2 border-primary"
                                      : "bg-background border-l-2 border-muted"
                                  }`}
                                >
                                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                    {msg.role}
                                  </p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {msg.content.slice(0, 500)}
                                    {msg.content.length > 500 && "..."}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {new Date(msg.created_at).toLocaleString()}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
