# Composer

A chat composer: the input area at the bottom of an AI chat, built as a
standalone piece rather than inside a chat app. The composer is the whole
product here, so everything above it is kept to the minimum needed to show
it working.

Front end only. There is no backend and no AI; every upload, send, reply and
model list is simulated.

**[Live demo](https://composer-eliasheininger.vercel.app)** · [Repository](https://github.com/eliasheininger/composer)

## How the fake parts work

The brief asks for uploads that take a moment or fail and a reply that
streams back, so how real the fake feels is part of the craft. Every
interaction that would be a network call goes through one module,
[`src/lib/mock-api.ts`](src/lib/mock-api.ts). Each function takes real time,
reports progress where a real one would, can be aborted, and fails on a
fixed schedule rather than at random, so every error state is reachable on
demand instead of by luck.

| Call | Behaviour |
| --- | --- |
| `simulateUpload` | Ticks progress, fails every 6th attempt part way through |
| `simulateSend` | Latency scaled by attachment count, fails every 5th send |
| `processAttachments` | Reads each file at its own speed |
| `streamReply` | Waits, then reveals the answer in uneven chunks |
| `loadModels` | Returns the model list after a short delay |

Timings, limits and canned replies live in
[`src/lib/mock-data.ts`](src/lib/mock-data.ts).

## What it covers

**Writing.** The input grows with the text and caps before it pushes the
page around, then scrolls. Long unbroken words wrap rather than overflow,
which matters in German.

**Attachments.** Files arrive by clicking the paperclip, dragging onto the
composer, or pasting. Each chip carries its own state: a file-type icon, a
shimmering name and a counting percentage while uploading, a size and type
once done, a warning tint with retry when an upload fails. Rejections are
grouped by reason so a batch produces one short line each, and file names
are shortened mid-string so the extension survives.

**Sending.** The full journey: typing, sending, waiting, streaming,
completed, with a stop button that keeps whatever had already arrived. A
send can also fail, with retry and discard. A message carrying files shows a
trace of them being read before the reply begins.

**Model picker.** Chosen from the three optional extras. The list is fetched
with a simulated delay and has its own loading and error states; the
selection persists across messages.

## Motion

Entrances use a strong ease-out at 200ms. Anything that changes size, like
the composer growing for a chip, is treated as a morph rather than an
entrance and uses the iOS drawer curve: opening at 260ms, closing slightly
quicker at 220ms. Nothing animates on a keyboard-initiated action, because
sending is a hundred-times-a-day gesture and motion there reads as lag.
Reduced motion keeps the fade and drops the movement.

The vocabulary lives in [`src/lib/motion.ts`](src/lib/motion.ts) so the
timings are stated once.

## Components

The rule for this project was to reach for an existing primitive before
writing one. There is no hand-rolled button, menu, tooltip or chip: shadcn/ui
supplies the input group, attachment, message, bubble, marker, trace,
dropdown menu, tooltip and spinner, and ReUI supplies the Frame the composer
sits in, the Badge used for rejections, and the clipboard hook.

Several parts follow a ReUI block closely: the model picker is built on
`@reui/c-dropdown-menu-18`, the streaming reply on Message 7, the file trace
on Trace 22, and the copy button on `c-button-42`.

**Two generated files are deliberately modified** and will be overwritten if
the shadcn CLI is re-run over them:

- `ui/button.tsx` — press feedback scales rather than nudging, and the
  transition is bounded instead of `transition: all`
- `ui/dropdown-menu.tsx` — menu items use a pointer cursor

File-type icons are generated once from the VS Code icon set into
[`src/components/ui/svgs/file-types.tsx`](src/components/ui/svgs/file-types.tsx)
by `pnpm generate:file-icons`, so the icon set stays a dev dependency and
nothing is fetched at runtime.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on
the `base-nova` preset over Base UI, and the ReUI registry as `@reui/*`.

## Running it

```bash
pnpm install
pnpm dev
```

## Structure

```
src/
  app/                  Root layout and the single page
  components/
    ui/                 shadcn/ui primitives (generated; two are modified, see above)
    reui/               ReUI primitives (generated)
    composer/           The composer: input, attachments, model picker
    chat/               Conversation state and what sits above the composer
  hooks/                ReUI clipboard hook (generated)
  lib/
    mock-api.ts         The fake backend
    mock-data.ts        Models, limits, timings, canned replies
    motion.ts           Shared easing and entrance classes
    files.ts            Size formatting, accept matching, name shortening
```

## What I would do next

- **Mentions.** The extra I most wanted and did not reach: `@` to pull in an
  agent, integration or file, driven entirely from the keyboard.
- **Exit animations.** Entrances are animated, removals are not. Animating an
  unmount means holding the element past removal, which the attachment row
  already does and nothing else does yet.
- **Tests.** There are none. The upload, send and stream state machines are
  pure enough to test without a browser.
- **The trace collapsible** animates height, which is layout-bound. It is the
  one piece of motion that does not run on the GPU.
