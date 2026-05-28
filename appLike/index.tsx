/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    hideSidebar:  { type: OptionType.BOOLEAN, description: "Hide the persistent left sidebar (guilds + channels) so content fills the screen", default: true },
    hideScrollbar:{ type: OptionType.BOOLEAN, description: "Remove all visible scrollbars", default: true },
    hideWebJunk:  { type: OptionType.BOOLEAN, description: "Hide Download App banners and other web-only UI", default: true },
    showTabBar:   { type: OptionType.BOOLEAN, description: "Always show the bottom Home/Notifications/You tab bar", default: true },
});

const STYLE_ID = "vendrix-app-like";

function buildCSS(): string {
    const s = settings.store;
    const parts: string[] = [];

    if (s.hideSidebar) parts.push(`
        /* Guild list + channel sidebar — hidden; the overlay sidebar (shown on
           back-press / hamburger tap) is kept visible via the more-specific rule below */
        nav[class*="guilds"],
        [class*="guilds-"],
        [class*="sidebarList"],
        [class*="sidebar"]:not([class*="mobileOverlay"]):not([class*="overlay"]):not([class*="mobileSidebar"]) {
            display: none !important;
        }
        /* Friends page left-nav that web shows but app hides */
        [class*="privateChannels"],
        [class*="peopleColumn"] {
            display: none !important;
        }
        /* Make chat/content area fill the freed space */
        [class*="chat-"],
        [class*="chatContent"],
        main[class*="chat"] {
            width: 100% !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
        }
    `);

    if (s.showTabBar) parts.push(`
        /* Pin the mobile bottom tab bar to the screen bottom unconditionally
           (Discord hides it on wide viewports) */
        [class*="tabBar"],
        nav[class*="tabBar"] {
            display: flex !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 100 !important;
            height: 56px !important;
            background: var(--background-primary, #313338) !important;
            border-top: 1px solid var(--background-modifier-accent, #3f4147) !important;
        }
        /* Prevent content being hidden under the bar */
        [class*="messagesWrapper"],
        [class*="chat-"],
        [class*="scroller-"] {
            padding-bottom: 60px !important;
        }
    `);

    if (s.hideScrollbar) parts.push(`
        * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        [class*="scrollerThumb"],
        [class*="customScroller"] [class*="track"] { display: none !important; }
    `);

    if (s.hideWebJunk) parts.push(`
        [class*="downloadAppBanner"],
        [class*="downloadApp"],
        [class*="appBadge"],
        [class*="browserHeader"] { display: none !important; }
    `);

    return parts.join("\n");
}

function applyStyle() {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = buildCSS();
}

export default definePlugin({
    name: "AppLike",
    description: "Makes the Vendrix web view look like the Discord mobile app: hides the persistent sidebar, pins the bottom tab bar, and removes web-only clutter.",
    authors: [{ name: "irulune", id: 0n }],
    settings,

    start() { applyStyle(); },
    stop()  { document.getElementById(STYLE_ID)?.remove(); },
});
