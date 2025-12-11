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
      // Hugging Face Inference API format for text generation models
      // The apiEndpoint is expected to be the full model URL (e.g., https://api-inference.huggingface.co/models/gpt2)

      // For Hugging Face text generation models, format as a single prompt
      // Combine the jailbreak prompt and user message appropriately
      let fullPrompt = "";

      // Create a conversation-like prompt that works with instruction models
      if (conversationHistory.length > 0) {
        // Build the conversation history
        let historyPrompt = "";
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            historyPrompt += `User: ${msg.content}\n`;
          } else if (msg.role === "assistant") {
            historyPrompt += `Assistant: ${msg.content}\n`;
          }
        }
        fullPrompt = `${effectivePrompt}\n\n${historyPrompt}\nUser: ${userMessage}\nAssistant:`;
      } else {
        // No conversation history
        fullPrompt = `${effectivePrompt}\n\nUser: ${userMessage}\nAssistant:`;
      }

      const huggingFaceBody: Record<string, unknown> = {
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 200,
          top_k: 50,
          top_p: 0.95,
          temperature: 0.7,
          repetition_penalty: 1.0,
          max_time: 30.0, // Increase time for potentially slower first loads
        },
        options: {
          use_cache: false,
          wait_for_model: true  // Wait for model to load if not loaded
        }
      };

      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(huggingFaceBody),
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
        const errorData = responseData as { error?: string, errors?: string[], estimated_time?: number };
        if (response.status === 503) {
          // Model might be loading, provide specific guidance
          throw new Error(`Model is currently loading. Estimated time: ${errorData.estimated_time || 'unknown'} seconds. Try again later.`);
        }
        throw new Error(errorData.error || errorData.errors?.join(", ") || `Hugging Face API error: ${response.status}`);
      }

      // Handle different response formats depending on model type
      let responseTextResult = "No response";

      if (Array.isArray(responseData)) {
        // For text generation models, response is typically an array like [{ generated_text: "..." }]
        if ('generated_text' in responseData[0]) {
          responseTextResult = (responseData[0] as { generated_text: string }).generated_text || "No response";
        } else if ('answer' in responseData[0]) {
          // For QA models, response might be like [{ answer: "... ", score: 0.x, ... }]
          responseTextResult = (responseData[0] as { answer: string }).answer || "No answer provided";
        } else if ('translation_text' in responseData[0]) {
          // For translation models
          responseTextResult = (responseData[0] as { translation_text: string }).translation_text || "No translation";
        } else if ('label' in responseData[0]) {
          // For classification models
          responseTextResult = (responseData[0] as { label: string }).label || "No classification";
        } else {
          // Generic handling - return the first item
          responseTextResult = JSON.stringify(responseData[0]);
        }
      } else if (typeof responseData === 'object' && responseData !== null) {
        // For some models that return objects directly
        if ('answer' in responseData) {
          responseTextResult = (responseData as { answer: string }).answer || "No answer provided";
        } else if ('generated_text' in responseData) {
          responseTextResult = (responseData as { generated_text: string }).generated_text || "No response";
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          // Handle case where response is an array at the top level
          if ('answer' in responseData[0]) {
            responseTextResult = (responseData[0] as { answer: string }).answer || "No answer provided";
          } else if ('generated_text' in responseData[0]) {
            responseTextResult = (responseData[0] as { generated_text: string }).generated_text || "No response";
          } else {
            responseTextResult = JSON.stringify(responseData[0]);
          }
        } else {
          // Generic object response
          responseTextResult = JSON.stringify(responseData);
        }
      } else {
        // Fallback to string representation
        responseTextResult = String(responseData);
      }

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
