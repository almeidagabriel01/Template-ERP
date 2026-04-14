"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LiaMessage } from "@/types/ai";

interface LiaChatWindowProps {
  messages: LiaMessage[];
  isStreaming: boolean;
  /** Message bubble components rendered by the parent */
  children: React.ReactNode;
}

function TypingIndicator() {
  return (
    <div
      aria-label="Lia está digitando"
      aria-live="polite"
      className="flex items-center gap-1 self-start px-3 py-2"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function LiaChatWindow({
  messages,
  isStreaming,
  children,
}: LiaChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversa com Lia"
      className={cn(
        "flex-1 overflow-y-auto px-4 py-4",
        "flex flex-col gap-3",
      )}
    >
      {children}

      {/* Typing indicator shown while streaming */}
      {isStreaming && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
