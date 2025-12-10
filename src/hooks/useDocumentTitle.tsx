import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useDocumentTitle() {
  useEffect(() => {
    const fetchAndSetTitle = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "site_name")
        .maybeSingle();

      if (data?.setting_value) {
        document.title = `${data.setting_value} - AI Pentesting Suite`;
      }
    };

    fetchAndSetTitle();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("site_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_settings",
          filter: "setting_key=eq.site_name",
        },
        (payload) => {
          if (payload.new && (payload.new as any).setting_value) {
            document.title = `${(payload.new as any).setting_value} - AI Pentesting Suite`;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
