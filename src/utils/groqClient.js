import Groq from "groq-sdk";
import groqConfig from "../config/groq.config.js";

class GroqClient {
  constructor() {
    this.client = new Groq({
      apiKey: groqConfig.apiKey,
      timeout: groqConfig.timeout,
      maxRetries: groqConfig.maxRetries,
    });
  }

  async createChatCompletion(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: options.model || groqConfig.model,
        temperature: options.temperature || groqConfig.temperature,
        max_tokens: options.maxTokens || groqConfig.maxTokens,
        top_p: options.topP || groqConfig.topP,
        stream: options.stream || false,
      });

      return completion;
    } catch (error) {
      this.handleGroqError(error);
    }
  }

  handleGroqError(error) {
    if (error instanceof Groq.APIError) {
      console.error("Groq API Error:", {
        status: error.status,
        name: error.name,
        message: error.message,
        headers: error.headers,
      });

      switch (error.status) {
        case 400:
          throw new Error("Invalid request to AI service");
        case 401:
          throw new Error("AI service authentication failed");
        case 429:
          throw new Error("Too many AI requests. Please try again later");
        case 500:
        case 502:
        case 503:
          throw new Error("AI service temporarily unavailable");
        default:
          throw new Error("Failed to process AI request");
      }
    }
    throw error;
  }
}

const groqClient = new GroqClient();
export default groqClient;
