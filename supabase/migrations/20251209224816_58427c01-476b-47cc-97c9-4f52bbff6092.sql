-- Drop the current policy that exposes all valid invite codes
DROP POLICY IF EXISTS "Anyone can use valid invite codes" ON public.invite_codes;

-- Create a more restrictive policy that only allows checking a specific code
-- This prevents enumeration of all valid codes
CREATE POLICY "Anyone can check a specific invite code" 
ON public.invite_codes 
FOR SELECT 
USING (
  (used_by IS NULL) 
  AND ((expires_at IS NULL) OR (expires_at > now()))
);

-- Note: The actual security comes from how the frontend queries.
-- To properly restrict this, we'll create a function that validates codes securely
CREATE OR REPLACE FUNCTION public.validate_invite_code(code_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_codes
    WHERE code = code_to_check
    AND used_by IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Now update the SELECT policy to be admin-only for listing
DROP POLICY IF EXISTS "Anyone can check a specific invite code" ON public.invite_codes;

-- Only admins can list/view invite codes
CREATE POLICY "Only admins can list invite codes" 
ON public.invite_codes 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anyone to use the validate function (which doesn't expose all codes)
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO anon, authenticated;