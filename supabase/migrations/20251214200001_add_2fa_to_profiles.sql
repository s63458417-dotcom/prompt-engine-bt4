-- Add 2FA column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Update the RLS policies to allow users to update their 2FA settings
-- The existing policy already allows users to update their own profile, so we're good