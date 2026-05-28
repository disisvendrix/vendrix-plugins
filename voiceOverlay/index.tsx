/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, GuildStore, SelectedChannelStore, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    position: { type: OptionType.SELECT, description: "Overlay position", options: [
        { label: "Bottom-right", value: "br", default: true },
        { label: "Bottom-left",  value: "bl" },
        { label: "Top-right",    value: "tr" },
        { label: "Top-left",     value: "tl" },
    ]},
    maxUsers: { type: OptionType.NUMBER, description: "Max users to show", default: 5 },
    showNames: { type: OptionType.BOOLEAN, description: "Show usernames below avatars", default: true },
});

const speaking = new Set<string>();
let overlayEl: HTMLElement | null = null;

function getPos() {
    const p = settings.store.position;
    return {
        bottom: p.includes("b") ? "80px" : undefined,
        top:    p.includes("t") ? "80px" : undefined,
        right:  p.includes("r") ? "12px" : undefined,
        left:   p.includes("l") ? "12px" : undefined,
    };
}

function render() {
    if (!overlayEl) return;
    const users = [...speaking].slice(0, settings.store.maxUsers);
    if (!users.length) { overlayEl.style.display = "none"; return; }
    overlayEl.style.display = "flex";
    overlayEl.innerHTML = users.map(id => {
        const user = UserStore.getUser?.(id);
        const name = user?.username ?? id.slice(0, 6);
        const avatar = user ? `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.webp?size=64` : "";
        return `<div style="text-align:center;margin:0 4px">
            <div style="width:40px;height:40px;border-radius:50%;border:2px solid #23a559;background:#2b2d31;overflow:hidden">
                ${avatar ? `<img src="${avatar}" style="width:100%;height:100%">` : ""}
            </div>
            ${settings.store.showNames ? `<div style="font-size:10px;margin-top:2px;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>` : ""}
        </div>`;
    }).join("");
}

function mount() {
    overlayEl = Object.assign(document.createElement("div"), {
        id: "vendrix-voice-overlay",
        style: "position:fixed;z-index:9999;display:none;flex-direction:row;align-items:flex-end;padding:8px;background:#0008;border-radius:12px;pointer-events:none",
    });
    const pos = getPos();
    Object.assign(overlayEl.style, pos);
    document.body.appendChild(overlayEl);
}

function onSpeaking(action: any) {
    if (!action.userId) return;
    if (action.speaking) speaking.add(action.userId);
    else speaking.delete(action.userId);
    render();
}

function onVoiceStateUpdate(action: any) {
    if (!action.voiceStates) return;
    for (const vs of action.voiceStates) {
        if (!vs.channelId) speaking.delete(vs.userId);
    }
    render();
}

export default definePlugin({
    name: "VoiceOverlay",
    description: "Shows a floating overlay of who is currently speaking in your voice channel.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() {
        mount();
        FluxDispatcher.subscribe("SPEAKING", onSpeaking);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
    },
    stop() {
        FluxDispatcher.unsubscribe("SPEAKING", onSpeaking);
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
        overlayEl?.remove(); overlayEl = null;
        speaking.clear();
    },
});
