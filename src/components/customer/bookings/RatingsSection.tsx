"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — RatingsSection — overall class ratings + review preview (3696-35019)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown on Past booking details. A 24px average star + score + count + green
// "More reviews", white tag-count chips (Instructor (4) …), then up to two recent
// reviews (avatar + name, stars + time, comment). Read-only over class_ratings.

import { Star01, User01 } from "@untitledui/icons";
import type { ClassReviewsVM, ReviewVM } from "@/lib/customer/bookings-data";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";

/** Gold-fill stars (supports half) via a clipped overlay of ★ glyphs. */
export function Stars({ score, className = "" }: { score: number; className?: string }) {
    const pct = Math.max(0, Math.min(100, (score / 5) * 100));
    return (
        <span className={`relative inline-block leading-none ${className}`} aria-label={`${score} out of 5`}>
            <span className="text-[#e4e7ec]">★★★★★</span>
            <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-[#fdb022]" style={{ width: `${pct}%` }}>
                ★★★★★
            </span>
        </span>
    );
}

export function ReviewRow({ review }: { review: ReviewVM }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
                <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                    {review.authorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={review.authorAvatar} alt="" className="size-full object-cover" />
                    ) : review.authorInitials && review.authorInitials !== "M" ? (
                        <span className="text-[7px] font-semibold leading-none text-[#667085]">{review.authorInitials}</span>
                    ) : (
                        <User01 className="size-2.5 text-[#667085]" aria-hidden />
                    )}
                </span>
                <span className="truncate text-sm font-semibold leading-5 text-[var(--brand-text)]">{review.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
                <Stars score={review.score} className="text-base" />
                <span className="text-sm font-normal leading-5 text-[#475467]">{review.timeAgo}</span>
            </div>
            <p className="text-sm font-normal leading-5 text-[#475467]">{review.comment}</p>
        </div>
    );
}

export function RatingsSection({ reviews, onMoreReviews }: { reviews: ClassReviewsVM; onMoreReviews: () => void }) {
    return (
        <>
            <div className="h-px w-full bg-[#e4e7ec]" />
            {reviews.count === 0 ? (
                <section className="flex flex-col gap-6">
                    {/* Recap — zeroed average with a muted star */}
                    <div className="flex items-center gap-1">
                        <Star01 className="size-6" style={{ fill: "#d5d9df", color: "#d5d9df" }} aria-hidden />
                        <span className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">0.0</span>
                        <span className="text-sm font-normal leading-5 text-[#475467]">(0 ratings)</span>
                    </div>
                    <div className="flex justify-center">
                        <SearchEmptyState
                            icon={Star01}
                            title="No reviews yet"
                            description="Be the first to review this class."
                        />
                    </div>
                </section>
            ) : (
                <section className="flex flex-col gap-6">
                    {/* Recap */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                                <Star01 className="size-6" style={{ fill: "#fdb022", color: "#fdb022" }} aria-hidden />
                                <span className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">
                                    {reviews.average.toFixed(1)}
                                </span>
                                <span className="text-sm font-normal leading-5 text-[#475467]">
                                    ({reviews.count} rating{reviews.count === 1 ? "" : "s"})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onMoreReviews}
                                className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                            >
                                More reviews
                            </button>
                        </div>

                        {reviews.tags.length > 0 && (
                            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {reviews.tags.map((t) => (
                                    <span
                                        key={t.tag}
                                        className="shrink-0 whitespace-nowrap rounded-lg border border-[#e4e7ec] bg-white px-4 py-2 text-sm leading-5"
                                    >
                                        <span className="font-medium text-[#344054]">{t.tag}</span>
                                        <span className="font-normal text-[#667085]"> ({t.count})</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Review previews */}
                    {reviews.reviews.slice(0, 2).map((r) => (
                        <ReviewRow key={r.id} review={r} />
                    ))}
                </section>
            )}
        </>
    );
}
