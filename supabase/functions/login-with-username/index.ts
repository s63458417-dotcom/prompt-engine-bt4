import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation helpers
const isValidUsername = (username: string): boolean => {
  if (!username || typeof username !== "string") return false;
  const trimmed = username.trim();
  // Username: 3-50 chars, alphanumeric, underscores, hyphens only
  return /^[a-zA-Z0-9_-]{3,50}$/.test(trimmed);
};

const isValidPassword = (password: string): boolean => {
  if (!password || typeof password !== "string") return false;
  // Password: 6-128 chars
  return password.length >= 6 && password.length <= 128;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    // Input validation
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUsername(username)) {
      return new Response(
        JSON.stringify({ error: "Invalid username format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidPassword(password)) {
      return new Response(
        JSON.stringify({ error: "Invalid password format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Create admin client to look up user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Look up user by username (server-side only - not exposed)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", username.trim())
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      // Generic error to prevent username enumeration
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      // Generic error to prevent username enumeration
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email (server-side only)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      profile.user_id
    );

    if (userError || !userData?.user?.email) {
      console.error("User lookup error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt sign in with email and password
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: userData.user.email,
      password: password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError.message);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return session data
    return new Response(
      JSON.stringify({
        session: signInData.session,
        user: signInData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in login-with-username:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
