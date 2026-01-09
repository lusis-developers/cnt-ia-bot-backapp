import contificoService from "../services/contifico.service";

async function testContifico() {
  console.log("--- TESTING CONTIFICO API ---");
  try {
    console.log("\n1. Fetching Products...");
    const products = await contificoService.getProducts();
    console.log(`Found ${products.length} products.`);
    if (products.length > 0) {
      console.log("Sample product:", JSON.stringify(products[0], null, 2));
    }

    console.log("\n2. Fetching Documents (Transactions)...");
    const docs = await contificoService.getDocuments({ result_size: 5 });
    console.log(`Found ${docs.length} documents.`);
    if (docs.length > 0) {
      console.log("Sample document:", JSON.stringify(docs[0], null, 2));
    }

    console.log("\n3. Fetching People...");
    const people = await contificoService.getPeople();
    console.log(`Found ${people.length} people.`);

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testContifico();
