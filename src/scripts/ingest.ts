import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
const pdf = require('pdf-parse');
import GeminiService from '../services/gemini.class';
import PineconeService from '../services/pinecone.service';
import contificoService from '../services/contifico.service';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function ingest() {
  const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
  const pinecone = new PineconeService(
    process.env.PINECONE_API_KEY!,
    process.env.PINECONE_INDEX_NAME || 'prefectura-guayas'
  );

  const staticDir = path.resolve(process.cwd(), 'src/data/static');

  if (!fs.existsSync(staticDir)) {
    console.error(`Directory not found: ${staticDir}`);
    return;
  }

  const files = fs.readdirSync(staticDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} PDF files for ingestion.`);

  // Delete existing vectors for a clean start
  console.log("Cleaning existing index for fresh ingestion...");
  await pinecone.deleteAll();

  const allChunks: { text: string; source: string }[] = [];

  for (const fileName of files) {
    const pdfPath = path.join(staticDir, fileName);
    console.log(`Processing file: ${fileName}...`);

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      let data;
      try {
        const parser = new pdf.PDFParse({ data: dataBuffer });
        data = await parser.getText();
      } catch (err) {
        if (typeof pdf === 'function') {
          data = await pdf(dataBuffer);
        } else {
          throw err;
        }
      }

      const text = data.text;
      // Basic recursive character splitting or sentence-based splitting
      const rawChunks = text.split('\n\n').filter((c: string) => c.trim().length > 50);

      rawChunks.forEach((chunk: string) => {
        allChunks.push({
          text: `FILE: ${fileName}\nCONTENT: ${chunk.trim()}`,
          source: fileName
        });
      });

    } catch (err) {
      console.error(`Failed to process ${fileName}:`, err);
    }
  }

  // OPTIONAL: Keep Contifico ingestion if keys are present -> REMOVED FOR CNT AGENT
  // if (process.env.CONTIFICO_API_KEY) { ... }

  console.log(`Total chunks created: ${allChunks.length}. Generating embeddings and upserting...`);

  const batchSize = 25;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const vectors = await Promise.all(batch.map(async (item, index) => {
      const embedding = await gemini.getEmbeddings(item.text);
      return {
        id: uuidv4(),
        values: embedding,
        metadata: {
          text: item.text,
          source: item.source,
          chunkIndex: i + index
        }
      };
    }));

    await pinecone.upsert(vectors);
    console.log(`Progress: ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length} chunks.`);
  }

  console.log("Ingestion complete!");
}

ingest().catch(console.error);
