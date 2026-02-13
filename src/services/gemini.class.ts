import { GoogleGenerativeAI } from "@google/generative-ai";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";

/**
 * GeminiService Class
 * Handles interactions with Google's Gemini AI models using the standard SDK.
 */
class GeminiService extends EventEmitter {
  private genAI: GoogleGenerativeAI;
  private isInitialized: boolean = false;
  private cachePath: string;

  constructor(apiKey: string) {
    super();

    if (!apiKey || apiKey.length === 0) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.cachePath = path.resolve(process.cwd(), "src/data/.gemini_cache.json");
  }

  /**
   * Generates content using context provided (Vector RAG style) with History support.
   */
  async generateTextWithContext(systemInstruction: string, userMessage: string, context: string, history: any[] = [], model: string = "gemini-flash-latest"): Promise<string | null> {
    try {
      const generativeModel = this.genAI.getGenerativeModel({
        model: model,
        systemInstruction: systemInstruction
      });

      // Format history and ensure it starts with a 'user' role
      let rawHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      // 1. Gemini SDK requires history to start with 'user'
      const firstUserIndex = rawHistory.findIndex(m => m.role === 'user');
      if (firstUserIndex !== -1) {
        rawHistory = rawHistory.slice(firstUserIndex);
      } else {
        rawHistory = [];
      }

      // 2. Gemini SDK requires alternating roles (user, model, user, model)
      const chatHistory: any[] = [];
      for (const msg of rawHistory) {
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === msg.role) {
          // Merge consecutive messages from same role
          chatHistory[chatHistory.length - 1].parts[0].text += `\n${msg.parts[0].text}`;
        } else {
          chatHistory.push(msg);
        }
      }

      const chat = generativeModel.startChat({
        history: chatHistory,
      });

      const fullPrompt = `Contexto Recuperado:\n${context}\n\nPregunta: ${userMessage}`;

      const result = await chat.sendMessage(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error(`[GeminiService] Error generating content with context:`, error.message || error);
      return null;
    }
  }

  /**
   * Generates embeddings for a given text.
   */
  async getEmbeddings(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("[GeminiService] Error generating embeddings:", error);
      throw error;
    }
  }

  /**
   * Compatibility method for older multimodal approach.
   */
  async generateText(systemInstruction: string, userMessage: string, model: string = "gemini-flash-latest"): Promise<string | null> {
    try {
      const generativeModel = this.genAI.getGenerativeModel({
        model: model,
        systemInstruction: systemInstruction
      });

      const result = await generativeModel.generateContent(userMessage);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error(`[GeminiService] Error generating content with ${model}:`, error.message || error);
      return null;
    }
  }

  /**
   * Placeholder for file initialization (not strictly needed for Vector RAG but kept for compatibility).
   */
  async initializeFile(filePath: string): Promise<void> {
    this.isInitialized = true;
    console.log("[GeminiService] Vector Mode Initialized (PDF handled via Pinecone).");
  }
}






export default GeminiService;
