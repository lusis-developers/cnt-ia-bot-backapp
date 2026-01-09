import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
const pdf = require('pdf-parse');
import GeminiService from '../services/gemini.class';
import PineconeService from '../services/pinecone.service';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function ingest() {
  const gemini = new GeminiService(process.env.GEMINI_API_KEY!);
  const pinecone = new PineconeService(
    process.env.PINECONE_API_KEY!,
    process.env.PINECONE_INDEX_NAME || 'prefectura-docs'
  );

  const pdfPath = path.resolve(process.cwd(), 'src/data/info-empleados.pdf');

  console.log("Reading PDF...");
  const dataBuffer = fs.readFileSync(pdfPath);
  let data;
  try {
    const parser = new pdf.PDFParse({ data: dataBuffer });
    data = await parser.getText();
  } catch (err) {
    console.log("DEBUG: Retrying with default pdf pattern...");
    if (typeof pdf === 'function') {
      data = await pdf(dataBuffer);
    } else {
      throw err;
    }
  }

  const text = data.text;
  console.log(`Extracted text length: ${text.length}`);

  // Delete existing vectors to ensure a clean re-ingestion
  console.log("Cleaning existing index...");
  await pinecone.deleteAll();

  // HEAVILY OPTIMIZED TABLE CHUNKING: Semantic Boosting
  const rawLines = text.split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => /^\d+\s+\d+/.test(l) && l.length > 50);

  console.log(`Found ${rawLines.length} employee data rows.`);

  const chunks: string[] = rawLines.map((line: string) => {
    // Format: "EMPLEADO: [Name] | CARGO: [Role] | DATA: [Full Row]"
    // We'll simplify the line for the "EMPLEADO" part to focus the embedding
    return `EMPLEADO/CARGO: ${line.split(/\s{2,}/).slice(0, 3).join(' ')}\nREGISTRO COMPLETO: ${line}`;
  });

  console.log(`Created ${chunks.length} semantically-boosted chunks. Generating embeddings...`);

  const vectors: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

    // Generate embedding using Gemini
    const embedding = await gemini.getEmbeddings(chunk);

    vectors.push({
      id: uuidv4(),
      values: embedding,
      metadata: {
        text: chunk,
        source: 'info-empleados.pdf',
        chunkIndex: i
      }
    });

    // Batch upsert to Pinecone to avoid large payloads if needed, 
    // but for small files we can do it at once or in small groups
    if (vectors.length >= 20) {
      await pinecone.upsert(vectors.splice(0, 20));
    }
  }

  // Final batch
  if (vectors.length > 0) {
    await pinecone.upsert(vectors);
  }

  console.log("Ingestion complete!");
}

ingest().catch(console.error);
