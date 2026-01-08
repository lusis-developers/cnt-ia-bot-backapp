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
  private fileUri: string | null = null;
  private fileName: string | null = null;
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
   * Loads the cached file info from disk.
   */
  private loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const cacheRaw = fs.readFileSync(this.cachePath, 'utf-8');
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          if (cache.fileUri && cache.fileName) {
            this.fileUri = cache.fileUri;
            this.fileName = cache.fileName;
            this.isInitialized = true;
            console.log(`[GeminiService] Loaded cached file: ${cache.fileName}`);
          }
        }
      }
    } catch (error) {
      console.error("[GeminiService] Error loading cache:", error);
    }
  }

  /**
   * Saves the file info to disk cache.
   */
  private saveCache() {
    try {
      if (this.fileUri && this.fileName) {
        fs.writeFileSync(this.cachePath, JSON.stringify({
          fileUri: this.fileUri,
          fileName: this.fileName,
          updatedAt: new Date().toISOString()
        }));
        console.log(`[GeminiService] Saved file to cache: ${this.fileName}`);
      }
    } catch (error) {
      console.error("[GeminiService] Error saving cache:", error);
    }
  }

  /**
   * Initializes the file by uploading it to Gemini Files API.
   * Files stay for 48 hours, but we cache the URI to reuse it.
   */
  async initializeFile(filePath: string): Promise<void> {
    if (this.isInitialized && this.fileUri) {
      // Check if file still exists in Gemini (simple check)
      try {
        await this.ai.files.get({ name: this.fileName });
        console.log(`[GeminiService] Reusing active file: ${this.fileName}`);
        return;
      } catch (e) {
        console.log("[GeminiService] Cached file expired or not found, re-uploading...");
        this.isInitialized = false;
      }
    }

    try {
      console.log(`[GeminiService] Uploading file to Gemini: ${filePath}`);

      const uploadResult = await this.ai.files.upload({
        file: filePath,
        config: {
          displayName: path.basename(filePath),
          mimeType: "application/pdf"
        }
      });

      this.fileUri = uploadResult.file.uri;
      this.fileName = uploadResult.file.name;

      // Wait for the file to be processed (ACTUAL PROCESSING status check)
      let file = await this.ai.files.get({ name: this.fileName });
      while (file.state === "PROCESSING") {
        console.log("[GeminiService] Processing file...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        file = await this.ai.files.get({ name: this.fileName });
      }

      if (file.state === "FAILED") {
        throw new Error("File processing failed at Gemini");
      }

      this.isInitialized = true;
      this.saveCache();
      console.log("[GeminiService] File ready and cached.");
    } catch (error) {
      console.error("[GeminiService] Error initializing file:", error);
      throw error;
    }
  }

  /**
   * Generates content using the file as part of the multimodal context.
   */
  async generateText(systemInstruction: string, userMessage: string, model: string = "gemini-flash-latest"): Promise<string | null> {
    try {
      const parts: any[] = [];

      // Add file if initialized
      if (this.isInitialized && this.fileUri) {
        parts.push({
          fileData: {
            fileUri: this.fileUri,
            mimeType: "application/pdf"
          }
        });
      }

      // Add user message part
      parts.push({ text: userMessage });

      const response = await this.ai.models.generateContent({
        model: model,
        contents: [
          {
            role: "user",
            parts: parts
          }
        ],
        config: {
          systemInstruction: systemInstruction
        }
      });

      return response.text;
    } catch (error: any) {
      console.error(`[GeminiService] Error generating content with ${model}:`, error.message || error);

      // If 404 (file not found/expired), clear cache
      if (error.status === 404 || (error.message && error.message.includes("not found"))) {
        console.warn("[GeminiService] File or model not found. Clearing cache.");
        this.isInitialized = false;
        this.fileUri = null;
        this.fileName = null;
        if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
      }
      return null;
    }
  }
}




export default GeminiService;
