import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function listEmbeddingModels() {
  const key = process.env.GEMINI_API_KEY!;
  console.log(`Using Key: ${key.substring(0, 10)}...`);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    if (data.models) {
      const embeddingModels = data.models.filter((m: any) => m.supportedGenerationMethods.includes("embedContent"));
      console.log("Available Embedding Models:");
      embeddingModels.forEach((m: any) => {
        console.log(`- ${m.name} (Output Dim: ${m.outputTokenLimit || 'unknown'})`);
      });
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

listEmbeddingModels();
