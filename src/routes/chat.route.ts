import express from "express";
import chatController from "../controllers/chat.controller";

const router = express.Router();

/**
 * POST /chat
 * Sends a message to the Gemini AI Assistant
 */
router.post("/chat", chatController.sendMessage);

export default router;
