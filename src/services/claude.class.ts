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

  constructor(apiKey: string) {
    super();
    if (!apiKey || apiKey.length === 0) {
      throw new Error("CLAUDE_API_KEY is missing");
    }
    this.client = new Anthropic({
      apiKey: apiKey,
      // Include the beta header for Files API
      defaultHeaders: {
        'anthropic-beta': 'files-api-2025-04-14',
      },
    });
  }

  /**
   * Uploads a file to Claude's Beta Files API.
   * @param filePath Path to the file to upload.
   * @returns The file ID.
   */
  async uploadFile(filePath: string): Promise<string> {
    try {
      console.log(`Uploading file to Claude: ${filePath}`);
      const fileMetadata = await this.client.beta.files.upload({
        file: await toFile(fs.createReadStream(filePath), path.basename(filePath), { type: 'application/pdf' }),
      });
      this.fileId = fileMetadata.id;
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
    model: string = "claude-sonnet-4-5"
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
    } catch (error) {
      console.error("Error generating text with Claude:", error);
      return null;
    }
  }
}

export default ClaudeService;
