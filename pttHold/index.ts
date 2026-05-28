/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    holdMs:         { type: OptionType.NUMBER,  description: "Hold duration before PTT activates (ms)", default: 200 },
    excludeInputs:  { type: OptionType.BOOLEAN, description: "Ignore touches that start on an input/button", default: true },
    vibrate:        { type: OptionType.BOOLEAN, description: "Vibrate when PTT activates", default: true },
});

let holdTimer: any = null;
let pttActive = false;
let MediaEngineActions: any = null;

function getMediaEngine() {
    if (!MediaEngineActions) MediaEngineActions = findByProps("setLocalMute", "toggleSelfDeaf") ?? null;
    return MediaEngineActions;
}

function activatePTT() {
    pttActive = true;
    if (settings.store.vibrate) navigator.vibrate?.(30);
    try { getMediaEngine()?.setLocalMute?.(false); } catch {}
}

function deactivatePTT() {
    if (!pttActive) return;
    pttActive = false;
    try { getMediaEngine()?.setLocalMute?.(true); } catch {}
}

function onTouchStart(e: TouchEvent) {
    if (settings.store.excludeInputs) {
        const tag = (e.target as HTMLElement).tagName;
        if (["INPUT","TEXTAREA","BUTTON","SELECT"].includes(tag)) return;
    }
    holdTimer = setTimeout(activatePTT, settings.store.holdMs);
}

function onTouchEnd() {
    clearTimeout(holdTimer);
    deactivatePTT();
}

export default definePlugin({
    name: "PTTHold",
    description: "Hold anywhere on screen to push-to-talk in voice channels. Release to mute again.",
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
        deactivatePTT();
    },
});
