import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  jailbreakPrompt: string;
  userMessage: string;
  stealthMode: boolean;
  conversationHistory: { role: string; content: string }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { apiKey, apiEndpoint, model, jailbreakPrompt, userMessage, stealthMode, conversationHistory } = body;

    console.log("Jailbreak test request received:", {
      endpoint: apiEndpoint,
      model,
      stealthMode,
      historyLength: conversationHistory.length,
    });

    // Validate required fields
    if (!apiKey || !apiEndpoint || !model) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: apiKey, apiEndpoint, or model" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API type based on endpoint
    const isOpenAI = apiEndpoint.includes("openai");
    const isAnthropic = apiEndpoint.includes("anthropic");

    let response;
    let responseData;

    if (isAnthropic) {
      // Anthropic API format
      const messages = [
        ...conversationHistory.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      response = await fetch(`${apiEndpoint}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: jailbreakPrompt,
          messages,
        }),
      });

      responseData = await response.json();
      console.log("Anthropic response status:", response.status);

      if (!response.ok) {
        throw new Error(responseData.error?.message || `Anthropic API error: ${response.status}`);
      }

      return new Response(
        JSON.stringify({ response: responseData.content[0]?.text || "No response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // OpenAI-compatible API format (works for OpenAI, Azure, and other compatible APIs)
      const messages = [
        { role: "system", content: jailbreakPrompt },
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      response = await fetch(`${apiEndpoint}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });

      responseData = await response.json();
      console.log("OpenAI response status:", response.status);

      if (!response.ok) {
        throw new Error(responseData.error?.message || `API error: ${response.status}`);
      }

      return new Response(
        JSON.stringify({ response: responseData.choices[0]?.message?.content || "No response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Jailbreak test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
