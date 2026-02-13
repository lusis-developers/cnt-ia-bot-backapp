import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

async function checkPinecone() {
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  try {
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pc.index(indexName);
    const stats = await index.describeIndexStats();
    console.log(`Index: ${indexName}`);
    console.log("Stats:", JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("Error getting stats:", err);
  }
}

checkPinecone();
