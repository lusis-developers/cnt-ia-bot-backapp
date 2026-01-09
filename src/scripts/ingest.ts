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

  // 1. PROCESS PDF (EMPLOYEES)
  const text = data.text;
  console.log(`Extracted PDF text length: ${text.length}`);

  // HEAVILY OPTIMIZED TABLE CHUNKING: Semantic Boosting
  const rawLines = text.split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => /^\d+\s+\d+/.test(l) && l.length > 50);

  console.log(`Found ${rawLines.length} employee data rows.`);

  const employeeChunks: string[] = rawLines.map((line: string) => {
    return `TIPO: EMPLEADO/REMUNERACION | INFO: ${line.split(/\s{2,}/).slice(0, 3).join(' ')}\nREGISTRO COMPLETO: ${line}`;
  });

  // 2. PROCESS JSON (CONTRACTS)
  const contractsPath = path.resolve(process.cwd(), 'src/data/contracts.json');
  const contractsData = JSON.parse(fs.readFileSync(contractsPath, 'utf-8'));
  const procesos = contractsData.procesos_contratacion || [];

  console.log(`Found ${procesos.length} contracts in JSON.`);

  const contractChunks: string[] = procesos.map((p: any) => {
    return `TIPO: CONTRATO/PROCESO | CODIGO: ${p.codigo} | ENTIDAD: ${p.entidad_contratante}\nOBJETO: ${p.objeto_proceso}\nESTADO: ${p.estado_proceso} | PRESUPUESTO: ${p.presupuesto_referencial}\nUBICACION: ${p.ubicacion.provincia} - ${p.ubicacion.canton}`;
  });

  const chunks = [...employeeChunks, ...contractChunks];

  // Delete existing vectors to ensure a clean re-ingestion of BOTH sources
  console.log("Cleaning existing index for fresh dual-source ingestion...");
  await pinecone.deleteAll();

  console.log(`Created ${chunks.length} total boosted chunks. Generating embeddings...`);

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
