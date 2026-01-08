import { GoogleGenAI } from "@google/genai";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";

/**
 * GeminiService Class
 * Handles interactions with Google's Gemini AI models, including File Search (RAG).
 */
class GeminiService extends EventEmitter {
  private ai: any;
  private fileSearchStore: any = null;
  private isInitialized: boolean = false;
  private cachePath: string;

  constructor(apiKey: string) {
    super();

    if (!apiKey || apiKey.length === 0) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    this.ai = new GoogleGenAI({
      apiKey: apiKey,
    });
    this.cachePath = path.resolve(process.cwd(), "src/data/.gemini_cache.json");
    this.loadCache();
  }

  /**
   * Loads the cached store name from disk.
   */
  private loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const cacheRaw = fs.readFileSync(this.cachePath, 'utf-8');
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          if (cache.storeName) {
            this.fileSearchStore = { name: cache.storeName };
            this.isInitialized = true;
            console.log(`[GeminiService] Loaded cached store: ${cache.storeName}`);
          }
        }
      }
    } catch (error) {
      console.error("[GeminiService] Error loading cache:", error);
    }
  }

  /**
   * Saves the store name to disk cache.
   */
  private saveCache() {
    try {
      if (this.fileSearchStore) {
        fs.writeFileSync(this.cachePath, JSON.stringify({ storeName: this.fileSearchStore.name, updatedAt: new Date().toISOString() }));
        console.log(`[GeminiService] Saved store to cache: ${this.fileSearchStore.name}`);
      }
    } catch (error) {
      console.error("[GeminiService] Error saving cache:", error);
    }
  }

  /**
   * Initializes the File Search store and uploads the context PDF.
   * This should be called before generateText if context is needed.
   */
  async initializeFileSearch(filePath: string, storeDisplayName: string = "EmployeeInfoStore"): Promise<void> {
    if (this.isInitialized) {
      console.log(`[GeminiService] Already initialized with store: ${this.fileSearchStore?.name}`);
      return;
    }

    try {
      console.log(`[GeminiService] Initializing File Search with: ${filePath}`);

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
        console.log("[GeminiService] Waiting for file indexing...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await this.ai.operations.get({ operation });
      }

      this.isInitialized = true;
      this.saveCache();
      console.log("[GeminiService] File Search initialized successfully.");
    } catch (error) {
      console.error("[GeminiService] Error initializing File Search:", error);
      throw error;
    }
  }

  /**
   * Generates content based on a text prompt, using the initialized File Search store as context.
   * @param prompt The text prompt to send to the model.
   * @param model The Gemini model to use (default: gemini-flash-latest).
   * @returns The generated text or null if an error occurs.
   */
  async generateText(prompt: string, model: string = "gemini-flash-latest"): Promise<string | null> {
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
    } catch (error: any) {
      if (error.status === 404) {
        console.warn("[GeminiService] Store not found. Clearing cache.");
        this.isInitialized = false;
        this.fileSearchStore = null;
        if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
      }
      console.error("[GeminiService] Error generating content:", error);
      return null;
    }
  }
}



export default GeminiService;
