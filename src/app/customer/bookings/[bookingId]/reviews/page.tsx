"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — All reviews (`/customer/bookings/[bookingId]/reviews`) — Figma 3586-72577
// ─────────────────────────────────────────────────────────────────────────────
// Opened from "More reviews". The class's full review list (newest first),
// filtered by a single topic chip (Instructor (4) …) and/or a star rating via the
// "Star ▾" chip → filter sheet (Figma 3586-73249, single-select). No search.

import { Fragment, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Star01 } from "@untitledui/icons";
import { useBookingDetail, useClassReviews } from "@/lib/customer/bookings-data";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import { ReviewRow } from "@/components/customer/bookings/RatingsSection";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { Button } from "@/components/ui/button";

const STAR_OPTIONS = [5, 4, 3, 2, 1];

export default function ReviewsPage() {
    const router = useRouter();
    const { bookingId } = useParams<{ bookingId: string }>();
    const vm = useBookingDetail(bookingId);
    const reviews = useClassReviews(vm?.detail.id ?? "");
    const scrolled = useMainScrolled();

    const [topic, setTopic] = useState<string | null>(null);
    const [star, setStar] = useState<number | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [draftStar, setDraftStar] = useState<number | null>(null);

    const list = reviews.reviews.filter(
        (r) => (topic === null || r.tags.includes(topic)) && (star === null || Math.round(r.score) === star),
    );

    function openFilter() {
        setDraftStar(star);
        setFilterOpen(true);
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">Ratings</p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-2">
                {/* Filter row — topic chips + Star chip */}
                <div className="flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                        <div className="flex gap-2 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {reviews.tags.map((t) => {
                                const on = topic === t.tag;
                                return (
                                    <button
                                        key={t.tag}
                                        type="button"
                                        onClick={() => setTopic(on ? null : t.tag)}
                                        className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm leading-5 ${
                                            on ? "border-2 border-[var(--brand-primary)] bg-[var(--brand-tertiary)]" : "border border-[#e4e7ec] bg-white"
                                        }`}
                                    >
                                        <span className="font-medium text-[#344054]">{t.tag}</span>
                                        <span className="font-normal text-[#667085]"> ({t.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Right fade so chips bleed under the Star control */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#f9fafb] to-transparent" />
                    </div>

                    <div className="h-7 w-px shrink-0 bg-[#e4e7ec]" />

                    <button
                        type="button"
                        onClick={openFilter}
                        className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 ${
                            star !== null ? "border-2 border-[var(--brand-primary)] bg-white" : "border border-[#e4e7ec] bg-white"
                        }`}
                    >
                        <Star01 className="size-4" style={{ fill: "#fdb022", color: "#fdb022" }} aria-hidden />
                        <span className="whitespace-nowrap text-sm font-medium leading-5 text-[#344054]">
                            {star !== null ? `${star} Star` : "Star"}
                        </span>
                        <ChevronDown className="size-4 text-[#344054]" aria-hidden />
                    </button>
                </div>

                {/* Review list */}
                {list.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={Star01}
                            title="No reviews match"
                            description="Try a different topic or star rating."
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {list.map((r, i) => (
                            <Fragment key={r.id}>
                                {i > 0 && <div className="h-px w-full bg-[#e4e7ec]" />}
                                <ReviewRow review={r} />
                            </Fragment>
                        ))}
                    </div>
                )}
            </div>

            {/* Star filter sheet (Figma 3586-73249) — single-select, one star per row */}
            <CustomerSheet open={filterOpen} onClose={() => setFilterOpen(false)}>
                <div className="flex flex-col">
                    <SheetToolbar title="Filter ratings" onClose={() => setFilterOpen(false)} />

                    <div className="flex flex-col">
                        {STAR_OPTIONS.map((n) => {
                            const on = draftStar === n;
                            return (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setDraftStar(on ? null : n)}
                                    className="flex items-center gap-3 py-4 text-left"
                                >
                                    <Star01 className="size-6" style={{ fill: "#fdb022", color: "#fdb022" }} aria-hidden />
                                    <span className="flex-1 text-sm font-medium leading-5 text-[var(--brand-text)]">{n} Star</span>
                                    <RadioDot checked={on} />
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4">
                        <Button
                            variant="secondary"
                            size="xl"
                            className="w-[106px] rounded-full"
                            onClick={() => setDraftStar(null)}
                        >
                            Reset
                        </Button>
                        <Button
                            variant="primary"
                            size="xl"
                            className="flex-1 rounded-full"
                            onClick={() => {
                                setStar(draftStar);
                                setFilterOpen(false);
                            }}
                        >
                            Set filter
                        </Button>
                    </div>
                </div>
            </CustomerSheet>
        </div>
    );
}
