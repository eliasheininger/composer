/**
 * The fake backend. Every function here stands in for a network call: it
 * takes real time, reports progress where a real call would, and fails on a
 * predictable schedule so every loading and error state can be exercised.
 * Timings and failure rates live in mock-data.ts.
 */

import {
  APP_LOOKUP_TIMING,
  ATTACHMENT_LIMITS,
  MODELS,
  MODELS_TIMING,
  PROCESS_TIMING,
  SEND_TIMING,
  STREAM_TIMING,
  UPLOAD_TIMING,
  type MockReply,
  type Model,
} from "./mock-data";

/** A failure the UI should surface with a retry, as opposed to a cancel. */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** A send that the "server" rejected; the message stays in the transcript as not sent. */
export class SendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SendError";
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

let sendAttempts = 0;

type SimulateSendOptions = {
  attachmentCount?: number;
  signal?: AbortSignal;
};

/**
 * Pretends to deliver a message. Resolves with the server timestamp once the
 * latency has passed, or rejects with a SendError every Nth attempt.
 */
export async function simulateSend({
  attachmentCount = 0,
  signal,
}: SimulateSendOptions = {}): Promise<{ sentAt: Date }> {
  sendAttempts += 1;
  const attempt = sendAttempts;
  await wait(
    SEND_TIMING.latencyMs + attachmentCount * SEND_TIMING.perAttachmentMs,
    signal,
  );
  if (attempt % SEND_TIMING.failEvery === 0) {
    throw new SendError("Message could not be delivered");
  }
  return { sentAt: new Date() };
}

let attempts = 0;

type SimulateUploadOptions = {
  onProgress: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Stands in for a real upload. Progress ticks on a timer, bigger files take a
 * little longer, and every Nth attempt fails part way through so the error
 * and retry states can be exercised. Retrying the same file succeeds, because
 * the counter is per attempt rather than per file.
 */
export function simulateUpload(
  file: File,
  { onProgress, signal }: SimulateUploadOptions,
): Promise<void> {
  attempts += 1;
  const attempt = attempts;
  const shouldFail = attempt % UPLOAD_TIMING.failEvery === 0;
  // Fail somewhere between 40% and 70% so the bar visibly stops short.
  const failAt = 0.4 + (attempt % 3) * 0.15;

  const sizeFactor = Math.min(file.size / ATTACHMENT_LIMITS.maxBytes, 1);
  const duration = UPLOAD_TIMING.durationMs * (0.75 + sizeFactor * 0.5);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }

    const start = performance.now();
    let timer: ReturnType<typeof setTimeout>;

    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });

    const tick = () => {
      const fraction = Math.min((performance.now() - start) / duration, 1);

      if (shouldFail && fraction >= failAt) {
        signal?.removeEventListener("abort", abort);
        reject(new UploadError("Connection dropped"));
        return;
      }

      onProgress(fraction);

      if (fraction >= 1) {
        signal?.removeEventListener("abort", abort);
        resolve();
        return;
      }
      timer = setTimeout(tick, UPLOAD_TIMING.tickMs);
    };

    timer = setTimeout(tick, UPLOAD_TIMING.tickMs);
  });
}

/** Pretends to fetch the model list. */
export async function loadModels({
  signal,
}: { signal?: AbortSignal } = {}): Promise<Model[]> {
  await wait(MODELS_TIMING.latencyMs, signal);
  return MODELS;
}

export type StreamResult = {
  status: "completed" | "stopped";
  text: string;
};

type StreamReplyOptions = {
  /** Called with the text revealed so far, from the first chunk onwards. */
  onToken: (text: string) => void;
  /** Reveal the whole answer at once after the wait, for reduced motion. */
  revealAll?: boolean;
  signal?: AbortSignal;
};

/** Chunk sizes cycle through this so the stream feels uneven, like tokens. */
const CHUNKS = [3, 5, 4, 6, 2, 5];

/**
 * Pretends to stream a reply. Nothing arrives during the pending wait, then
 * the answer is revealed in small chunks on a timer. Aborting stops the timer
 * and resolves with whatever was revealed, so the partial text is kept.
 */
export function streamReply(
  reply: MockReply,
  { onToken, revealAll = false, signal }: StreamReplyOptions,
): Promise<StreamResult> {
  return new Promise((resolve) => {
    let revealed = 0;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (status: StreamResult["status"]) => {
      signal?.removeEventListener("abort", abort);
      resolve({ status, text: reply.answer.slice(0, revealed) });
    };
    const abort = () => {
      clearTimeout(timer);
      finish("stopped");
    };

    if (signal?.aborted) {
      finish("stopped");
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    const tick = () => {
      const chunk = revealAll
        ? reply.answer.length
        : CHUNKS[step % CHUNKS.length] * STREAM_TIMING.stepChars;
      step += 1;
      revealed = Math.min(revealed + chunk, reply.answer.length);
      onToken(reply.answer.slice(0, revealed));
      if (revealed >= reply.answer.length) {
        finish("completed");
        return;
      }
      timer = setTimeout(tick, STREAM_TIMING.stepMs);
    };

    timer = setTimeout(tick, STREAM_TIMING.pendingMs);
  });
}

export type AppLookupStage = "searching" | "reading" | "done";

type ConsultAppOptions = {
  onProgress: (stage: AppLookupStage) => void;
  signal?: AbortSignal;
};

/**
 * Pretends to consult a connected app before a reply: a search, then a read
 * of what it found. Aborting rejects with AbortError between the two.
 */
export async function consultApp({
  onProgress,
  signal,
}: ConsultAppOptions): Promise<void> {
  onProgress("searching");
  await wait(APP_LOOKUP_TIMING.searchMs, signal);
  onProgress("reading");
  await wait(APP_LOOKUP_TIMING.readMs, signal);
  onProgress("done");
}

export type ProcessingStage = "reading" | "done";

export type ProcessingProgress = {
  /** Percent read per file, by position. */
  progress: number[];
  stage: ProcessingStage;
};

type ProcessAttachmentsOptions = {
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal;
};

/**
 * Pretends to read the attached files before a reply: every file gains its
 * own percentage per tick until all are read. Aborting rejects with
 * AbortError and stops the ticks.
 */
export function processAttachments(
  files: { size: number }[],
  { onProgress, signal }: ProcessAttachmentsOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let progress = files.map(() => 0);
    let timer: ReturnType<typeof setTimeout>;

    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    const finish = () => {
      signal?.removeEventListener("abort", abort);
      onProgress({ progress, stage: "done" });
      resolve();
    };

    const tick = () => {
      progress = progress.map((value, index) =>
        Math.min(
          100,
          value + PROCESS_TIMING.speeds[index % PROCESS_TIMING.speeds.length],
        ),
      );
      if (progress.every((value) => value >= 100)) {
        finish();
        return;
      }
      onProgress({ progress, stage: "reading" });
      timer = setTimeout(tick, PROCESS_TIMING.tickMs);
    };

    onProgress({ progress, stage: "reading" });
    timer = setTimeout(tick, PROCESS_TIMING.tickMs);
  });
}
