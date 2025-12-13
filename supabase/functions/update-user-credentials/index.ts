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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { newUsername, newPassword, targetUserId } = await req.json();

    // Determine which user to update
    let userIdToUpdate = user.id;
    if (targetUserId) {
      // Only admin can update other users
      const { data: roleData } = await supabaseUser
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) {
        userIdToUpdate = targetUserId;
      } else {
        return new Response(
          JSON.stringify({ error: "Admin privileges required to update other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If updating own credentials, verify that new credentials are provided
    if (userIdToUpdate === user.id) {
      // Validate at least one field is provided
      if (!newUsername && !newPassword) {
        return new Response(
          JSON.stringify({ error: "At least one of newUsername or newPassword is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate username if provided
    if (newUsername !== undefined && newUsername !== null && newUsername !== "") {
      if (!isValidUsername(newUsername)) {
        return new Response(
          JSON.stringify({ error: "Invalid username. Must be 3-50 characters, alphanumeric with underscores/hyphens only." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate password if provided
    if (newPassword !== undefined && newPassword !== null && newPassword !== "") {
      if (!isValidPassword(newPassword)) {
        return new Response(
          JSON.stringify({ error: "Invalid password. Must be 6-128 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create admin client for updates
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update username if provided
    if (newUsername && newUsername.trim()) {
      // Check if username is taken
      const { data: existingUser } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("username", newUsername.trim())
        .neq("user_id", userIdToUpdate)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "Username is already taken" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ username: newUsername.trim(), updated_at: new Date().toISOString() })
        .eq("user_id", userIdToUpdate);

      if (updateError) {
        console.error("Error updating username:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update username" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update password if provided
    if (newPassword && newPassword.length >= 6) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userIdToUpdate,
        { password: newPassword }
      );

      if (passwordError) {
        console.error("Error updating password:", passwordError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: userIdToUpdate === user.id
          ? "Credentials updated successfully"
          : `Credentials updated successfully for user ${userIdToUpdate}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-user-credentials:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
