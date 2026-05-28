/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

async function snapMessage(el: HTMLElement) {
    try {
        // Dynamically load html2canvas from CDN (not bundled)
        if (!(window as any).html2canvas) {
            await new Promise<void>((res, rej) => {
                const s = document.createElement("script");
                s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                s.onload = () => res(); s.onerror = rej;
                document.head.appendChild(s);
            });
        }
        const canvas: HTMLCanvasElement = await (window as any).html2canvas(el, {
            backgroundColor: getComputedStyle(document.body).getPropertyValue("--background-primary") || "#313338",
            scale: window.devicePixelRatio,
            useCORS: true,
            logging: false,
        });
        canvas.toBlob(async blob => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                showToast("Message copied as image");
            } catch {
                // Fallback: open in new tab
                window.open(canvas.toDataURL("image/png"), "_blank");
            }
        }, "image/png");
    } catch (e) {
        showToast("MessageSnap failed — " + (e as Error).message);
    }
}

function showToast(msg: string) {
    const t = Object.assign(document.createElement("div"), {
        textContent: msg,
        style: "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 16px;border-radius:8px;z-index:99999;font-size:13px;pointer-events:none",
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function onContextMenu(e: MouseEvent) {
    const msgEl = (e.target as HTMLElement).closest("[class*=\"message-\"][id^=\"chat-messages-\"]") as HTMLElement | null;
    if (!msgEl) return;
    // Find or build context menu injection point
    // We listen for the context menu and add our item when the menu opens
    requestAnimationFrame(() => {
        const menus = document.querySelectorAll("[class*=\"menu-\"][role=\"menu\"]");
        const menu = menus[menus.length - 1];
        if (!menu || menu.dataset.snapInjected) return;
        menu.dataset.snapInjected = "1";
        const item = Object.assign(document.createElement("div"), {
            role: "menuitem", tabIndex: -1,
            textContent: "Copy as Image",
            style: "padding:6px 8px;cursor:pointer;font-size:14px;",
        });
        item.addEventListener("click", () => { menu.remove(); snapMessage(msgEl); });
        menu.appendChild(item);
    });
}

export default definePlugin({
    name: "MessageSnap",
    description: "Adds \"Copy as Image\" to the message context menu, rendering the message as a PNG to your clipboard.",
    authors: [{ name: "irulune", id: 0n }],
    start() { document.addEventListener("contextmenu", onContextMenu, true); },
    stop()  { document.removeEventListener("contextmenu", onContextMenu, true); },
});
