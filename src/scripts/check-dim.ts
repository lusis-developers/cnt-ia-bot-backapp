import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function checkDim() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
  const res = await model.embedContent("test");
  console.log("Embedding Length:", res.embedding.values.length);
}

checkDim();
