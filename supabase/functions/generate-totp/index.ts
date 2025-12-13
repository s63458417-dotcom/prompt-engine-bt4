import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function to generate a time-based token
const generateTOTP = (secret: string, period: number = 30): string => {
  const epoch = Math.floor(Date.now() / 1000);
  const timeCounter = Math.floor(epoch / period);
  
  // Create a buffer for the time counter
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, timeCounter, false); // Store time counter as big-endian
  
  // This is a simplified approach - for production, you'd want to implement proper TOTP algorithm
  // using HMAC-SHA1, but for this implementation we'll use a simpler approach
  const timeStr = timeCounter.toString();
  const combined = secret + timeStr;
  
  // Generate a 6-digit code based on the hash of the combined string
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  const code = Math.abs(hash) % 1000000;
  return code.toString().padStart(6, '0');
};

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

    // Parse request body
    const { purpose } = await req.json();
    if (!purpose) {
      return new Response(
        JSON.stringify({ error: "Purpose is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a secret based on the user ID, purpose and current timestamp
    const secret = `${callingUser.id}-${purpose}-${Date.now()}`;
    const token = generateTOTP(secret);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Store the token in the database if needed for verification
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Insert the token for later verification if needed
    const { error: insertError } = await adminClient
      .from("temp_auth_tokens")
      .insert({
        user_id: callingUser.id,
        token: token,
        purpose: purpose,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error("Error storing token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token,
        expires_at: expiresAt.toISOString(),
        message: "TOTP token generated successfully"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in generate-totp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* To use this function, you need to create the temp_auth_tokens table in your Supabase database:

CREATE TABLE temp_auth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_temp_auth_tokens_user_id (user_id),
  INDEX idx_temp_auth_tokens_token (token),
  INDEX idx_temp_auth_tokens_expires_at (expires_at)
);

-- Optional: Create a periodic job to clean up expired tokens
-- This is a PostgreSQL event trigger function that could be scheduled
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM temp_auth_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

*/