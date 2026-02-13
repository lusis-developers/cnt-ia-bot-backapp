import PineconeService from '../services/pinecone.service';
import GeminiService from '../services/gemini.class';
import dotenv from 'dotenv';
dotenv.config();

async function testQuery() {
  const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
  const pinecone = new PineconeService(
    process.env.PINECONE_API_KEY!,
    process.env.PINECONE_INDEX_NAME!
  );

  const queryText = "¿Cuáles son los beneficios para personas con discapacidad?";
  console.log(`Query: ${queryText}`);

  try {
    const embedding = await gemini.getEmbeddings(queryText);
    const matches = await pinecone.query(embedding, 3);

    console.log("\n--- Top Matches ---");
    matches?.forEach((match: any, i: number) => {
      console.log(`\nMatch ${i + 1} (Score: ${match.score}):`);
      console.log(`Source: ${match.metadata?.source}`);
      console.log(`Text: ${match.metadata?.text.substring(0, 200)}...`);
    });
  } catch (err) {
    console.error("Query failed:", err);
  }
}

testQuery();
