import { GoogleGenAI } from "@google/genai";
import { EventEmitter } from "node:events";
import path from "node:path";

/**
 * GeminiService Class
 * Handles interactions with Google's Gemini AI models, including File Search (RAG).
 */
class GeminiService extends EventEmitter {
  private ai: any;
  private fileSearchStore: any = null;
  private isInitialized: boolean = false;

  constructor(apiKey: string) {
    super();

    if (!apiKey || apiKey.length === 0) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    this.ai = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Initializes the File Search store and uploads the context PDF.
   * This should be called before generateText if context is needed.
   */
  async initializeFileSearch(filePath: string, storeDisplayName: string = "EmployeeInfoStore"): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(`Initializing File Search with: ${filePath}`);

      // 1. Create or get the store
      this.fileSearchStore = await this.ai.fileSearchStores.create({
        config: { displayName: storeDisplayName }
      });

      // 2. Upload and import the file
      let operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
        file: filePath,
        fileSearchStoreName: this.fileSearchStore.name,
        config: {
          displayName: path.basename(filePath),
        }
      });

      // 3. Poll for completion
      while (!operation.done) {
        console.log("Waiting for file indexing...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await this.ai.operations.get({ operation });
      }

      this.isInitialized = true;
      console.log("File Search initialized successfully.");
    } catch (error) {
      console.error("Error initializing File Search:", error);
      throw error;
    }
  }

  /**
   * Generates content based on a text prompt, using the initialized File Search store as context.
   * @param prompt The text prompt to send to the model.
   * @param model The Gemini model to use (default: gemini-2.0-flash).
   * @returns The generated text or null if an error occurs.
   */
  async generateText(prompt: string, model: string = "gemini-2.0-flash"): Promise<string | null> {
    try {
      const config: any = {};

      // If File Search is initialized, add it as a tool
      if (this.isInitialized && this.fileSearchStore) {
        config.tools = [
          {
            fileSearch: {
              fileSearchStoreNames: [this.fileSearchStore.name]
            }
          }
        ];
      }

      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
      });

      return response.text;
    } catch (error) {
      console.error("Error generating content with Gemini:", error);
      return null;
    }
  }
}

export default GeminiService;
