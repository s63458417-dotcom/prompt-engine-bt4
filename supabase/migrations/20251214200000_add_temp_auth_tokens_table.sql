-- Create table for temporary authentication tokens (TOTP)
CREATE TABLE public.temp_auth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_temp_auth_tokens_user_id ON public.temp_auth_tokens(user_id);
CREATE INDEX idx_temp_auth_tokens_token ON public.temp_auth_tokens(token);
CREATE INDEX idx_temp_auth_tokens_expires_at ON public.temp_auth_tokens(expires_at);
CREATE INDEX idx_temp_auth_tokens_used ON public.temp_auth_tokens(used);

-- Enable RLS
ALTER TABLE public.temp_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (if not already available)
-- This function is referenced in other policies and should exist

-- Policies for temp_auth_tokens
-- Users can only access their own tokens
CREATE POLICY "Users can access their own temp auth tokens"
  ON public.temp_auth_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Admins can access all tokens
CREATE POLICY "Admins can access all temp auth tokens"
  ON public.temp_auth_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Optional: Create a periodic job to clean up expired tokens
-- This is a PostgreSQL event trigger function that could be scheduled
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.temp_auth_tokens WHERE expires_at < NOW() OR (used = TRUE AND used_at < NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup function to run every 10 minutes (requires pg_cron extension)
-- Commented out as pg_cron is not always available
-- SELECT cron.schedule('cleanup-expired-tokens', '*/10 * * * *', $$SELECT cleanup_expired_tokens()$$);