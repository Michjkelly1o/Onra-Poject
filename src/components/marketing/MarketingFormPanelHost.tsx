"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — MarketingFormPanelHost
// ─────────────────────────────────────────────────────────────────────────────
//
// Mounted once in the admin layout. Renders every Marketing create / edit form
// (Campaign, Promotion, Announcement) inside a right-anchored SlidePanel, driven
// by `useMarketingFormPanelStore`. Any trigger across the module opens a form via
// `openMarketingFormPanel(...)` (client 2026-08-18) — no page navigation. Mirrors
// the Staff & Shifts pattern ([StaffFormPanelHost](src/components/staff/StaffFormPanelHost.tsx)).

import { useEffect, useState } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { useMarketingFormPanelStore, type MarketingFormPanel } from "@/lib/marketing-form-panel";
import { useAppStore } from "@/lib/store";
import { MarketingFormPage, marketingItemToInitial } from "@/components/marketing/MarketingFormPage";
import { AnnouncementFormPage, announcementItemToInitial } from "@/components/marketing/AnnouncementFormPage";
import { PromoFormPage, promoToInitial } from "@/components/products/PromoFormPage";

// Wider than the 480px Staff panel (client 2026-08-18) so the horizontal
// ImageBannerUpload (282px tile + label/button column) and the step-1 two-up
// field grids render un-cropped — matching the legacy full-page form's ~628px
// FormCard inner width.
const WIDTH = 640;

export function MarketingFormPanelHost() {
    const panel = useMarketingFormPanelStore((s) => s.panel);
    const close = useMarketingFormPanelStore((s) => s.close);

    // Retain the last panel through the ~300ms slide-out so its form stays
    // mounted (and visible) while the panel animates closed.
    const [shown, setShown] = useState<MarketingFormPanel | null>(panel);
    useEffect(() => {
        if (panel) {
            setShown(panel);
            return;
        }
        const t = setTimeout(() => setShown(null), 320);
        return () => clearTimeout(t);
    }, [panel]);

    const s = shown;
    const isOpen = (k: MarketingFormPanel["kind"]) => panel?.kind === k;

    // Edit-mode initial data — looked up from the store for the retained panel
    // so it's ready the instant the form first mounts. Campaigns + announcements
    // share the `marketingItems` slice; promotions live in `promoCodes`.
    const editId = s?.mode === "edit" ? s.id : undefined;
    const marketingItem = useAppStore((st) =>
        editId && (s?.kind === "campaign" || s?.kind === "announcement")
            ? st.marketingItems.find(m => m.id === editId)
            : undefined,
    );
    const promo = useAppStore((st) =>
        editId && s?.kind === "promotion"
            ? st.promoCodes.find(p => p.id === editId)
            : undefined,
    );

    return (
        <>
            <SlidePanel open={isOpen("campaign")} onClose={close} width={WIDTH}>
                {s?.kind === "campaign" && (
                    <MarketingFormPage
                        mode={s.mode}
                        marketingId={s.id}
                        initial={s.mode === "edit" && marketingItem ? marketingItemToInitial(marketingItem) : undefined}
                        onClose={close}
                    />
                )}
            </SlidePanel>

            <SlidePanel open={isOpen("promotion")} onClose={close} width={WIDTH}>
                {s?.kind === "promotion" && (
                    <PromoFormPage
                        mode={s.mode}
                        promoId={s.id}
                        initial={s.mode === "edit" && promo ? promoToInitial(promo) : undefined}
                        onClose={close}
                    />
                )}
            </SlidePanel>

            <SlidePanel open={isOpen("announcement")} onClose={close} width={WIDTH}>
                {s?.kind === "announcement" && (
                    <AnnouncementFormPage
                        mode={s.mode}
                        marketingId={s.id}
                        initial={s.mode === "edit" && marketingItem ? announcementItemToInitial(marketingItem) : undefined}
                        onClose={close}
                    />
                )}
            </SlidePanel>
        </>
    );
}
