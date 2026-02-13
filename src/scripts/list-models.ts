import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY3
  ];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key) continue;
    console.log(`\n--- Key ${i + 1} (${key.substring(0, 10)}...) ---`);
    const genAI = new GoogleGenerativeAI(key);

    try {
      // Use the internal listModels if available or just try a few model variations
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await response.json();
      if (data.models) {
        console.log("Supported Models:", data.models.map((m: any) => m.name).join(", "));
      } else {
        console.log("No models returned or error:", JSON.stringify(data));
      }
    } catch (err: any) {
      console.error(`Error listing models: ${err.message}`);
    }
  }
}

listModels();
