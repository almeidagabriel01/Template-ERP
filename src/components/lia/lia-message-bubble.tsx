"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { LiaMessage } from "@/types/ai";

interface LiaMessageBubbleProps {
  message: LiaMessage;
}

function ErrorBadge({ message }: { message: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 ml-2",
        "px-1.5 py-0.5 text-xs font-semibold rounded",
        "bg-destructive/10 text-destructive",
      )}
    >
      {message}
    </span>
  );
}

function ToolResultInline({
  toolResult,
}: {
  toolResult: NonNullable<LiaMessage["toolResults"]>[number];
}) {
  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{toolResult.name}</span>
      {typeof toolResult.result === "string"
        ? `: ${toolResult.result}`
        : ` — ${JSON.stringify(toolResult.result).slice(0, 120)}`}
    </div>
  );
}

export function LiaMessageBubble({ message }: LiaMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "self-end rounded-tr-sm bg-card border border-border text-foreground"
            : "self-start rounded-tl-sm bg-muted text-foreground leading-relaxed",
        )}
      >
        {/* Message content */}
        {isUser || message.isStreaming ? (
          // User messages and streaming Lia messages: plain text
          <span>{message.content}</span>
        ) : (
          // Post-stream Lia messages: render with ReactMarkdown
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Inline error badge */}
        {message.error && (
          <ErrorBadge message={message.error} />
        )}

        {/* Tool results (inline display — replaced by LiaToolResultCard in Plan 06) */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolResults.map((tr, i) => (
              <ToolResultInline key={i} toolResult={tr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
