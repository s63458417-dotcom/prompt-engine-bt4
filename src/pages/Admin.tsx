import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Skull, ArrowLeft, Users, KeyRound, Plus, Copy, Check, 
  Trash2, Loader2, UserPlus, Shield, Clock
} from "lucide-react";
import { toast } from "sonner";

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
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Direct user creation
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch invite codes
      const { data: codes } = await supabase
        .from("invite_codes")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      setInviteCodes(codes || []);
      setUsers(profiles || []);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    try {
      // Generate a random code
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
      // Check if username is taken
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

      // Create user via edge function for admin operations
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
                <p className="text-xs text-muted-foreground">User Management</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
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

        {/* Users List */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Users ({users.length})</h2>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 bg-surface/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div>Username</div>
              <div>User ID</div>
              <div>Joined</div>
            </div>
            
            {users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No users yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((profile) => (
                  <div key={profile.id} className="grid grid-cols-3 gap-4 p-4 items-center">
                    <div className="font-medium text-foreground">{profile.username}</div>
                    <div className="font-mono text-xs text-muted-foreground truncate">
                      {profile.user_id}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
