import 'dotenv/config'
import { Request, Response } from "express";
import GeminiService from "../services/gemini.class";
import ClaudeService from "../services/claude.class";
import PineconeService from "../services/pinecone.service";
import contificoService from "../services/contifico.service";
import axios from "axios";

// Status Codes from Axios
const HttpStatusCode = axios.HttpStatusCode;

// Service Instances
const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
const claude = new ClaudeService(process.env.CLAUDE_API_KEY!);
const pinecone = new PineconeService(
  process.env.PINECONE_API_KEY!,
  process.env.PINECONE_INDEX_NAME || 'prefectura-docs'
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

    // 2. Search Pinecone for relevant context (Employees & Contracts)
    console.log(`[RAG] Searching Pinecone for context...`);
    const matches = await pinecone.query(queryEmbedding, 40);

    const context = matches
      .map((match: any) => match.metadata.text)
      .join('\n---\n');

    console.log(`[RAG] Found ${matches.length} relevant context chunks.`);

    // 3. BUSINESS CONTEXT (Now retrieved via RAG in Step 2 for high performance)
    // We avoid real-time calls during chat to ensure sub-second response times.

    const systemInstruction = `
      Eres el Agente de IA Oficial de la Prefectura del Guayas. 
      Tu objetivo es servir a la ciudadanía y a los empleados con información oficial, precisa y actualizada sobre la provincia, procesos institucionales, trámites, licitaciones y servicios públicos.
      
      Reglas de Identidad y Fuentes:
      1. Identidad Principal: Eres el Agente Oficial de la Prefectura del Guayas. Mantén siempre un tono profesional, servicial y respetuoso.
      2. Datos Oficiales: Utiliza la información proporcionada en el contexto como la única fuente de verdad para datos específicos de la Prefectura (nómina, contratos, procesos, leyes).
      3. Transparencia: Si no tienes información específica en el contexto para responder una pregunta, indícalo amablemente y sugiere al usuario visitar el sitio web oficial o contactar a las oficinas pertinentes.
      
      Instrucciones de Respuesta:
      - Responde siempre de manera concisa y clara.
      - Utiliza el historial de la conversación para mantener la coherencia del diálogo.
      - Para preguntas sobre leyes o normativas (como la LORTI), extrae los puntos más relevantes del contexto proporcionado.
      - No menciones detalles técnicos de la implementación (RAG, Pinecone, fragmentos, etc.).
      - Tu prioridad es el bienestar y el servicio al ciudadano del Guayas.
    `;

    let response: string | null = null;

    if (provider === 'gemini') {
      response = await gemini.generateTextWithContext(systemInstruction, message, context, history);
    } else {
      const enhancedSystemPrompt = `${systemInstruction}\n\nCONTEXTO RECUPERADO:\n${context}`;
      response = await claude.generateText(enhancedSystemPrompt, message, history);
    }

    if (!response) {
      return res.status(HttpStatusCode.InternalServerError).send({
        message: "Error generating response from AI."
      });
    }

    return res.status(HttpStatusCode.Ok).send({
      message: "Success",
      response,
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
