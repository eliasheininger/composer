"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { BlocksIcon, PaperclipIcon, PlusIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";

import {
  Cascader,
  CascaderContent,
  CascaderPanel,
  CascaderTrigger,
} from "@/components/reui/cascader/cascader";
import {
  CascaderAction,
  CascaderFooter,
  CascaderSubmenu,
  CascaderSubmenuContent,
  CascaderSubmenuTrigger,
} from "@/components/reui/cascader/cascader-footer";
import { CascaderSeparator } from "@/components/reui/cascader/cascader-item";
import type { CascaderNode } from "@/components/reui/cascader/cascader-types";
import { Badge } from "@/components/ui/badge";
import { InputGroupButton } from "@/components/ui/input-group";
import { INTEGRATIONS, type IntegrationId } from "@/lib/mock-data";
import { ENTER_SCALE } from "@/lib/motion";

import { IntegrationIcon } from "./connected-apps";

/**
 * The menu holds commands only, so the cascader's option tree stays empty:
 * a `CascaderAction` is deliberately not a node, which keeps Add files out
 * of any selection, filter or arrow-key ring. Hoisted so the identity is
 * stable across renders.
 */
const NO_ITEMS: CascaderNode[] = [];

export type AddMenuProps = {
  /** Opens the native file picker. */
  onAddFiles: () => void;
  /** No more files can be attached: the entry stays listed but disabled. */
  filesFull?: boolean;
  connected: IntegrationId[];
  /** Connects the app, or disconnects it again; nothing is authenticated. */
  onToggle: (id: IntegrationId) => void;
  disabled?: boolean;
};

/**
 * The plus menu: one entry point for adding files and connecting apps, on
 * the ReUI Cascader's footer actions. The panel is the footer alone, two
 * commands and no search field; Connected apps opens a flyout beside the
 * panel, on hover as well as on click and ArrowRight, with a search field
 * over the integrations. Each connects on the spot and then carries a
 * Connected badge, so the flyout stays open for the status to be seen where
 * the click landed; a second press disconnects it again. Add files closes
 * the menu before the picker takes over.
 */
