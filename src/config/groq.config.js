export default {
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.3,
  maxTokens: 1024,
  topP: 0.9,
  timeout: 30000, // 30 seconds
  maxRetries: 2
};