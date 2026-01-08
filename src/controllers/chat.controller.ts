import 'dotenv/config'
import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import GeminiService from "../services/gemini.class";
import ClaudeService from "../services/claude.class";
import { parseHistory } from "../utils/handleHistory";
import axios from "axios";

/**
 * Status Codes from Axios
 */
const HttpStatusCode = axios.HttpStatusCode;

/**
 * Initialize Services
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "";

const gemini = new GeminiService(GEMINI_KEY);
const claude = new ClaudeService(CLAUDE_KEY);

const PDF_PATH = path.join(process.cwd(), "src/data/info-empleados.pdf");
const CONTRACTS_PATH = path.join(process.cwd(), "src/data/contracts.json");

// Flags to track RAG initialization
let isGeminiRagInitialized = false;
let claudeFileId: string | null = null;

/**
 * Ensures that the File Search store is initialized for Gemini.
 */
async function ensureGeminiRag() {
  if (isGeminiRagInitialized) return;
  try {
    await gemini.initializeFileSearch(PDF_PATH, "PrefectureStore");
    isGeminiRagInitialized = true;
    console.log("Gemini RAG Initialized");
  } catch (err) {
    console.error("Gemini RAG Initialization error:", err);
  }
}

/**
 * Ensures that the PDF is uploaded to Claude.
 */
async function ensureClaudeRag() {
  if (claudeFileId) return;
  try {
    claudeFileId = await claude.uploadFile(PDF_PATH);
    console.log("Claude RAG Initialized (File Uploaded)");
  } catch (err) {
    console.error("Claude RAG Initialization error:", err);
  }
}

/**
 * Handles chat messages using Claude (primary) or Gemini (fallback).
 * @param req Express Request
 * @param res Express Response
 */
async function sendMessage(req: Request, res: Response) {
  try {
    const { message, history, provider = "claude" } = req.body;

    if (!message) {
      res.status(HttpStatusCode.BadRequest).send({
        message: "Message is required"
      });
      return;
    }

    // Read contracts context
    const contractsData = fs.readFileSync(CONTRACTS_PATH, "utf-8");
    const parsedHistory = history ? parseHistory(history) : [];

    const systemPrompt = `
      You are the Prefecture's AI Assistant. Your goal is to help users with information about the institution and its procurement processes.
      
      You have access to:
      1. Employee information and internal procedures (provided via indexed PDF context).
      2. Current procurement contracts (provided in JSON below).
      
      Instructions:
      - Always respond professionally and helpfully in Spanish.
      - Use the provided context to answer questions accurately.
      - If the information is not in the context, inform the user politely.
      - Mention that this is a preview and the system can scale to handle thousands of contracts.
      
      CONTRACTS CONTEXT (JSON):
      ${contractsData}
    `;

    let answer: string | null = null;

    if (provider === "claude" && CLAUDE_KEY) {
      await ensureClaudeRag();
      answer = await claude.generateText(systemPrompt, message, history || []);
    } else {
      // Fallback to Gemini
      await ensureGeminiRag();
      const geminiPrompt = `
        ${systemPrompt}
        
        CHAT HISTORY:
        ${parsedHistory}
        
        User query: ${message}
      `;
      answer = await gemini.generateText(geminiPrompt);
    }

    res.status(HttpStatusCode.Ok).send({
      message: "Chat response generated successfully.",
      provider: answer ? (provider === "claude" ? "claude" : "gemini") : "none",
      answer: answer || "I'm sorry, I couldn't generate a response at this moment."
    });
    return;
  } catch (error) {
    console.error("Error in chat.controller.sendMessage:", error);
    res.status(HttpStatusCode.InternalServerError).send({
      message: "An error occurred while processing the chat request."
    });
    return;
  }
}

export default {
  sendMessage
};
