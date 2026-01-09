
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listAll() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_INDEX_NAME || 'prefectura-docs');

  console.log("Searching for AGUILERA in Pinecone...");

  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const embedResult = await model.embedContent("AGUILERA");
  const embedding = embedResult.embedding.values;

  const queryResponse = await index.query({
    vector: embedding,
    topK: 100,
    includeMetadata: true,
  });

  const matches = queryResponse.matches;
  console.log(`Found ${matches.length} matches.`);

  const names = matches.map(m => m.metadata.text.split('\n')[1] || "");

  console.log("SAMPLED ENTRIES:");
  names.slice(0, 10).forEach(n => console.log(n));

  const marcosMatch = matches.find(m => m.metadata.text.includes("MARCOS EMILIO"));

  if (!marcosMatch) {
    console.log("\n❌ MARCOS EMILIO NOT FOUND in top 100 results for AGUILERA.");
  } else {
    console.log("\n✅ MARCOS DATA FOUND (Score: " + marcosMatch.score + "):");
    console.log(marcosMatch.metadata.text);
  }
}

listAll().catch(console.error);
