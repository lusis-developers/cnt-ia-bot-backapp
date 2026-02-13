import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function testKeys() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY3
  ];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key) continue;
    console.log(`Testing Key ${i + 1}: ${key.substring(0, 10)}...`);
    const genAI = new GoogleGenerativeAI(key);

    // Try a simple generateContent first
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("test");
      console.log(`Key ${i + 1} generateContent: SUCCESS`);
    } catch (err: any) {
      console.error(`Key ${i + 1} generateContent: FAILED - ${err.message}`);
    }

    // Try embedding
    try {
      const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const res = await embedModel.embedContent("test");
      console.log(`Key ${i + 1} text-embedding-004: SUCCESS`);
    } catch (err: any) {
      console.error(`Key ${i + 1} text-embedding-004: FAILED - ${err.message}`);
    }
  }
}

testKeys();
