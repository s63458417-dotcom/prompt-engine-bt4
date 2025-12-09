import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SavedEndpoint {
  id: string;
  user_id: string;
  name: string;
  endpoint_url: string;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useSavedEndpoints() {
  const { user } = useAuth();
  const [savedEndpoints, setSavedEndpoints] = useState<SavedEndpoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEndpoints = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_endpoints")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedEndpoints(data || []);
    } catch (error) {
      console.error("Failed to fetch endpoints:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveEndpoint = async (name: string, endpointUrl: string, modelName?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("user_endpoints")
        .insert({
          user_id: user.id,
          name,
          endpoint_url: endpointUrl,
          model_name: modelName || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setSavedEndpoints(prev => [data, ...prev]);
      toast.success("Endpoint saved!");
      return data;
    } catch (error) {
      console.error("Failed to save endpoint:", error);
      toast.error("Failed to save endpoint");
      return null;
    }
  };

  const deleteEndpoint = async (id: string) => {
    try {
      const { error } = await supabase
        .from("user_endpoints")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setSavedEndpoints(prev => prev.filter(e => e.id !== id));
      toast.success("Endpoint deleted");
    } catch (error) {
      console.error("Failed to delete endpoint:", error);
      toast.error("Failed to delete endpoint");
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, [user]);

  return {
    savedEndpoints,
    loading,
    saveEndpoint,
    deleteEndpoint,
    fetchEndpoints,
  };
}
