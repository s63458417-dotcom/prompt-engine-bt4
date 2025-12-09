import { useState } from "react";
import { Cloud, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SavedEndpoint } from "@/hooks/useSavedEndpoints";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SavedEndpointsProps {
  savedEndpoints: SavedEndpoint[];
  loading: boolean;
  currentEndpoint: string;
  currentModel: string;
  onSelect: (endpoint: SavedEndpoint) => void;
  onSave: (name: string, endpoint: string, model?: string) => Promise<any>;
  onDelete: (id: string) => void;
}

export function SavedEndpoints({
  savedEndpoints,
  loading,
  currentEndpoint,
  currentModel,
  onSelect,
  onSave,
  onDelete,
}: SavedEndpointsProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [endpointName, setEndpointName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!endpointName.trim() || !currentEndpoint.trim()) return;

    setSaving(true);
    await onSave(endpointName.trim(), currentEndpoint, currentModel);
    setSaving(false);
    setEndpointName("");
    setShowSaveDialog(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Saved Endpoints
        </label>
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              disabled={!currentEndpoint}
            >
              <Save className="w-3 h-3" />
              Save Current
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Endpoint</DialogTitle>
              <DialogDescription>
                Save this endpoint for quick access later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={endpointName}
                  onChange={(e) => setEndpointName(e.target.value)}
                  placeholder="My Custom Endpoint"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Endpoint</label>
                <p className="text-xs font-mono bg-surface p-2 rounded truncate">
                  {currentEndpoint || "No endpoint configured"}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                <p className="text-xs font-mono bg-surface p-2 rounded">
                  {currentModel || "No model specified"}
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !endpointName.trim()}
                className="w-full gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Endpoint
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : savedEndpoints.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No saved endpoints
        </p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {savedEndpoints.map((endpoint) => (
            <div
              key={endpoint.id}
              onClick={() => onSelect(endpoint)}
              className="group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-surface/50"
            >
              <Cloud className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{endpoint.name}</p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {endpoint.model_name || "Custom model"}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, endpoint.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-opacity"
                disabled={deletingId === endpoint.id}
              >
                {deletingId === endpoint.id ? (
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
