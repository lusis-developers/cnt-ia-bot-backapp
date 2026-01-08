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
   * @param systemPrompt The system prompt to set the persona and context.
   * @param userMessage The user's query.
   * @param history Optional chat history.
   * @param model The Claude model to use.
   * @returns The generated response text.
   */
  async generateText(
    systemPrompt: string,
    userMessage: string,
    history: any[] = [],
    model: string = "claude-sonnet-4-5" // Reverting to the model ID originally in the codebase
  ): Promise<string | null> {
    try {
      const messages: any[] = history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      // Add the current user message with the file context if available
      const userContent: any[] = [];

      if (this.fileId) {
        userContent.push({
          type: 'document',
          source: {
            type: 'file',
            file_id: this.fileId,
          },
          // Enable prompt caching for the document
          cache_control: { type: 'ephemeral' }
        });
      }

      userContent.push({
        type: 'text',
        text: userMessage,
      });

      messages.push({
        role: 'user',
        content: userContent,
      });

      const response = await this.client.messages.create({
        model: model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      });

      // Claude responses are an array of blocks
      const textBlock = response.content.find((block: any) => block.type === 'text');
      return textBlock ? (textBlock as any).text : null;
    } catch (error: any) {
      // If the file ID is invalid/expired, clear cache and try to re-upload on next call
      if (error.status === 404 || (error.message && error.message.includes('file_id'))) {
        console.warn("Cached Claude file ID seems invalid or expired. Clearing cache.");
        this.fileId = null;
        if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
      }

      console.error("Error generating text with Claude:", error);
      return null;
    }
  }
}

export default ClaudeService;

