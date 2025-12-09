-- Create table to store user's saved API endpoints
CREATE TABLE public.user_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  model_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_endpoints ENABLE ROW LEVEL SECURITY;

-- Users can manage their own endpoints
CREATE POLICY "Users can view their own endpoints" 
ON public.user_endpoints FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own endpoints" 
ON public.user_endpoints FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own endpoints" 
ON public.user_endpoints FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own endpoints" 
ON public.user_endpoints FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all endpoints
CREATE POLICY "Admins can view all endpoints" 
ON public.user_endpoints FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for chat conversations
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  api_endpoint TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations" 
ON public.conversations FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" 
ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" 
ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all messages" 
ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create table for usage tracking
CREATE TABLE public.usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_endpoint TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" 
ON public.usage_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own usage logs" 
ON public.usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage" 
ON public.usage_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update trigger for conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for user_endpoints
CREATE TRIGGER update_user_endpoints_updated_at
BEFORE UPDATE ON public.user_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();