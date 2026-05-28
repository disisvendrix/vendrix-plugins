/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, RestAPI, React, useState } from "@webpack/common";

const settings = definePluginSettings({
    messageCount: { type: OptionType.NUMBER,  description: "Number of messages to preview", default: 5 },
    holdMs:       { type: OptionType.NUMBER,  description: "Long-press duration to trigger peek (ms)", default: 500 },
});

let holdTimer: any = null;
let activePopup: HTMLElement | null = null;

async function showPeek(channelId: string, anchorEl: HTMLElement) {
    if (activePopup) { activePopup.remove(); activePopup = null; }
    const ch = ChannelStore.getChannel(channelId);
    if (!ch) return;

    const popup = Object.assign(document.createElement("div"), {
        style: "position:fixed;z-index:99999;background:var(--background-floating);border-radius:10px;padding:12px;box-shadow:0 4px 24px #0006;max-width:320px;width:80vw;max-height:60vh;overflow-y:auto",
    });

    const rect = anchorEl.getBoundingClientRect();
    popup.style.top  = `${Math.min(rect.bottom + 8, window.innerHeight - 280)}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`;

    popup.innerHTML = `<div style="font-weight:600;font-size:13px;margin-bottom:8px;opacity:.8">#${ch.name}</div><div style="font-size:12px;opacity:.6">Loading…</div>`;
    document.body.appendChild(popup);
    activePopup = popup;

    // Close on outside tap
    setTimeout(() => document.addEventListener("touchstart", dismissIfOutside, { once: true, capture: true }), 50);

    try {
        const res = await RestAPI.get({ url: `/channels/${channelId}/messages?limit=${settings.store.messageCount}` });
        const msgs: any[] = res.body ?? [];
        popup.innerHTML = `<div style="font-weight:600;font-size:13px;margin-bottom:8px;opacity:.8">#${ch.name} — last ${msgs.length} messages</div>` +
            msgs.reverse().map(m => `
                <div style="margin-bottom:8px;font-size:12px">
                    <span style="font-weight:600;color:var(--header-secondary)">${m.author?.username ?? "?"}</span>
                    <span style="opacity:.5;font-size:10px;margin-left:4px">${new Date(m.timestamp).toLocaleTimeString()}</span>
                    <div style="margin-top:2px;opacity:.85">${m.content || "<em style=\"opacity:.4\">attachment / embed</em>"}</div>
                </div>`).join("");
    } catch {
        popup.innerHTML += `<div style="font-size:12px;color:red">Could not load messages.</div>`;
    }
}

function dismissIfOutside(e: TouchEvent) {
    if (activePopup && !activePopup.contains(e.target as Node)) {
        activePopup.remove(); activePopup = null;
    }
}

function onTouchStart(e: TouchEvent) {
    const li = (e.target as HTMLElement).closest("[class*=\"containerDefault-\"]") as HTMLElement | null;
    if (!li) return;
    const channelId = li.dataset.listItemId?.split("_").pop() ?? li.id?.split("-").pop();
    if (!channelId) return;
    holdTimer = setTimeout(() => {
        navigator.vibrate?.(20);
        showPeek(channelId, li);
    }, settings.store.holdMs);
}

function onTouchEnd() { clearTimeout(holdTimer); }

export default definePlugin({
    name: "ChannelPeek",
    description: "Long-press a channel in the sidebar to preview its last messages without navigating to it.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() {
        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchend",   onTouchEnd,   { passive: true });
        document.addEventListener("touchcancel",onTouchEnd,   { passive: true });
    },
    stop() {
        document.removeEventListener("touchstart", onTouchStart);
        document.removeEventListener("touchend",   onTouchEnd);
        document.removeEventListener("touchcancel",onTouchEnd);
        clearTimeout(holdTimer);
        activePopup?.remove(); activePopup = null;
    },
});
