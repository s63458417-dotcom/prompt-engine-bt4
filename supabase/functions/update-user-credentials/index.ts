import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
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

    const { newUsername, newPassword } = await req.json();

    // Create admin client for updates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
        .neq("user_id", user.id)
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
        .eq("user_id", user.id);

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
        user.id,
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
      JSON.stringify({ success: true, message: "Credentials updated successfully" }),
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