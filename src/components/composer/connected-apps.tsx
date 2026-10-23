"use client";

import { useId } from "react";
import { cn } from "cn";

import {
  Avatar,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Dropbox,
  Figma,
  GitHub,
  Gmail,
  GoogleDrive,
  Linear,
  Notion,
  Slack,
} from "@/components/ui/svgs/integrations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INTEGRATIONS, type IntegrationId } from "@/lib/mock-data";
import { ENTER_SCALE } from "@/lib/motion";

type IntegrationIconProps = {
  id: IntegrationId;
  className?: string;
};

/** Brand marks for the mock integrations, sized for menu rows. */
export function IntegrationIcon({ id, className }: IntegrationIconProps) {
  const classes = cn("size-4 shrink-0", className);
  switch (id) {
    case "dropbox":
      return <Dropbox className={classes} aria-hidden="true" />;
    case "figma":
      return <Figma className={classes} aria-hidden="true" />;
    case "github":
      return <GitHub className={classes} aria-hidden="true" />;
    case "gmail":
      return <Gmail className={classes} aria-hidden="true" />;
    case "google-drive":
      return <GoogleDrive className={classes} aria-hidden="true" />;
    case "linear":
      return <Linear className={classes} aria-hidden="true" />;
    case "notion":
      return <Notion className={classes} aria-hidden="true" />;
    case "slack":
      return <Slack className={classes} aria-hidden="true" />;
  }
}

type ConnectedAppsProps = {
  connected: IntegrationId[];
  className?: string;
};

/** How many marks show before the rest fold into a "+N" count. */
const MAX_VISIBLE = 3;

/**
 * The connected app marks: a "Connected apps" label and a shadcn Avatar
 * Group, sitting under the input. Informational only: each mark names its
 * app in a tooltip and nothing else, and past three the remainder is one
 * "+N" count whose tooltip lists them. Renders nothing until the first app
 * is connected, so the row stays empty for anyone who has not reached for
 * an integration.
 */
export function ConnectedApps({ connected, className }: ConnectedAppsProps) {
  const labelId = useId();
  // Menu order, not connection order, so the row never reshuffles.
  const apps = INTEGRATIONS.filter((app) => connected.includes(app.id));
  if (apps.length === 0) return null;
  const visible = apps.slice(0, MAX_VISIBLE);
  const hidden = apps.slice(MAX_VISIBLE);
  const hiddenNames = hidden.map((app) => app.name).join(", ");

  return (
    <div className={cn("flex items-center gap-2 px-1", ENTER_SCALE, className)}>
      <span id={labelId} className="text-xs text-muted-foreground">
        Connected apps
      </span>
      {/* A stack: the marks overlap, parted by the group's background ring,
          on borderless discs. */}
      <AvatarGroup role="group" aria-labelledby={labelId}>
        {visible.map((app) => (
          <Tooltip key={app.id}>
            <TooltipTrigger
              // The trigger's own slot name would replace the avatar's in the
              // merge, and the group's ring selector reads the avatar's.
              data-slot="avatar"
              render={
                <Avatar
                  size="sm"
                  // Focusable so the tooltip is reachable from the keyboard;
                  // an image rather than a button, since pressing it does
                  // nothing.
                  role="img"
                  aria-label={app.name}
                  tabIndex={0}
                  className={cn(
                    "items-center justify-center bg-background outline-hidden after:hidden",
                    ENTER_SCALE,
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  )}
                >
                  <IntegrationIcon id={app.id} className="size-3.5" />
                </Avatar>
              }
            />
            <TooltipContent>{app.name}</TooltipContent>
          </Tooltip>
        ))}
        {hidden.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <AvatarGroupCount
                  role="img"
                  aria-label={`${hidden.length} more: ${hiddenNames}`}
                  tabIndex={0}
                  className={cn(
                    "text-xs outline-hidden",
                    ENTER_SCALE,
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  )}
                >
                  +{hidden.length}
                </AvatarGroupCount>
              }
            />
            <TooltipContent>{hiddenNames}</TooltipContent>
          </Tooltip>
        ) : null}
      </AvatarGroup>
    </div>
  );
}
