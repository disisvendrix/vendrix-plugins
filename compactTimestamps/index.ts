/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    messageSpacing: { type: OptionType.BOOLEAN, description: "Reduce spacing between message groups", default: true },
    timestampSize:  { type: OptionType.NUMBER,  description: "Timestamp font size (px, default 10)", default: 10 },
});

let styleEl: HTMLStyleElement | null = null;

function buildCSS(): string {
    const s = settings.store;
    return `
/* CompactTimestamps — Vendrix plugin */
[class*="timestamp-"]  { font-size: ${s.timestampSize}px !important; }
[class*="messageListItem-"] time { font-size: ${s.timestampSize}px !important; }
${s.messageSpacing ? `
[class*="cozyMessage-"]      { margin-top: 2px !important; }
[class*="groupSpaceAlt-"]    { height: 4px  !important; }
[class*="divider-"]          { margin: 4px 0 !important; }
` : ""}
    `.trim();
}

function apply() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vendrix-compact-timestamps";
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildCSS();
}

export default definePlugin({
    name: "CompactTimestamps",
    description: "Shrinks timestamps and reduces spacing between messages for a denser chat view on mobile.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() { apply(); },
    stop()  { styleEl?.remove(); styleEl = null; },
});
