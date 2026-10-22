import type { ComposerAttachment } from "@/components/composer/types";
import type { ProcessingProgress } from "@/lib/mock-api";

/** Where a user message is in its round trip to the (fake) server. */
export type DeliveryStatus = "sending" | "sent" | "failed";

/**
 * Lifecycle of an assistant reply: reading attached files (only when there
 * are any), waiting for the first token, streaming, then completed on its
 * own or stopped by the user with the partial text kept.
 */
export type GenerationStatus =
  | "processing"
  | "waiting"
  | "streaming"
  | "completed"
  | "stopped";

export type UserMessage = {
  id: string;
  role: "user";
  text: string;
  attachments: ComposerAttachment[];
  modelId: string;
  status: DeliveryStatus;
  sentAt?: Date;
};

export type FileProcessing = ProcessingProgress & {
  files: { id: string; name: string; size: number }[];
};

export type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  modelId: string;
  /** Shown while waiting for the first token. */
  thinking: string;
  status: GenerationStatus;
  /** Present when the message it answers carried attachments. */
  processing?: FileProcessing;
  finishedAt?: Date;
};

export type ChatMessage = UserMessage | AssistantMessage;

export type ModelsStatus = "loading" | "ready" | "error";
