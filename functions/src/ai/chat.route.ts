import { Router, type Request, type Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { getTenantPlanProfile } from "../lib/tenant-plan-policy";
import { sanitizeText } from "../utils/sanitize";
import { logger } from "../lib/logger";
import { selectModel } from "./model-router";
import { checkAiLimit, incrementAiUsage, getAiUsage } from "./usage-tracker";
import { loadConversation, saveConversation } from "./conversation-store";
import { buildSystemPrompt } from "./context-builder";
import type { AiChatRequest, AiChatChunk, AiConversationMessage } from "./ai.types";

const router = Router();

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // 1. Parse and validate request body
  const body = req.body as AiChatRequest;
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (!rawMessage) {
    res.status(400).json({ message: "Campo 'message' é obrigatório." });
    return;
  }
  if (rawMessage.length > 4000) {
    res.status(400).json({ message: "Mensagem excede o limite de 4000 caracteres." });
    return;
  }

  const message = sanitizeText(rawMessage);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const currentPath = typeof body.currentPath === "string" ? body.currentPath : undefined;

  // 2. Resolve plan tier
  let planProfile;
  try {
    planProfile = await getTenantPlanProfile(user.tenantId);
  } catch {
    res.status(500).json({ message: "Erro ao resolver plano do tenant." });
    return;
  }

  // 3. Block free tier with 403
  if (planProfile.tier === "free") {
    res.status(403).json({
      message: "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.",
      code: "AI_FREE_TIER_BLOCKED",
    });
    return;
  }

  const planTier = planProfile.tier;

  // 4. Check monthly limit
  const limitCheck = await checkAiLimit(user.tenantId, planTier);
  if (!limitCheck.allowed) {
    res.status(429).json({
      message: `Limite de mensagens atingido (${limitCheck.messagesUsed}/${limitCheck.messagesLimit}). Resets em ${limitCheck.resetAt}.`,
      code: "AI_LIMIT_EXCEEDED",
      messagesUsed: limitCheck.messagesUsed,
      messagesLimit: limitCheck.messagesLimit,
      resetAt: limitCheck.resetAt,
    });
    return;
  }

  // 5. Select model
  const modelSelection = selectModel(planTier, message);

  // 6. Load conversation history
  const history = await loadConversation(user.tenantId, sessionId, planTier);

  // 7. Build system prompt — fetch tenant name/niche for context
  let tenantName = "";
  let tenantNiche = "";
  try {
    const tenantSnap = await db.collection("tenants").doc(user.tenantId).get();
    if (tenantSnap.exists) {
      const tenantData = tenantSnap.data() as Record<string, unknown>;
      tenantName = String(tenantData?.name || "");
      tenantNiche = String(tenantData?.niche || "");
    }
  } catch {
    // Non-fatal — continue with empty tenant info
  }

  const systemPrompt = buildSystemPrompt({
    tenantId: user.tenantId,
    tenantName,
    tenantNiche,
    planTier,
    userName: user.email || "Usuário",
    userRole: user.role || "member",
    currentPath,
    aiUsage: {
      messagesUsed: limitCheck.messagesUsed,
      messagesLimit: limitCheck.messagesLimit,
    },
  });

  // 8. Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("GEMINI_API_KEY not configured", { tenantId: user.tenantId });
    res.status(500).json({ message: "Serviço de IA não configurado." });
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelSelection.modelName,
    systemInstruction: systemPrompt,
  });

  // Build Gemini history from persisted conversation messages
  const geminiHistory = history.map((msg) => ({
    role: msg.role === "model" ? ("model" as const) : ("user" as const),
    parts: [{ text: msg.content }],
  }));

  try {
    // 9. Set SSE headers — disable timeout for long-lived streaming connection
    res.setTimeout(0);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // 10. Stream Gemini response
    const chat = model.startChat({ history: geminiHistory });
    const streamResult = await chat.sendMessageStream(message);

    let fullResponseText = "";
    let totalTokens = 0;

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        fullResponseText += text;
        const sseChunk: AiChatChunk = { type: "text", content: text };
        res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
      }

      // Tool calls (stub for Phase 3 — log but don't execute)
      const candidates = chunk.candidates;
      if (candidates) {
        for (const candidate of candidates) {
          const parts = candidate.content?.parts;
          if (parts) {
            for (const part of parts) {
              if ("functionCall" in part && part.functionCall) {
                logger.info("AI tool call received (Phase 3 stub)", {
                  tenantId: user.tenantId,
                  toolName: part.functionCall.name,
                });
                const toolChunk: AiChatChunk = {
                  type: "tool_call",
                  toolCall: {
                    name: part.functionCall.name,
                    args: (part.functionCall.args as Record<string, unknown>) || {},
                  },
                };
                res.write(`data: ${JSON.stringify(toolChunk)}\n\n`);
              }
            }
          }
        }
      }
    }

    // Get usage metadata from final response
    const usageMetadata = await streamResult.response;
    totalTokens = usageMetadata.usageMetadata?.totalTokenCount || 0;

    // 11. Increment usage atomically
    await incrementAiUsage(user.tenantId, totalTokens);

    // 12. Save conversation (Pro/Enterprise only — starter is no-op in saveConversation)
    const now = Timestamp.now();
    const updatedMessages: AiConversationMessage[] = [
      ...history,
      { role: "user" as const, content: message, timestamp: now },
      { role: "model" as const, content: fullResponseText, timestamp: now },
    ];
    await saveConversation(user.tenantId, sessionId, user.uid, updatedMessages, planTier);

    // 13. Send usage event and DONE sentinel
    const currentUsage = await getAiUsage(user.tenantId);
    const usageChunk: AiChatChunk = {
      type: "usage",
      usage: {
        messagesUsed: currentUsage?.messagesUsed || limitCheck.messagesUsed + 1,
        messagesLimit: limitCheck.messagesLimit,
        totalTokensUsed: currentUsage?.totalTokensUsed || totalTokens,
      },
    };
    res.write(`data: ${JSON.stringify(usageChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno da IA";
    logger.error("AI chat stream error", {
      tenantId: user.tenantId,
      uid: user.uid,
      error: errorMessage,
    });

    if (!res.headersSent) {
      // Fallback to JSON if SSE headers not yet flushed
      res.status(500).json({ message: "Erro ao processar resposta da IA.", reply: "" });
      return;
    }

    // Headers already sent — send error via SSE then close
    const errorChunk: AiChatChunk = { type: "error", error: "Erro ao processar resposta da IA." };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export const aiRouter = router;
