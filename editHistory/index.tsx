/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, React, UserStore, useState } from "@webpack/common";

interface Edit { content: string; editedAt: number; }
const history = new Map<string, Edit[]>();

const settings = definePluginSettings({
    maxEditsPerMessage: { type: OptionType.NUMBER, description: "Max edits stored per message", default: 20 },
    ownOnly:            { type: OptionType.BOOLEAN, description: "Only track your own message edits", default: false },
});

function onUpdate(action: any) {
    const msg = action.message;
    if (!msg?.id || !msg.content) return;
    if (settings.store.ownOnly && msg.author?.id !== UserStore.getCurrentUser()?.id) return;
    const edits = history.get(msg.id) ?? [];
    edits.push({ content: msg.content, editedAt: Date.now() });
    if (edits.length > settings.store.maxEditsPerMessage) edits.shift();
    history.set(msg.id, edits);
}

function onContextMenu(e: MouseEvent) {
    const msgEl = (e.target as HTMLElement).closest("[id^=\"chat-messages-\"]") as HTMLElement | null;
    if (!msgEl) return;
    const msgId = msgEl.id.split("-").pop();
    if (!msgId) return;
    const edits = history.get(msgId);
    if (!edits?.length) return;

    requestAnimationFrame(() => {
        const menus = document.querySelectorAll("[class*=\"menu-\"][role=\"menu\"]");
        const menu = menus[menus.length - 1];
        if (!menu || menu.dataset.editHistoryInjected) return;
        menu.dataset.editHistoryInjected = "1";
        const item = Object.assign(document.createElement("div"), {
            role: "menuitem", tabIndex: -1,
            textContent: `Edit History (${edits.length})`,
            style: "padding:6px 8px;cursor:pointer;font-size:14px;",
        });
        item.addEventListener("click", () => {
            menu.remove();
            showHistory(msgId, edits);
        });
        menu.appendChild(item);
    });
}

function showHistory(msgId: string, edits: Edit[]) {
    const overlay = Object.assign(document.createElement("div"), {
        style: "position:fixed;inset:0;background:#0008;z-index:99998;display:flex;align-items:center;justify-content:center",
    });
    const box = Object.assign(document.createElement("div"), {
        style: "background:var(--background-primary);border-radius:12px;padding:20px;max-width:480px;width:90%;max-height:60vh;overflow-y:auto;",
    });
    box.innerHTML = `<h3 style="margin:0 0 12px;font-size:15px;">Edit History</h3>` +
        edits.map((e, i) => `<div style="margin-bottom:10px;font-size:13px;opacity:${0.5 + 0.5 * ((i + 1) / edits.length)}"><div style="opacity:.6;font-size:11px">${new Date(e.editedAt).toLocaleTimeString()}</div><div>${e.content}</div></div>`).join("") +
        `<button style="margin-top:8px;padding:4px 12px;border-radius:4px;border:none;cursor:pointer;background:var(--button-secondary-background)">Close</button>`;
    box.querySelector("button")!.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", ev => { if (ev.target === overlay) overlay.remove(); });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

export default definePlugin({
    name: "EditHistory",
    description: "Tracks message edits in memory and shows a history via the message context menu.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() {
        FluxDispatcher.subscribe("MESSAGE_UPDATE", onUpdate);
        document.addEventListener("contextmenu", onContextMenu, true);
    },
    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", onUpdate);
        document.removeEventListener("contextmenu", onContextMenu, true);
        history.clear();
    },
});
