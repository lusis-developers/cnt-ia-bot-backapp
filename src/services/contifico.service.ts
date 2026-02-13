import axios from "axios";
import 'dotenv/config';

/**
 * ContificoService Class
 * Handles interactions with the Contífico API for inventory, transactions, and HR.
 */
class ContificoService {
  private apiKey: string;
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CONTIFICO_API_KEY || "";
    this.apiToken = process.env.CONTIFICO_API_TOKEN || "";
    this.baseUrl = process.env.CONTIFICO_BASE_URL || "https://api.contifico.com/sistema/api/v1/";

    if (!this.apiKey || !this.apiToken) {
      console.warn("[ContificoService] Warning: Missing API Key or Token in environment variables.");
    }
  }

  /**
   * Helper to perform GET requests with authentication
   */
  private async get(endpoint: string, params: any = {}) {
    try {
      // API expects DD/MM/YYYY for dates usually, but let's keep it flexible
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: this.apiKey
        },
        params: params,
        timeout: 5000 // 5 second timeout to prevent hangs
      });
      return response.data;
    } catch (error: any) {
      console.error(`[ContificoService] GET Error on ${endpoint}:`, error.response?.data || error.message);
      return []; // Return empty array on error to prevent crashes in context generation
    }
  }

  /**
   * Fetch products from inventory
   */
  async getProducts() {
    return this.get("producto/");
  }

  /**
   * Fetch documents (transactions)
   */
  async getDocuments(params: {
    tipo_registro?: string;
    fecha_emision?: string;
    result_size?: number;
    result_page?: number;
    fecha_inicial?: string;
    fecha_final?: string;
  } = {}) {
    return this.get("registro/documento/", params);
  }

  /**
   * Fetch specific document by ID
   */
  async getDocumentById(id: string) {
    return this.get(`documento/${id}/`);
  }

  /**
   * Fetch people (clients/providers)
   */
  async getPeople() {
    return this.get("persona/");
  }

  /**
   * Fetch HR roles for a person
   */
  async getRoles(params: { cedula: string; anio: string; mes: string; periodo: string }) {
    return this.get("rrhh/rol-pago/", params);
  }

  /**
   * Fetch accounting seats
   */
  async getAccountingSeats() {
    // Note: The documentation says GET contabilidad/asiento/ID but doesn't specify a list endpoint without ID clearly
    // but usually these APIs have a list endpoint.
    return this.get("contabilidad/asiento/");
  }
}

export default new ContificoService();
