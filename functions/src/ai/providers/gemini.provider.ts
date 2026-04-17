import { GoogleGenAI } from "@google/genai";
import type { Chat, FunctionCall, GenerateContentResponse, Part } from "@google/genai";
import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";
import type { AiChatSession, AiProvider, ProviderEvent, ToolFeedback } from "./provider.interface";

class GeminiDeferredSession implements AiChatSession {
  private chat: Chat;
  private started = false;
  // Maps function name → call id from the last tool_calls turn.
  // Gemini 3+ requires echoing back the call id when sending function responses.
  private lastCallIds = new Map<string, string>();

  constructor(chat: Chat) {
    this.chat = chat;
  }

  async *streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent> {
    let message: string | Part[];

    if (!this.started) {
      this.started = true;
      message = typeof input === "string" ? input : "";
    } else if (Array.isArray(input)) {
      // Tool-result turn: send functionResponse parts with role "user" (handled by SDK).
      message = (input as ToolFeedback[]).map((fb) => ({
        functionResponse: {
          id: this.lastCallIds.get(fb.name) ?? fb.name,
          name: fb.name,
          response: fb.response as Record<string, unknown>,
        },
      }));
    } else {
      message = input as string;
    }

    this.lastCallIds.clear();

    const stream: AsyncGenerator<GenerateContentResponse> = await this.chat.sendMessageStream({ message });

    let lastChunk: GenerateContentResponse | undefined;
    let totalTokens = 0;

    for await (const chunk of stream) {
      lastChunk = chunk;

      if (chunk.text) {
        yield { type: "text", content: chunk.text };
      }

      if (chunk.usageMetadata?.totalTokenCount) {
        totalTokens = chunk.usageMetadata.totalTokenCount;
      }
    }

    // Function calls are aggregated by the SDK and available on the final chunk.
    const functionCalls = lastChunk?.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name) {
          this.lastCallIds.set(call.name, call.id ?? call.name);
        }
      }
      const validCalls = functionCalls.filter((call): call is FunctionCall & { name: string } => !!call.name);
      if (validCalls.length > 0) {
        yield {
          type: "tool_calls",
          calls: validCalls.map((call) => ({
            name: call.name,
            args: (call.args ?? {}) as Record<string, unknown>,
          })),
        };
      }
    }

    yield { type: "done", totalTokens };
  }
}

export class GeminiProvider implements AiProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  createSession(opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession {
    // Convert @google/generative-ai tool format to @google/genai format.
    // Old field: "parameters" (with SchemaType enum). New field: "parametersJsonSchema" (plain JSON Schema).
    // Values are identical at runtime — SchemaType enum values are lowercase strings ("object", "string", etc.).
    const tools =
      opts.tools.length > 0
        ? opts.tools.map((tool) => ({
            functionDeclarations: (tool.functionDeclarations ?? []).map((decl) => ({
              name: decl.name,
              description: decl.description,
              parametersJsonSchema: decl.parameters as unknown as Record<string, unknown>,
            })),
          }))
        : undefined;

    const history = opts.history.map((msg) => ({
      role: msg.role === "model" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    const chat = this.ai.chats.create({
      model: opts.modelName,
      config: {
        systemInstruction: opts.systemPrompt,
        tools,
      },
      history,
    });

    return new GeminiDeferredSession(chat);
  }
}
