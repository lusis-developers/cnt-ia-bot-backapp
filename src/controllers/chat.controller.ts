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

    // 2. Search Pinecone for relevant context
    console.log(`[RAG] Searching Pinecone for context...`);
    const matches = await pinecone.query(queryEmbedding, 40); // Increased to 40 for maximum precision coverage

    const context = matches
      .map((match: any) => match.metadata.text)
      .join('\n---\n');

    console.log(`[RAG] Found ${matches.length} relevant context chunks.`);

    const systemInstruction = `
      Eres el Asistente de IA de la Prefectura del Guayas. 
      Tu objetivo es ayudar a ciudadanos y empleados con información precisa basada en dos fuentes principales:
      1. Nómina/Remuneraciones (Remuneración mensual, cargos, nombres).
      2. Procesos de Contratación (Contratos, presupuestos, estados de procesos).

      Reglas:
      1. El contexto contiene registros etiquetados como:
         "TIPO: EMPLEADO/REMUNERACION | INFO: [Nombre/Cargo]"
         "TIPO: CONTRATO/PROCESO | CODIGO: [Código] | ENTIDAD: [Entidad]"
      2. Lee cuidadosamente los 40 fragmentos del contexto recuperado.
      3. Si te preguntan por un contrato o proceso, busca por código o entidad en los fragmentos de TIPO: CONTRATO.
      4. Si te preguntan por sueldos o personas, busca en los fragmentos de TIPO: EMPLEADO.
      5. Mantén el hilo de la conversación usando el historial proporcionado.
      6. Responde de forma directa, profesional y oficial. No menciones "Pinecone", "Contexto" o "Fragmentos".
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
