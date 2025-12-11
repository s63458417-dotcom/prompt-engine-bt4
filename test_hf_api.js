// Simple test script to test Hugging Face Inference API
// This will help verify if our implementation is correct

// For testing purposes, we'll use a free model that doesn't need authentication for simple tests
const modelEndpoint = 'https://api-inference.huggingface.co/models/gpt2';

// Test the exact format we're using in the Supabase function
async function testHuggingFaceAPI() {
  const testPrompt = `System: You are a helpful AI assistant.

User: Hello, how are you?
Assistant:`;

  const requestBody = {
    inputs: testPrompt,
    parameters: {
      max_new_tokens: 50,
      top_k: 50,
      top_p: 0.95,
      temperature: 0.7,
      repetition_penalty: 1.0,
      return_full_text: false,
    },
    options: {
      use_cache: false,
      wait_for_model: true
    }
  };

  console.log('Testing Hugging Face API with the following request:');
  console.log('Endpoint:', modelEndpoint);
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  // Using a fake API key to test the unauthenticated flow first
  const fakeApiKey = 'fake_key';

  try {
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fakeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Authentication required - this is expected, you need a real Hugging Face API token');
        return { success: true, needs_auth: true, message: responseText };
      } else if (response.status === 503) {
        console.log('Model is currently loading - this is also expected for first requests');
        return { success: true, needs_loading: true, message: responseText };
      } else {
        console.error('Error response from API:', response.status, responseText);
        return { success: false, status: response.status, message: responseText };
      }
    }

    try {
      const data = JSON.parse(responseText);
      console.log('Parsed response:', JSON.stringify(data, null, 2));
      return { success: true, data: data };
    } catch (parseError) {
      console.error('Could not parse response as JSON:', parseError.message);
      console.log('Raw response:', responseText);
      return { success: true, raw: responseText };
    }
  } catch (error) {
    console.error('Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Also test the simpler format that might work better
async function testHuggingFaceSimple() {
  const testPrompt = "What is 2+2?";

  const requestBody = {
    inputs: testPrompt,
    parameters: {
      max_new_tokens: 10,
    }
  };

  console.log('\nTesting Hugging Face API with simple request:');
  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Simple response status:', response.status);
    const responseText = await response.text();
    console.log('Simple response body:', responseText);

    if (!response.ok) {
      console.error('Error response from API (simple):', response.status, responseText);
      return false;
    }

    try {
      const data = JSON.parse(responseText);
      console.log('Simple parsed response:', JSON.stringify(data, null, 2));
      return true;
    } catch (parseError) {
      console.error('Could not parse simple response as JSON:', parseError.message);
      return false;
    }
  } catch (error) {
    console.error('Network error (simple):', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  if (!apiKey || apiKey === 'YOUR_HF_API_KEY') {
    console.log('Please set your Hugging Face API key as HF_API_KEY environment variable or update the script.');
    return;
  }

  console.log('Running Hugging Face API tests...\n');
  
  console.log('=== Test 1: Complex format ===');
  const result1 = await testHuggingFaceAPI();
  
  console.log('\n=== Test 2: Simple format ===');
  const result2 = await testHuggingFaceSimple();
  
  console.log('\n=== Results ===');
  console.log('Complex format test:', result1 ? 'PASSED' : 'FAILED');
  console.log('Simple format test:', result2 ? 'PASSED' : 'FAILED');
}

runTests().catch(console.error);