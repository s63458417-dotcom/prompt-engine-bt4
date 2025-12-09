import { useState, useEffect } from "react";
import { FileText, Copy, Check, ChevronDown, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
}

interface PromptTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
}

export function PromptTemplates({ onSelectTemplate }: PromptTemplatesProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  
  // New template form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (template: UserTemplate) => {
    navigator.clipboard.writeText(template.content);
    setCopiedId(template.id);
    toast.success(`Copied "${template.name}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (template: UserTemplate) => {
    onSelectTemplate(template.content);
    toast.success(`Loaded "${template.name}" template`);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in to save templates");
      return;
    }

    if (!newName.trim() || !newContent.trim()) {
      toast.error("Name and content are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("user_templates").insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        content: newContent.trim(),
      });

      if (error) throw error;

      toast.success("Template saved!");
      setShowForm(false);
      setNewName("");
      setNewDescription("");
      setNewContent("");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("user_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success(`Deleted "${name}"`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  if (!user) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Sign in to save and manage templates
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          My Templates ({templates.length})
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="h-7 px-2 gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>

      {/* New Template Form */}
      {showForm && (
        <form onSubmit={handleSaveTemplate} className="space-y-3 p-3 bg-surface/50 rounded-lg border border-border">
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="bg-input border-border text-sm h-8"
            required
          />
          <Input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="bg-input border-border text-sm h-8"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Jailbreak prompt content..."
            className="w-full h-24 bg-input border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            required
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="gap-1 h-7"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setNewName("");
                setNewDescription("");
                setNewContent("");
              }}
              className="h-7"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Templates List */}
      {expanded && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center p-4 text-xs text-muted-foreground">
              No templates yet. Add your first one!
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="p-3 bg-background border border-border rounded-lg space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {template.name}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(template)}
                    >
                      {copiedId === template.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteTemplate(template.id, template.name)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => handleUse(template)}
                >
                  Use Template
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
