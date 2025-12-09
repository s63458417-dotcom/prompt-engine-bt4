import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skull, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

interface SiteSettings {
  site_name: string;
  site_description: string;
  footer_text: string;
  login_subtitle: string;
}

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "JailbreakLab",
    site_description: "AI Security Testing Suite",
    footer_text: "AI Pentesting Suite v2.0 • For authorized research only",
    login_subtitle: "Access your testing suite",
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Fetch site settings
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
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // First, look up the email by username
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username.trim())
        .maybeSingle();

      if (profileError || !profile) {
        toast.error("Invalid username or password");
        setLoading(false);
        return;
      }

      // Get user email from auth.users via edge function
      const { data: userData, error: userError } = await supabase.functions.invoke("get-user-email", {
        body: { userId: profile.user_id },
      });

      if (userError || !userData?.email) {
        toast.error("Invalid username or password");
        setLoading(false);
        return;
      }

      // Now sign in with the email
      const { error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid username or password");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Welcome back!");
      navigate("/");
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4 glow-crimson-subtle">
            <Skull className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2 font-mono">
            {settings.site_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {settings.login_subtitle}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                className="bg-input border-border font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="bg-input border-border font-mono"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Please wait..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          {settings.footer_text}
        </p>
      </div>
    </div>
  );
}