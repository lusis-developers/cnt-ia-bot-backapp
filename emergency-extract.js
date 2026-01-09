const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

async function extractAndChunk() {
  try {
    const filePath = path.resolve(__dirname, 'src/data/info-empleados.pdf');
    const dataBuffer = fs.readFileSync(filePath);

    console.log("Extracting text from PDF...");
    // Try all common patterns
    let data;
    if (typeof pdf === 'function') {
      data = await pdf(dataBuffer);
    } else if (pdf.PDFParse && typeof pdf.PDFParse === 'function') {
      data = await pdf.PDFParse(dataBuffer);
    } else if (pdf.default && typeof pdf.default === 'function') {
      data = await pdf.default(dataBuffer);
    } else {
      console.log("DEBUG: pdf-parse keys:", Object.keys(pdf));
      throw new Error("Could not find a valid pdf-parse function.");
    }

    const text = data.text;
    console.log("Text length extracted:", text.length);

    // Basic cleaning
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2);

    // Chunking by 15 lines (overlap 2 to avoid cuts)
    const chunks = [];
    for (let i = 0; i < lines.length; i += 13) {
      chunks.push(lines.slice(i, i + 15).join('\n'));
    }

    const outputPath = path.resolve(__dirname, 'src/data/info-empleados-chunks.json');
    fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2));

    console.log(`Successfully created ${chunks.length} chunks.`);
  } catch (err) {
    console.error("Extraction error:", err);
  }
}

extractAndChunk();
