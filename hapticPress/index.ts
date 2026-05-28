/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    onReaction: { type: OptionType.BOOLEAN, description: "Vibrate when adding a reaction", default: true  },
    onSend:     { type: OptionType.BOOLEAN, description: "Vibrate when sending a message", default: true  },
    onMention:  { type: OptionType.BOOLEAN, description: "Vibrate on @mention notification", default: true },
    reactionMs: { type: OptionType.NUMBER,  description: "Reaction vibration duration (ms)", default: 30 },
    sendMs:     { type: OptionType.NUMBER,  description: "Send vibration duration (ms)", default: 50 },
    mentionMs:  { type: OptionType.NUMBER,  description: "Mention vibration pattern (ms)", default: 80 },
});

const vib = (ms: number) => { try { navigator.vibrate?.(ms); } catch {} };

function onPointerUp(e: PointerEvent) {
    const el = e.target as HTMLElement;
    if (settings.store.onReaction && el.closest("[class*=\"reactionBtn-\"]"))
        vib(settings.store.reactionMs);
    if (settings.store.onSend && (el.closest("[class*=\"sendButton-\"]") || el.closest("[aria-label=\"Send Message\"]")))
        vib(settings.store.sendMs);
}

function onNotif(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (settings.store.onMention && detail?.type === "MESSAGE" && detail?.mention)
        vib(settings.store.mentionMs);
}

export default definePlugin({
    name: "HapticPress",
    description: "Adds Android haptic (vibration) feedback to reactions, sending messages, and @mention notifications.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() {
        document.addEventListener("pointerup", onPointerUp, { capture: true });
        document.addEventListener("VendrixNotification", onNotif);
    },
    stop() {
        document.removeEventListener("pointerup", onPointerUp, { capture: true });
        document.removeEventListener("VendrixNotification", onNotif);
    },
});
