import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skull, Loader2, KeyRound, UserPlus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [requireInvite, setRequireInvite] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const validateInputs = () => {
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
        return false;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
        return false;
      }
    }

    if (mode === "signup" && !username.trim()) {
      toast.error("Username is required");
      return false;
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // Validate invite code if required
      if (requireInvite && inviteCode) {
        const { data: codeData, error: codeError } = await supabase
          .from("invite_codes")
          .select("*")
          .eq("code", inviteCode)
          .is("used_by", null)
          .maybeSingle();

        if (codeError || !codeData) {
          toast.error("Invalid or expired invite code");
          setLoading(false);
          return;
        }

        // Check if expired
        if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
          toast.error("This invite code has expired");
          setLoading(false);
          return;
        }
      } else if (requireInvite) {
        toast.error("Invite code is required");
        setLoading(false);
        return;
      }

      // Check if username is taken
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        toast.error("Username is already taken");
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: username,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Mark invite code as used
      if (inviteCode && data.user) {
        await supabase
          .from("invite_codes")
          .update({ 
            used_by: data.user.id,
            used_at: new Date().toISOString()
          })
          .eq("code", inviteCode);
      }

      toast.success("Account created successfully!");
      navigate("/");
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Check if any users exist (first user doesn't need invite code)
  useEffect(() => {
    const checkFirstUser = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      
      if (count === 0) {
        setRequireInvite(false);
      }
    };
    checkFirstUser();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4 glow-crimson-subtle">
            <Skull className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2 font-mono">
            JailbreakLab
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login" ? "Access your testing suite" : "Join the research team"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          {/* Mode Toggle */}
          <div className="flex bg-surface rounded-lg p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
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
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email..."
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

            {mode === "signup" && requireInvite && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-3 h-3" />
                  Invite Code
                </label>
                <Input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code..."
                  className="bg-input border-border font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Get an invite code from an admin
                </p>
              </div>
            )}

            {mode === "signup" && !requireInvite && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-primary">
                  🎉 First user signup! You'll automatically become an admin.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          AI Pentesting Suite v2.0 • For authorized research only
        </p>
      </div>
    </div>
  );
}
