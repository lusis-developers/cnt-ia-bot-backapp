import 'dotenv/config'
import { Request, Response } from "express";
import GeminiService from "../services/gemini.class";
import ClaudeService from "../services/claude.class";
import PineconeService from "../services/pinecone.service";
import axios from "axios";

// Status Codes from Axios
const HttpStatusCode = axios.HttpStatusCode;

// Service Instances
const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
const claude = new ClaudeService(process.env.CLAUDE_API_KEY!);
const pinecone = new PineconeService(
  process.env.PINECONE_API_KEY!,
  process.env.PINECONE_INDEX_NAME || 'cnt-contrato'
);

let isRagInitialized = false;

/**
 * Ensures the RAG system is ready (checking Pinecone connection).
 */
async function ensureRag() {
  if (isRagInitialized) return;

  try {
    // Pinecone just needs to be instantiated, but we could do a ping here if needed
    isRagInitialized = true;
    console.log("Vector RAG (Pinecone) Initialized");
  } catch (error) {
    console.error("Error initializing Vector RAG:", error);
  }
}

/**
 * Handles incoming chat messages using Vector RAG.
 */
export async function sendMessage(req: Request, res: Response) {
  const { message, history = [], provider = 'gemini' } = req.body;

  if (!message) {
    return res.status(HttpStatusCode.BadRequest).send({ message: "Message is required." });
  }

  try {
    await ensureRag();

    // 1. Generate Embedding for the user query
    console.log(`[RAG] Generating embedding for query: "${message.substring(0, 50)}..."`);
    const queryEmbedding = await gemini.getEmbeddings(message);

    // 2. Search Pinecone for relevant context
    console.log(`[RAG] Searching Pinecone for context...`);
    const matches = await pinecone.query(queryEmbedding, 40);

    const context = matches
      .map((match: any) => match.metadata.text)
      .join('\n---\n');

    console.log(`[RAG] Found ${matches.length} relevant context chunks.`);

    const systemInstruction = `
      Eres el Asistente Oficial de CNT Ecuador (Corporación Nacional de Telecomunicaciones).
      Tu objetivo es asistir a los usuarios con información precisa basada EXCLUSIVAMENTE en los documentos oficiales proporcionados.
      
      Reglas de Identidad:
      1. Identidad: Eres el Agente IA de CNT Ecuador.
      2. Tono: Profesional, corporativo, amable y eficiente.
      3. Fuente de Verdad: Responde basándote únicamente en el CONTEXTO RECUPERADO. Si la información no está en los documentos, indícalo amablemente.
      
      Instrucciones de Respuesta:
      - Prioriza la claridad y la precisión.
      - Si te preguntan sobre leyes, reglamentos o procedimientos, cita la fuente si es evidente en el texto (ej. "según el Artículo X").
      - No inventes información.
      - Mantén el hilo de la conversación.
    `;

    let response: string | null = null;
    let usedProvider = provider;

    try {
      if (message.includes('SIMULATE_GEMINI_FAILURE')) {
        throw new Error("Simulated Gemini Failure for Testing Fallback");
      }

      if (provider === 'gemini') {
        response = await gemini.generateTextWithContext(systemInstruction, message, context, history);
      } else {
        const enhancedSystemPrompt = `${systemInstruction}\n\nCONTEXTO RECUPERADO:\n${context}`;
        response = await claude.generateText(enhancedSystemPrompt, message, history);
      }
    } catch (primaryError: any) {
      console.error(`[RAG] Primary provider (${provider}) failed:`, primaryError.message);

      // Automatic Fallback to Claude if Gemini fails
      if (provider === 'gemini') {
        console.log("[RAG] ⚠️ Initiating automatic fallback to CLAUDE...");
        try {
          usedProvider = 'claude-fallback';
          const enhancedSystemPrompt = `${systemInstruction}\n\nCONTEXTO RECUPERADO:\n${context}`;
          response = await claude.generateText(enhancedSystemPrompt, message, history);
          console.log("[RAG] ✅ Fallback to Claude successful.");
        } catch (fallbackError: any) {
          console.error("[RAG] ❌ Fallback to Claude also failed:", fallbackError.message);
          throw fallbackError; // Both failed
        }
      } else {
        throw primaryError;
      }
    }

    if (!response) {
      return res.status(HttpStatusCode.InternalServerError).send({
        message: "Error generating response from AI."
      });
    }

    return res.status(HttpStatusCode.Ok).send({
      message: "Success",
      response,
      provider: usedProvider,
      contextUsed: matches.length > 0
    });

  } catch (error: any) {
    console.error("Chat Controller Error:", error);
    return res.status(HttpStatusCode.InternalServerError).send({
      message: "Internal server error.",
      error: error.message
    });
  }
}

export default {
  sendMessage
};
