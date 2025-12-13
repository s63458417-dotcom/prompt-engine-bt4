import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if calling user is admin
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin privileges required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { userId, username } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent admin from deleting themselves
    if (userId === callingUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, delete related records from other tables to avoid foreign key constraints
    // We'll track how many records were deleted for better reporting
    const { error: deleteMessagesError, count: messagesCount } = await adminClient
      .from("chat_messages")
      .delete()
      .eq("user_id", userId)
      .select(); // Use select to get count

    if (deleteMessagesError) {
      console.error("Error deleting chat messages:", deleteMessagesError);
    }

    const { error: deleteConversationsError, count: conversationsCount } = await adminClient
      .from("conversations")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteConversationsError) {
      console.error("Error deleting conversations:", deleteConversationsError);
    }

    const { error: deleteUsageLogsError, count: usageLogsCount } = await adminClient
      .from("usage_logs")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteUsageLogsError) {
      console.error("Error deleting usage logs:", deleteUsageLogsError);
    }

    const { error: deleteUserEndpointsError, count: endpointsCount } = await adminClient
      .from("user_endpoints")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteUserEndpointsError) {
      console.error("Error deleting user endpoints:", deleteUserEndpointsError);
    }

    const { error: deleteUserTemplatesError, count: templatesCount } = await adminClient
      .from("user_templates")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteUserTemplatesError) {
      console.error("Error deleting user templates:", deleteUserTemplatesError);
    }

    const { error: deleteUserRolesError, count: rolesCount } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteUserRolesError) {
      console.error("Error deleting user roles:", deleteUserRolesError);
    }

    const { error: deleteProfilesError, count: profilesCount } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteProfilesError) {
      console.error("Error deleting profile:", deleteProfilesError);
    }

    // Also delete any temp auth tokens associated with this user (will be auto-cascaded in foreign key but good to be explicit)
    const { error: deleteTempTokensError, count: tempTokensCount } = await adminClient
      .from("temp_auth_tokens")
      .delete()
      .eq("user_id", userId)
      .select();

    if (deleteTempTokensError) {
      console.error("Error deleting temp auth tokens:", deleteTempTokensError);
    }

    // Now delete the auth user
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      // If the auth deletion fails, return an error
      return new Response(
        JSON.stringify({ error: "Failed to delete user account from authentication system" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User "${username || userId}" has been deleted`,
        deleted_counts: {
          chat_messages: messagesCount || 0,
          conversations: conversationsCount || 0,
          usage_logs: usageLogsCount || 0,
          user_endpoints: endpointsCount || 0,
          user_templates: templatesCount || 0,
          user_roles: rolesCount || 0,
          profiles: profilesCount || 0,
          temp_auth_tokens: tempTokensCount || 0
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in admin-delete-user:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});