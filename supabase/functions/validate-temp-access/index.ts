import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // This function can be used to validate temporary access tokens
    // It doesn't require the user to be authenticated normally - the token itself is the authentication
    
    const { temp_token } = await req.json();

    if (!temp_token) {
      return new Response(
        JSON.stringify({ error: "Temporary token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to check the token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find the token in the database
    const { data: tokenRecord, error: selectError } = await adminClient
      .from("temp_auth_tokens")
      .select("user_id, purpose, expires_at, used")
      .eq("token", temp_token)
      .eq("purpose", "temporary_access")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (selectError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid, expired, or already used temporary access token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark the token as used to prevent reuse
    const { error: updateError } = await adminClient
      .from("temp_auth_tokens")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("token", temp_token);

    if (updateError) {
      console.error("Error updating token as used:", updateError);
      return new Response(
        JSON.stringify({ error: "Error validating temporary access token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: tokenRecord.user_id,
        message: "Temporary access token is valid",
        purpose: tokenRecord.purpose
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in validate-temp-access:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});