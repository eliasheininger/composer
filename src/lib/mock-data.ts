/**
 * All mock data for the composer lives here. There is no backend: the model
 * picker, attachments and streamed replies read from this file only.
 */

// ---------------------------------------------------------------------------
// Models (step 3: model picker)
// ---------------------------------------------------------------------------

export type ModelProvider = "openai" | "anthropic" | "google";

export type Model = {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  tier: "fast" | "balanced" | "deep";
};

export const MODELS: Model[] = [
  {
    id: "claude-4.6-opus",
    name: "Claude 4.6 Opus",
    provider: "anthropic",
    description: "Deepest reasoning for long, multi-step work.",
    tier: "deep",
  },
  {
    id: "claude-4.6-sonnet",
    name: "Claude 4.6 Sonnet",
    provider: "anthropic",
    description: "Balanced speed and quality for everyday tasks.",
    tier: "balanced",
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    description: "Fast general-purpose model.",
    tier: "fast",
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    provider: "google",
    description: "Large context window for big documents.",
    tier: "balanced",
  },
];

export const DEFAULT_MODEL_ID: Model["id"] = "claude-4.6-sonnet";

/** Simulated fetch of the model list when the composer mounts. */
export const MODELS_TIMING = {
  latencyMs: 600,
} as const;

// ---------------------------------------------------------------------------
// Attachments (step 2: file picker, drag and drop, paste)
// ---------------------------------------------------------------------------

export const ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxBytes: 10 * 1024 * 1024,
  /**
   * What the picker, drop zone and paste handler accept. MIME wildcards and
   * extensions both work; extensions catch text files the browser reports
   * with an empty type.
   */
  accept: [
    "image/*",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    ".md",
    ".txt",
    ".csv",
  ],
} as const;

/** Simulated upload timing so progress states are visible and reviewable. */
export const UPLOAD_TIMING = {
  /** Total simulated upload duration per file, in milliseconds. */
  durationMs: 1800,
  /** How often progress ticks. */
  tickMs: 120,
  /** Roughly one in N uploads fails, to exercise the error and retry states. */
  failEvery: 6,
} as const;

/**
 * Simulated reading of attached files before a reply, shown as a trace.
 * Each file advances by its own speed per tick so they finish unevenly.
 */
export const PROCESS_TIMING = {
  tickMs: 160,
  /** Percent gained per tick, cycled by file position. */
  speeds: [9, 6, 13, 8, 11],
} as const;

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Simulated round trip for sending a message. */
export const SEND_TIMING = {
  /** Base latency before the server "accepts" the message. */
  latencyMs: 700,
  /** Extra latency per attached file, so bigger sends feel heavier. */
  perAttachmentMs: 150,
  /** Roughly one in N sends fails, to exercise the not-sent state and retry. */
  failEvery: 5,
} as const;

// ---------------------------------------------------------------------------
// Replies (step 4: streaming with ReUI c-message-7)
// ---------------------------------------------------------------------------

export type MockReply = {
  /** Shown while the reply is "thinking" before the first token arrives. */
  thinking: string;
  answer: string;
};

export const STREAM_TIMING = {
  /** Delay before the first character appears. */
  pendingMs: 900,
  /** Delay between reveal steps. */
  stepMs: 24,
  /** Base characters per step; the fake API varies the chunk around this. */
  stepChars: 1,
} as const;

export const REPLIES: MockReply[] = [
  {
    thinking: "Reading the 14:00 to 14:10 trace…",
    answer:
      "The tax service began retrying every confirm call at 14:05, twice at 400ms each, so p95 on POST /api/checkout/confirm went from 240ms to 3.1s. The database was never the bottleneck: connection wait stayed under 5ms for the whole window. Rolling the tax client back to 1.8.3 at 14:41 returned p95 to 260ms within two minutes.",
  },
  {
    thinking: "Checking what changed this week…",
    answer:
      "Two blockers cleared and one is still open. The webhook retry fix merged Tuesday, the migration rehearsal passed Wednesday, and the billing export is still waiting on a decision from the finance team. I'd suggest raising it in Monday's sync.",
  },
  {
    thinking: "Thinking…",
    answer:
      "Here's a short plan: start with the smallest change that proves the idea, measure it against the current baseline, then expand scope only if the numbers hold. I can draft the first step if you tell me which metric matters most.",
  },
];

/** Picks a reply deterministically from the message so demos are repeatable. */
export function pickReply(text: string): MockReply {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return REPLIES[Math.abs(hash) % REPLIES.length];
}
