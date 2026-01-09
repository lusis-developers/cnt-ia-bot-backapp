import { Pinecone } from '@pinecone-database/pinecone';

/**
 * PineconeService Class
 * Handles vector database operations for RAG.
 */
class PineconeService {
  private pc: Pinecone;
  private indexName: string;

  constructor(apiKey: string, indexName: string) {
    if (!apiKey) throw new Error("PINECONE_API_KEY is missing");
    if (!indexName) throw new Error("PINECONE_INDEX_NAME is missing");

    this.pc = new Pinecone({
      apiKey: apiKey,
    });
    this.indexName = indexName;
  }

  /**
   * Upserts vectors into the Pinecone index.
   */
  async upsert(vectors: any[]) {
    try {
      const index = this.pc.index(this.indexName);
      await index.upsert(vectors);
      console.log(`[PineconeService] Successfully upserted ${vectors.length} vectors.`);
    } catch (error) {
      console.error("[PineconeService] Error upserting vectors:", error);
      throw error;
    }
  }

  /**
   * Queries the Pinecone index for similar vectors.
   */
  async query(vector: number[], topK: number = 3) {
    try {
      const index = this.pc.index(this.indexName);
      const queryResponse = await index.query({
        vector: vector,
        topK: topK,
        includeMetadata: true,
      });

      return queryResponse.matches;
    } catch (error) {
      console.error("[PineconeService] Error querying Pinecone:", error);
      throw error;
    }
  }

  /**
   * Deletes all vectors in the index (reset).
   */
  async deleteAll() {
    try {
      const index = this.pc.index(this.indexName);
      await index.deleteAll();
      console.log("[PineconeService] Successfully deleted all vectors from index.");
    } catch (error) {
      console.error("[PineconeService] Error deleting vectors:", error);
      throw error;
    }
  }
}

export default PineconeService;
