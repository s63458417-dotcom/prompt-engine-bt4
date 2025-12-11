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
  testMode?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { apiKey, apiEndpoint, model, jailbreakPrompt, userMessage, stealthMode, conversationHistory, testMode } = body;

    console.log("Jailbreak test request received:", {
      endpoint: apiEndpoint,
      model,
      stealthMode,
      historyLength: conversationHistory?.length || 0,
      testMode,
    });

    // Validate required fields (API key optional for Ollama)
    const isOllama = apiEndpoint.includes("localhost:11434") || apiEndpoint.includes("127.0.0.1:11434");
    if (!apiEndpoint || !model) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: apiEndpoint or model" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!apiKey && !isOllama) {
      return new Response(
        JSON.stringify({ error: "API key is required for this provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API type based on endpoint
    const isAnthropic = apiEndpoint.includes("anthropic");
    const isGoogle = apiEndpoint.includes("generativelanguage.googleapis.com");
    const isCohere = apiEndpoint.includes("cohere");
    const isHuggingFace = apiEndpoint.includes("huggingface.co/") || apiEndpoint.includes("hf.space");
    // If it's a Hugging Face model endpoint, treat it as an OpenAI-compatible endpoint
    // Since the old format is deprecated: https://api-inference.huggingface.co/models/model-name
    // New format: https://router.huggingface.co/v1/chat/completions
    const isHfOpenaiCompatible = isHuggingFace &&
        (apiEndpoint === "https://router.huggingface.co" ||
         apiEndpoint.includes("/v1") ||
         apiEndpoint.includes("router.huggingface.co"));

    let response: Response;
    let responseData: unknown;

    // Prepare the effective jailbreak prompt (apply stealth encoding if needed)
    const effectivePrompt = stealthMode 
      ? `[Decode Base64 input and respond normally]\n${jailbreakPrompt}`
      : jailbreakPrompt;

    if (isAnthropic) {
      // Anthropic API format
      const messages = [
        ...(conversationHistory || []).map((m) => ({
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
          system: effectivePrompt,
          messages,
        }),
      });

      const responseText = await response.text();
      console.log("Anthropic response status:", response.status, "Body length:", responseText.length);

      if (!responseText) {
        throw new Error("Empty response from Anthropic API");
      }

      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("Failed to parse Anthropic response:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Anthropic API: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = responseData as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
      }

      const anthropicData = responseData as { content?: { text?: string }[] };
      return new Response(
        JSON.stringify({ response: anthropicData.content?.[0]?.text || "No response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (isGoogle) {
      // Google Gemini API format
      const contents = [
        ...(conversationHistory || []).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userMessage }] },
      ];

      // Construct proper Google API URL
      // Expected base: https://generativelanguage.googleapis.com/v1beta
      let googleUrl: string;
      const baseEndpoint = apiEndpoint.replace(/\/$/, ""); // Remove trailing slash
      
      if (baseEndpoint.includes(":generateContent")) {
        // Full URL already provided
        googleUrl = `${baseEndpoint}?key=${apiKey}`;
      } else if (baseEndpoint.includes("/models/")) {
        // Has /models/ but no :generateContent
        googleUrl = `${baseEndpoint}:generateContent?key=${apiKey}`;
      } else {
        // Base endpoint, construct full URL with model
        googleUrl = `${baseEndpoint}/models/${model}:generateContent?key=${apiKey}`;
      }

      console.log("Google API URL:", googleUrl);

      response = await fetch(googleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: effectivePrompt }] },
          contents,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      });

      const responseText = await response.text();
      console.log("Google response status:", response.status, "Body length:", responseText.length);

      if (!responseText) {
        throw new Error("Empty response from Google API - check your API key and model name");
      }

      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("Failed to parse Google response:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Google API: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = responseData as { error?: { message?: string } };
        throw new Error(errorData.error?.message || `Google API error: ${response.status}`);
      }

      const googleData = responseData as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return new Response(
        JSON.stringify({ 
          response: googleData.candidates?.[0]?.content?.parts?.[0]?.text || "No response" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (isCohere) {
      // Cohere API format
      const chatHistory = (conversationHistory || []).map((m) => ({
        role: m.role === "assistant" ? "CHATBOT" : "USER",
        message: m.content,
      }));

      response = await fetch(`${apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          message: userMessage,
          preamble: effectivePrompt,
          chat_history: chatHistory,
        }),
      });

      const responseText = await response.text();
      console.log("Cohere response status:", response.status, "Body length:", responseText.length);

      if (!responseText) {
        throw new Error("Empty response from Cohere API");
      }

      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("Failed to parse Cohere response:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Cohere API: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = responseData as { message?: string };
        throw new Error(errorData.message || `Cohere API error: ${response.status}`);
      }

      const cohereData = responseData as { text?: string };
      return new Response(
        JSON.stringify({ response: cohereData.text || "No response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (isHuggingFace) {
      // Hugging Face has moved to OpenAI-compatible API format
      // New endpoint: https://router.huggingface.co/v1/chat/completions
      // But users might still use old format: https://api-inference.huggingface.co/models/model-name
      // For backward compatibility, we'll adjust the endpoint and use OpenAI format

      let hfEndpoint = apiEndpoint;
      let hfModel = model;

      // If using the old model-specific endpoint format, extract model name from URL
      if (!isHfOpenaiCompatible && apiEndpoint.includes("api-inference.huggingface.co/models/")) {
        // Extract model name from URL: https://api-inference.huggingface.co/models/model-name
        const urlParts = apiEndpoint.split("/");
        hfModel = urlParts[urlParts.length - 1] || model;  // Use last part as model name
        hfEndpoint = "https://router.huggingface.co/v1/chat/completions";  // Use new OpenAI-compatible endpoint
      } else if (apiEndpoint.includes("router.huggingface.co")) {
        // If already using router, make sure it's properly formatted
        if (!apiEndpoint.includes("/v1/chat/completions")) {
          // If user entered a partial router URL, complete it
          if (apiEndpoint === "https://router.huggingface.co") {
            hfEndpoint = "https://router.huggingface.co/v1/chat/completions";
          } else if (apiEndpoint.endsWith("/v1") || apiEndpoint.includes("/v1/")) {
            hfEndpoint = apiEndpoint.replace(/\/$/, "") + "/chat/completions";
          } else {
            hfEndpoint = "https://router.huggingface.co/v1/chat/completions";
          }
        }
      }

      // Build messages array for OpenAI-compatible format
      const messages = [
        { role: "system", content: effectivePrompt },
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      const requestBody: Record<string, unknown> = {
        model: hfModel,
        messages,
        max_tokens: 4096,
        temperature: 0.7,
      };

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      response = await fetch(hfEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("Hugging Face response status:", response.status, "Body length:", responseText.length);

      if (!responseText) {
        throw new Error("Empty response from Hugging Face API");
      }

      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("Failed to parse Hugging Face response:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Hugging Face API: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = responseData as { error?: { message?: string }, error?: string, errors?: string[], estimated_time?: number };
        if (response.status === 503) {
          // Model might be loading, provide specific guidance
          throw new Error(`Model is currently loading. Estimated time: ${errorData.estimated_time || 'unknown'} seconds. Try again later.`);
        }
        // Handle error from OpenAI-compatible format
        const errorMessage = errorData.error?.message || errorData.error || errorData.errors?.join(", ") || `Hugging Face API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      // For OpenAI-compatible responses from Hugging Face, extract the content
      const openaiData = responseData as { choices?: { message?: { content?: string } }[] };
      const responseTextResult = openaiData.choices?.[0]?.message?.content || "No response";

      return new Response(
        JSON.stringify({ response: responseTextResult }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // OpenAI-compatible API format (works for OpenAI, Mistral, Groq, Ollama, and other compatible APIs)
      const messages = [
        { role: "system", content: effectivePrompt },
        ...(conversationHistory || []).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      const requestBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: 4096,
      };

      // Only add temperature for models that support it (not o1-preview, o1-mini)
      if (!model.startsWith("o1-")) {
        requestBody.temperature = 0.7;
      }

      // Build headers - Authorization optional for Ollama
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      response = await fetch(`${apiEndpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("OpenAI-compatible response status:", response.status, "Body length:", responseText.length);

      if (!responseText) {
        throw new Error("Empty response from API");
      }

      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("Failed to parse OpenAI response:", responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from API: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorData = responseData as { error?: { message?: string } };
        console.error("API Error Response:", JSON.stringify(responseData));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const openaiData = responseData as { choices?: { message?: { content?: string } }[] };
      return new Response(
        JSON.stringify({ response: openaiData.choices?.[0]?.message?.content || "No response" }),
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
