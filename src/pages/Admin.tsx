import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Skull, ArrowLeft, Users, KeyRound, Plus, Copy, Check,
  Trash2, Loader2, UserPlus, Shield, Clock, Settings, Save,
  Upload, Image as ImageIcon, Activity, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { AdminUserActivity } from "@/components/AdminUserActivity";

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
}

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
  email: string;
}

interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: string;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Site settings
  const [siteSettings, setSiteSettings] = useState<SiteSetting[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Logo upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Direct user creation
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Temporary credentials generator
  const [tempUsername, setTempUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempGenerator, setShowTempGenerator] = useState(false);

  // Expiry for codes
  const [expiryDays, setExpiryDays] = useState<number>(7);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    
    if (!authLoading && user && !isAdmin) {
      toast.error("Access denied: Admin privileges required");
      navigate("/");
      return;
    }

    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchUserEmail = async (userId: string): Promise<string> => {
    try {
      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        console.error("Error fetching user email:", error);
        return "N/A";
      }
      return user?.email || "N/A";
    } catch (error) {
      console.error("Error fetching user email:", error);
      return "N/A";
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: codes } = await supabase
        .from("invite_codes")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch email addresses for each profile
      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          const email = await fetchUserEmail(profile.user_id);
          return { ...profile, email };
        })
      );

      const { data: settings } = await supabase
        .from("site_settings")
        .select("*")
        .order("setting_key");

      setInviteCodes(codes || []);
      setUsers(usersWithDetails || []);
      setSiteSettings(settings || []);

      if (settings) {
        const initialSettings = settings.reduce((acc, s) => {
          acc[s.setting_key] = s.setting_value;
          return acc;
        }, {} as Record<string, string>);
        setEditedSettings(initialSettings);
      }
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo.${fileExt}`;

      // Delete old logo if exists
      await supabase.storage.from("site-assets").remove([fileName]);

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("site-assets")
        .getPublicUrl(fileName);

      // Update setting
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ setting_value: publicUrl, updated_at: new Date().toISOString() })
        .eq("setting_key", "logo_url");

      if (updateError) throw updateError;

      setEditedSettings(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success("Logo uploaded successfully!");
      fetchData();
    } catch (error) {
      toast.error("Failed to upload logo");
      console.error(error);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeLogo = async () => {
    try {
      // Clear the setting
      const { error } = await supabase
        .from("site_settings")
        .update({ setting_value: "", updated_at: new Date().toISOString() })
        .eq("setting_key", "logo_url");

      if (error) throw error;

      setEditedSettings(prev => ({ ...prev, logo_url: "" }));
      toast.success("Logo removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to remove logo");
    }
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    try {
      const code = `JBL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { error } = await supabase.from("invite_codes").insert({
        code,
        created_by: user?.id,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      toast.success("Invite code generated!");
      fetchData();
    } catch (error) {
      toast.error("Failed to generate code");
    } finally {
      setGeneratingCode(false);
    }
  };

  const deleteInviteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from("invite_codes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Invite code deleted");
      setInviteCodes(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      toast.error("Failed to delete code");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteUser = async (userId: string, username: string) => {
    if (userId === user?.id) {
      toast.error("You cannot delete your own account");
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error, data } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || `User "${username}" has been deleted`);
      fetchData(); // Refresh the user list
    } catch (error) {
      toast.error("Failed to delete user: " + (error instanceof Error ? error.message : "Unknown error"));
      console.error("Error deleting user:", error);
    }
  };

  const copyUserEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const createUserDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("All fields are required");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreatingUser(true);
    try {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", newUsername)
        .maybeSingle();

      if (existingUser) {
        toast.error("Username is already taken");
        setCreatingUser(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newEmail,
          password: newPassword,
          username: newUsername,
        },
      });

      if (error) throw error;

      toast.success(`User "${newUsername}" created successfully!`);
      setShowCreateUser(false);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      for (const setting of siteSettings) {
        if (setting.setting_key === "logo_url") continue; // Logo is handled separately
        const newValue = editedSettings[setting.setting_key];
        if (newValue !== setting.setting_value) {
          const { error } = await supabase
            .from("site_settings")
            .update({ setting_value: newValue, updated_at: new Date().toISOString() })
            .eq("setting_key", setting.setting_key);

          if (error) throw error;
        }
      }
      toast.success("Settings saved successfully!");
      fetchData();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const getSettingLabel = (key: string) => {
    const labels: Record<string, string> = {
      site_name: "Site Name",
      site_description: "Site Description",
      footer_text: "Footer Text",
      login_subtitle: "Login Page Subtitle",
      logo_url: "Logo",
    };
    return labels[key] || key;
  };

  // Generate temporary credentials
  const generateTempCredentials = () => {
    // Generate temporary username with timestamp
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const randomPart = Math.random().toString(36).substring(2, 8); // Random string
    const username = `temp_${timestamp}_${randomPart}`;

    // Generate temporary password with mixed characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setTempUsername(username);
    setTempPassword(password);
    toast.success("Temporary credentials generated!");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const logoUrl = editedSettings.logo_url;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-crimson-subtle">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-foreground">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">User & Site Management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Site Settings Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Site Settings</h2>
            </div>
            <Button
              onClick={saveSettings}
              disabled={savingSettings}
              className="gap-2"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            {/* Logo Upload Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Site Logo
              </label>
              
              <div className="flex items-center gap-4">
                {/* Logo Preview */}
                <div className="w-20 h-20 rounded-lg bg-surface border border-border flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Site Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Skull className="w-10 h-10 text-primary" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="gap-2"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </Button>
                  
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeLogo}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Logo
                    </Button>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Recommended: Square image, max 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Other Settings */}
            {siteSettings
              .filter(s => s.setting_key !== "logo_url")
              .map((setting) => (
                <div key={setting.id} className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {getSettingLabel(setting.setting_key)}
                  </label>
                  {setting.setting_key === "footer_text" ? (
                    <Textarea
                      value={editedSettings[setting.setting_key] || ""}
                      onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
                      className="bg-input border-border font-mono text-sm"
                      rows={2}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={editedSettings[setting.setting_key] || ""}
                      onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
                      className="bg-input border-border font-mono"
                    />
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* Invite Codes Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Invite Codes</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-surface rounded-md px-3 py-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                  className="w-16 h-8 bg-transparent border-0 text-sm"
                  min={1}
                  max={365}
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              <Button
                onClick={generateInviteCode}
                disabled={generatingCode}
                className="gap-2"
              >
                {generatingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Generate Code
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-4 p-4 bg-surface/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div>Code</div>
              <div>Status</div>
              <div>Expires</div>
              <div className="text-right">Actions</div>
            </div>
            
            {inviteCodes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No invite codes yet. Generate one to get started.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {inviteCodes.map((code) => (
                  <div key={code.id} className="grid grid-cols-4 gap-4 p-4 items-center">
                    <div className="font-mono text-sm text-foreground">{code.code}</div>
                    <div>
                      {code.used_by ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                          <Check className="w-3 h-3" />
                          Used
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {code.expires_at 
                        ? new Date(code.expires_at).toLocaleDateString()
                        : "Never"}
                    </div>
                    <div className="flex justify-end gap-2">
                      {!code.used_by && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyCode(code.code)}
                          className="h-8 w-8"
                        >
                          {copiedCode === code.code ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteInviteCode(code.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Create User Directly */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Create User Directly</h2>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCreateUser(!showCreateUser)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {showCreateUser ? "Cancel" : "New User"}
            </Button>
          </div>

          {showCreateUser && (
            <form onSubmit={createUserDirectly} className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Username..."
                    className="bg-input border-border font-mono"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
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
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password..."
                    className="bg-input border-border font-mono"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={creatingUser} className="gap-2">
                {creatingUser ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Create User
              </Button>
            </form>
          )}
        </section>

        {/* Temporary Credentials Generator */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Generate Temporary Credentials</h2>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowTempGenerator(!showTempGenerator);
                if (!showTempGenerator) {
                  generateTempCredentials(); // Auto-generate when opening
                }
              }}
              className="gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {showTempGenerator ? "Hide Generator" : "Show Generator"}
            </Button>
          </div>

          {showTempGenerator && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Temporary Username</p>
                    <p className="font-mono text-sm truncate">{tempUsername || "Click generate to create credentials"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(tempUsername, "Username")}
                    disabled={!tempUsername}
                    className="ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Temporary Password</p>
                    <p className="font-mono text-sm truncate">{tempPassword || "Click generate to create credentials"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(tempPassword, "Password")}
                    disabled={!tempPassword}
                    className="ml-2"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={generateTempCredentials}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Generate New
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTempUsername("");
                    setTempPassword("");
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="text-sm text-muted-foreground bg-surface/50 p-4 rounded-lg">
                <p className="font-medium mb-1">How to use temporary credentials:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Generate temporary username and password using this tool</li>
                  <li>Use these credentials to create a new user account</li>
                  <li>Share the credentials with the user for their initial login</li>
                  <li>Advise the user to change their password after first login</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Users List */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Users ({users.length})</h2>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-4 p-4 bg-surface/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div>Username</div>
              <div>Email</div>
              <div>Joined</div>
              <div className="text-right">Actions</div>
            </div>

            {users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No users yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((profile) => (
                  <div key={profile.id} className="grid grid-cols-4 gap-4 p-4 items-center">
                    <div className="font-medium text-foreground">{profile.username}</div>
                    <div className="font-mono text-xs text-muted-foreground truncate">
                      <div className="flex items-center justify-between">
                        {profile.email}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyUserEmail(profile.email)}
                          className="h-6 w-6 ml-2"
                          title="Copy email"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteUser(profile.user_id, profile.username)}
                        className="h-8 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* User Activity Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">User Activity</h2>
          </div>
          <AdminUserActivity />
        </section>
      </main>
    </div>
  );
}
