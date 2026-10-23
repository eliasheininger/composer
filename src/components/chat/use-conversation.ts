"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ComposerActivity,
  ComposerSubmission,
} from "@/components/composer/types";
import {
  consultApp,
  loadModels,
  processAttachments,
  simulateSend,
  streamReply,
} from "@/lib/mock-api";
import {
  DEFAULT_MODEL_ID,
  pickAppLookup,
  pickReply,
  type Model,
} from "@/lib/mock-data";

import type {
  AssistantMessage,
  ChatMessage,
  ModelsStatus,
  UserMessage,
} from "./types";

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Owns the conversation: the message list, the selected model, the model
 * list fetch, and every in-flight send or stream so each one can be cancelled
 * from Stop, Discard or unmount. All timers live in the fake API; this hook
 * only holds the AbortControllers that end them.
 */
export function useConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus>("loading");
  const [modelsAttempt, setModelsAttempt] = useState(0);
  // The selection lives here, not in the composer, so it survives every send.
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);

  const inFlight = useRef(new Map<string, AbortController>());

  const patch = useCallback(
    <T extends ChatMessage>(id: string, changes: Partial<T>) => {
      setMessages((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
    },
    [],
  );

  // Models load once on mount and again on each retry; retryModels flips the
  // status back to loading before bumping the attempt.
  useEffect(() => {
    const controller = new AbortController();
    loadModels({ signal: controller.signal })
      .then((list) => {
        setModels(list);
        setModelsStatus("ready");
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setModelsStatus("error");
      });
    return () => controller.abort();
  }, [modelsAttempt]);

  const generate = useCallback(
    (user: UserMessage) => {
      const reply = pickReply(user.text);
      const files = user.attachments.map(({ id, name, size }) => ({
        id,
        name,
        size,
      }));
      const lookup = pickAppLookup(user.text, user.connectedApps);
      const assistant: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "",
        modelId: user.modelId,
        thinking: reply.thinking,
        status: files.length > 0 || lookup ? "processing" : "waiting",
        processing:
          files.length > 0
            ? { files, progress: files.map(() => 0), stage: "reading" }
            : undefined,
        appLookup: lookup ? { ...lookup, stage: "searching" } : undefined,
      };
      setMessages((current) => [...current, assistant]);

      const controller = new AbortController();
      inFlight.current.set(assistant.id, controller);

      // Reduced motion gets the whole answer at once rather than a faster crawl.
      const revealAll = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Attached files are read first, as a trace, then any connected app
      // is consulted, then the reply streams.
      const read =
        files.length > 0
          ? processAttachments(files, {
              signal: controller.signal,
              onProgress: (progress) =>
                patch<AssistantMessage>(assistant.id, {
                  processing: { files, ...progress },
                }),
            })
          : Promise.resolve();

      const consulted = lookup
        ? read.then(() =>
            consultApp({
              signal: controller.signal,
              onProgress: (stage) =>
                patch<AssistantMessage>(assistant.id, {
                  appLookup: { ...lookup, stage },
                }),
            }),
          )
        : read;

      consulted
        .then(() => patch<AssistantMessage>(assistant.id, { status: "waiting" }))
        .then(() =>
          streamReply(reply, {
            signal: controller.signal,
            revealAll,
            onToken: (text) =>
              patch<AssistantMessage>(assistant.id, {
                status: "streaming",
                text,
              }),
          }),
        )
        .then(({ status, text }) =>
          patch<AssistantMessage>(assistant.id, {
            status,
            text,
            finishedAt: new Date(),
          }),
        )
        .catch((error: unknown) => {
          // Stop during file reading aborts before the stream starts.
          if (isAbort(error)) {
            patch<AssistantMessage>(assistant.id, {
              status: "stopped",
              finishedAt: new Date(),
            });
          }
        })
        .finally(() => inFlight.current.delete(assistant.id));
    },
    [patch],
  );

  const deliver = useCallback(
    (user: UserMessage) => {
      const controller = new AbortController();
      inFlight.current.set(user.id, controller);
      patch<UserMessage>(user.id, { status: "sending" });

      simulateSend({
        attachmentCount: user.attachments.length,
        signal: controller.signal,
      })
        .then(({ sentAt }) => {
          patch<UserMessage>(user.id, { status: "sent", sentAt });
          generate(user);
        })
        .catch((error: unknown) => {
          if (!isAbort(error)) patch<UserMessage>(user.id, { status: "failed" });
        })
        .finally(() => inFlight.current.delete(user.id));
    },
    [generate, patch],
  );

  const activity: ComposerActivity = messages.some(
    (item) => item.role === "user" && item.status === "sending",
  )
    ? "sending"
    : messages.some(
          (item) =>
            item.role === "assistant" &&
            (item.status === "processing" ||
              item.status === "waiting" ||
              item.status === "streaming"),
        )
      ? "generating"
      : "idle";

  const send = useCallback(
    (submission: ComposerSubmission) => {
      // The composer already blocks this; guard again so a stray submit
      // during generation can never start a second round trip.
      if (activity !== "idle") return;
      const user: UserMessage = {
        ...submission,
        id: crypto.randomUUID(),
        role: "user",
        status: "sending",
      };
      setMessages((current) => [...current, user]);
      deliver(user);
    },
    [activity, deliver],
  );

  /** Interrupts the reply in progress; its partial text stays in the transcript. */
  const stop = useCallback(() => {
    for (const item of messages) {
      if (
        item.role === "assistant" &&
        (item.status === "processing" ||
          item.status === "waiting" ||
          item.status === "streaming")
      ) {
        inFlight.current.get(item.id)?.abort();
      }
    }
  }, [messages]);

  const retry = useCallback(
    (id: string) => {
      const user = messages.find(
        (item): item is UserMessage => item.id === id && item.role === "user",
      );
      if (user) deliver(user);
    },
    [deliver, messages],
  );

  const discard = useCallback((id: string) => {
    inFlight.current.get(id)?.abort();
    setMessages((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.role === "user") {
        for (const item of target.attachments) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  // Cancel anything still running if the conversation unmounts.
  useEffect(() => {
    const active = inFlight.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      active.clear();
    };
  }, []);

  return {
    messages,
    activity,
    send,
    stop,
    retry,
    discard,
    models,
    modelsStatus,
    modelId,
    setModelId,
    retryModels: () => {
      setModelsStatus("loading");
      setModelsAttempt((count) => count + 1);
    },
  };
}
