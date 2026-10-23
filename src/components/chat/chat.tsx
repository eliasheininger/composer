"use client";

import { Composer } from "@/components/composer/composer";

import { RunPanel } from "./run-panel";
import { useConversation } from "./use-conversation";

/**
 * The page: the composer, centered. Its Frame gains small panels above the
 * input: the file trace from the moment a file is attached, and the reply
 * in its own card once a message is sent. No transcript, no bubbles.
 */
export function Chat() {
  const chat = useConversation();

  const latest = chat.messages.at(-1);
  // The user turn still in flight (sending) or stranded (failed).
  const pendingSend = latest?.role === "user" ? latest : null;
  const reply = latest?.role === "assistant" ? latest : null;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {/* One live region for the whole exchange, so screen readers hear the
          states worth interrupting for without a word-by-word stutter. */}
      <span className="sr-only" aria-live="polite">
        {chat.activity === "sending"
          ? "Sending message"
          : reply?.status === "processing"
            ? reply.appLookup && !reply.processing
              ? `${reply.appLookup.verb} ${reply.appLookup.app.name}`
              : "Reading attached files"
            : chat.activity === "generating"
              ? "Generating reply"
              : pendingSend?.status === "failed"
                ? "The message could not be sent"
                : ""}
      </span>

      <Composer
        onSubmit={chat.send}
        activity={chat.activity}
        onStop={chat.stop}
        modelPicker={{
          models: chat.models,
          value: chat.modelId,
          onChange: chat.setModelId,
          status: chat.modelsStatus,
          onRetry: chat.retryModels,
        }}
        renderPanel={() => (
          <RunPanel
            pendingSend={pendingSend}
            reply={reply}
            onRetry={chat.retry}
            onDiscard={chat.discard}
          />
        )}
      />
    </div>
  );
}
