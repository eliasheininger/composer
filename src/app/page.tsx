import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    // --composer-top is where the composer's input sits: the reply above it
    // grows upward into that space and the row below it grows downward, so
    // the input itself never moves.
    <main className="flex flex-1 flex-col items-center px-4 py-12 [--composer-top:40vh]">
      <Chat />
    </main>
  );
}
