import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ClaudeService Class
 * Handles interactions with Anthropic's Claude AI models.
 */
class ClaudeService extends EventEmitter {
  private client: Anthropic;
  private fileId: string | null = null;
  private cachePath: string;

  constructor(apiKey: string) {
    super();
    if (!apiKey || apiKey.length === 0) {
      throw new Error("CLAUDE_API_KEY is missing");
    }
    this.client = new Anthropic({
      apiKey: apiKey,
      // Include the beta header for Files API and Prompt Caching
      defaultHeaders: {
        'anthropic-beta': 'files-api-2025-04-14,prompt-caching-2024-07-31',
      },
    });
    this.cachePath = path.resolve(process.cwd(), "src/data/.claude_cache.json");
    this.loadCache();
  }

  /**
   * Loads the cached file ID from disk.
   */
  private loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const cacheRaw = fs.readFileSync(this.cachePath, 'utf-8');
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw);
          if (cache.fileId) {
            this.fileId = cache.fileId;
            console.log(`[ClaudeService] Loaded cached file ID: ${this.fileId}`);
          }
        }
      }
    } catch (error) {
      console.error("[ClaudeService] Error loading cache:", error);
    }
  }

  /**
   * Saves the file ID to disk cache.
   */
  private saveCache() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify({ fileId: this.fileId, updatedAt: new Date().toISOString() }));
    } catch (error) {
      console.error("Error saving Claude cache:", error);
    }
  }

  /**
   * Uploads a file to Claude's Beta Files API.
   * Skip if already uploaded in this session or loaded from cache.
   * @param filePath Path to the file to upload.
   * @returns The file ID.
   */
  async uploadFile(filePath: string): Promise<string> {
    if (this.fileId) {
      return this.fileId;
    }
    try {
      console.log(`Uploading file to Claude: ${filePath}`);
      const fileMetadata = await this.client.beta.files.upload({
        file: await toFile(fs.createReadStream(filePath), path.basename(filePath), { type: 'application/pdf' }),
      });
      this.fileId = fileMetadata.id;
      this.saveCache();
      console.log(`File uploaded successfully to Claude. ID: ${this.fileId}`);
      return this.fileId;
    } catch (error) {
      console.error("Error uploading file to Claude:", error);
      throw error;
    }
  }

  /**
   * Generates a message using Claude.
   * Generates a response using Claude with the PDF as context.
   * @param systemPrompt The system instructions.
   * @param userMessage The user query.
   * @param history The conversation history.
   * @returns The generated response.
   */
  async generateText(systemPrompt: string, userMessage: string, history: any[]): Promise<string | null> {
    try {
      // Keep only last message to minimize tokens and ensure instant response
      const trimmedHistory = history.slice(-1).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      // Read PDF once
      const pdfData = await fs.promises.readFile(path.resolve(process.cwd(), 'src/data/info-empleados.pdf'), { encoding: 'base64' });

      // Using the environment's standard model (2026 stack)
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }
          }
        ],
        messages: [
          ...trimmedHistory,
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfData,
                },
                cache_control: { type: "ephemeral" }
              },
              {
                type: "text",
                text: userMessage
              }
            ]
          }
        ],
      } as any, {
        headers: {
          "anthropic-beta": "prompt-caching-2024-07-31"
        }
      });

      return (response.content[0] as any).text;
    } catch (error) {
      console.error("Error generating text with Claude:", error);
      return null;
    }
  }
}





export default ClaudeService;
