import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Key, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [currentUsername, setCurrentUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchProfile();
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user?.id)
        .single();

      if (profile) {
        setCurrentUsername(profile.username);
        setNewUsername(profile.username);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (newPassword && newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!newUsername.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const updates: { newUsername?: string; newPassword?: string } = {};
      
      if (newUsername.trim() !== currentUsername) {
        updates.newUsername = newUsername.trim();
      }
      
      if (newPassword) {
        updates.newPassword = newPassword;
      }

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("update-user-credentials", {
        body: updates,
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Settings updated successfully!");
      setCurrentUsername(newUsername.trim());
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg text-foreground">Account Settings</h1>
            <p className="text-xs text-muted-foreground">Update your profile</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Username Section */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <User className="w-5 h-5" />
            <h2 className="font-semibold text-foreground">Username</h2>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current Username
            </label>
            <div className="text-sm text-foreground font-mono bg-surface px-3 py-2 rounded-md">
              {currentUsername}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              New Username
            </label>
            <Input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter new username..."
              className="bg-input border-border font-mono"
            />
          </div>
        </section>

        {/* Password Section */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Key className="w-5 h-5" />
            <h2 className="font-semibold text-foreground">Change Password</h2>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              New Password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password..."
              className="bg-input border-border font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep current password
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Confirm Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password..."
              className="bg-input border-border font-mono"
            />
          </div>
        </section>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gap-2"
          size="lg"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </main>
    </div>
  );
}