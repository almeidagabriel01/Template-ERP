"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { LiaMessage } from "@/types/ai";
import { LiaToolResultCard } from "./lia-tool-result-card";

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


export function LiaMessageBubble({ message }: LiaMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "rounded-tr-sm bg-card border border-border text-foreground"
            : "rounded-tl-sm bg-muted text-foreground leading-relaxed",
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

        {/* Tool results using collapsible cards */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-1 space-y-1">
            {message.toolResults.map((tr, i) => (
              <LiaToolResultCard
                key={i}
                toolName={tr.name}
                result={tr.result}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