export function AddMenu({
  onAddFiles,
  filesFull = false,
  connected,
  onToggle,
  disabled = false,
}: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const [appsOpen, setAppsOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /**
   * Set on a press of the Connected apps row. The row opens on hover, so by
   * the time it is clicked the flyout is already open and the press would
   * toggle it shut: that one close is dropped, and the flyout stays.
   */
  const rowPressRef = useRef(false);

  /** The flyout forgets its query when it closes, so it reopens complete. */
  const setAppsOpen = useCallback((next: boolean) => {
    setAppsOpenState(next);
    if (!next) setQuery("");
  }, []);

  const trimmed = query.trim().toLowerCase();
  const shown = trimmed
    ? INTEGRATIONS.filter((app) => app.name.toLowerCase().includes(trimmed))
    : INTEGRATIONS;

  /**
   * The flyout's roving focus and typeahead run on the popup, after any
   * handler on the field. Typing, caret moves and Home/End belong to the
   * field, so they stop here; ArrowDown and ArrowUp fall through to move
   * onto the entries, and Escape and Tab to close the flyout.
   */
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (shown[0]) onToggle(shown[0].id);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") return;
    if (event.key === "Escape" || event.key === "Tab") return;
    event.stopPropagation();
  }

  /**
   * A keyboard open lands on the first command, so the arrow keys work at
   * once; a pointer open falls through to Base UI's default, the popup, so
   * a click paints no focus ring. Without a search field the cascader's own
   * default would leave a keyboard open on the popup too.
   */
  const initialFocus = useCallback((openType: string) => {
    if (openType !== "keyboard") return true;
    return (
      popupRef.current?.querySelector<HTMLElement>(
        '[data-slot="cascader-footer"] button',
      ) ?? true
    );
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // The flyout never outlives the menu it hangs off.
    if (!next) setAppsOpen(false);
  }

  /** Every open lands in the search field, pointer or keyboard. */
  const flyoutInitialFocus = useCallback(() => searchRef.current ?? true, []);

  function addFiles() {
    setOpen(false);
    onAddFiles();
  }

  return (
    <Cascader
      items={NO_ITEMS}
      open={open}
      onOpenChange={handleOpenChange}
      disabled={disabled}
    >
      <CascaderTrigger
        showIcon={false}
        aria-label="Add files or connect apps"
        render={
          <InputGroupButton
            size="icon-sm"
            className={cn(
              "rounded-full focus-visible:border-transparent focus-visible:ring-0",
              // Press feedback: the base button withholds its press scale
              // from popup triggers, so it is restated here. 150ms ease-out,
              // from the button's own transition. Still under reduced motion.
              "active:scale-[0.97] motion-reduce:active:scale-100",
              // Open state is a colour, not a motion: the menu beside it is
              // the thing that moves.
              "aria-expanded:bg-accent aria-expanded:text-accent-foreground",
            )}
          />
        }
      >
        <PlusIcon aria-hidden="true" className="size-5" />
      </CascaderTrigger>

      <CascaderContent
        ref={popupRef}
        align="start"
        initialFocus={initialFocus}
        className="w-56"
        // The popups are portaled, but React still bubbles their clicks up
        // to the InputGroupAddon this menu sits in, whose click-to-focus
        // would pull focus out of the menu and close it. Both popups are
        // React descendants of this one, so one stop covers them.
        onClick={(event) => event.stopPropagation()}
      >
        <CascaderPanel>
          {/* No list above it, so the footer gives up the rule it would
              otherwise draw between the two. */}
          <CascaderFooter className="border-t-0">
            <CascaderAction
              icon={<PaperclipIcon className="size-4" />}
              disabled={filesFull}
              onSelect={addFiles}
              // Moving onto the other command closes the flyout, the way a
              // menu bar follows the pointer.
              onPointerEnter={() => setAppsOpen(false)}
            >
              Add files
            </CascaderAction>

            <CascaderSubmenu
              open={appsOpen}
              onOpenChange={(next) => {
                const pressed = rowPressRef.current;
                rowPressRef.current = false;
                if (!next && pressed) return;
                setAppsOpen(next);
              }}
            >
              <CascaderSubmenuTrigger
                icon={<BlocksIcon className="size-4" />}
                onPointerEnter={() => setAppsOpen(true)}
                onPointerDown={() => {
                  rowPressRef.current = true;
                }}
              >
                Connected apps
              </CascaderSubmenuTrigger>
              <CascaderSubmenuContent
                // Grows out of the row that opened it, not its own centre.
                className="w-64 max-h-80 origin-(--transform-origin)"
                initialFocus={flyoutInitialFocus}
              >
                <div className="flex h-8 shrink-0 items-center gap-2 px-2">
                  <SearchIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {/* tabIndex -1: the panel's focus manager runs modal (no
                      CascaderInput), and pulls a tabbable element it does
                      not own back inside, closing the menu. The flyout
                      closes on Tab anyway, so no tab stop is lost. */}
                  <input
                    ref={searchRef}
                    type="text"
                    tabIndex={-1}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search apps"
                    aria-label="Search apps"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-full w-full min-w-0 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
                  />
                </div>
                <CascaderSeparator />
                {/* The popup clips at its max height, so the entries scroll
                    on their own under the pinned search field. */}
                <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
                  {shown.map((app) => {
                    const isConnected = connected.includes(app.id);
                    return (
                      <CascaderAction
                        key={app.id}
                        icon={<IntegrationIcon id={app.id} />}
                        onSelect={() => onToggle(app.id)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 truncate">{app.name}</span>
                          {isConnected ? (
                            <Badge
                              variant="secondary"
                              className={cn("ms-auto shrink-0", ENTER_SCALE)}
                            >
                              Connected
                            </Badge>
                          ) : (
                            <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                              Connect
                            </span>
                          )}
                        </span>
                      </CascaderAction>
                    );
                  })}
                  {shown.length === 0 ? (
                    <p className="py-2 text-center text-sm text-muted-foreground">
                      No apps match
                    </p>
                  ) : null}
                </div>
              </CascaderSubmenuContent>
            </CascaderSubmenu>
          </CascaderFooter>
        </CascaderPanel>
      </CascaderContent>
    </Cascader>
  );
}
