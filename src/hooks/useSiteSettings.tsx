import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skull } from "lucide-react";

interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
}

export function SiteLogo({ className = "w-6 h-6" }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "logo_url")
        .single();
      
      if (data?.setting_value) {
        setLogoUrl(data.setting_value);
      }
    };
    fetchLogo();
  }, []);

  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt="Logo" 
        className={`${className} object-contain`}
      />
    );
  }

  return <Skull className={`${className} text-primary`} />;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "JailbreakLab",
    site_description: "AI Pentesting Suite v2.0",
    logo_url: "",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value");
      
      if (data) {
        const settingsMap = data.reduce((acc, item) => {
          acc[item.setting_key as keyof SiteSettings] = item.setting_value;
          return acc;
        }, {} as SiteSettings);
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    };
    fetchSettings();
  }, []);

  return settings;
}