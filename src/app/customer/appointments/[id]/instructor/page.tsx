"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select Instructor (`/customer/appointments/[id]/instructor`) — Figma 4189-86847
// ─────────────────────────────────────────────────────────────────────────────
//
// Step 1 of the Private appointment flow (Select staff → Select date & time →
// Review and book). A single-select list of the appointment branch's active
// instructors; tapping one records it on the appointment draft and advances to
// the time-slot step. Returning shows the previously-picked instructor checked.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useAppointment } from "@/lib/customer/appointments-data";
import { appointmentDraft, ensureAppointmentDraft } from "@/lib/customer/booking-flow";
import { AppointmentFlowHeader } from "@/components/customer/appointments/AppointmentFlowHeader";

export default function SelectInstructorPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const appointment = useAppointment(id);
    const instructors = useAppStore((s) => s.instructors);

    ensureAppointmentDraft(id);
    const [selected, setSelected] = useState<string | null>(appointmentDraft.instructorId);

    const branchInstructors = appointment
        ? instructors.filter((i) => i.status === "active" && i.branchId === appointment.branchId)
        : [];

    function pick(instructorId: string) {
        setSelected(instructorId);
        appointmentDraft.instructorId = instructorId;
        router.push(`/customer/appointments/${id}/slot`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <AppointmentFlowHeader
                title="Select staff"
                progress={33}
                onClose={() => router.push("/customer/search")}
            />

            <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-6">
                {branchInstructors.map((i) => {
                    const isSel = selected === i.id;
                    return (
                        <button
                            key={i.id}
                            type="button"
                            onClick={() => pick(i.id)}
                            className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors active:bg-gray-50"
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                {i.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={i.imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                ) : (
                                    <span className="text-xs font-semibold text-[#667085]">{i.initials}</span>
                                )}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#344054]">
                                {i.name}
                            </span>
                            {isSel ? (
                                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#d7ffe9]">
                                    <Check className="size-2.5 text-[#085d3a]" strokeWidth={3} aria-hidden />
                                </span>
                            ) : (
                                <span className="size-4 shrink-0 rounded-full border border-[#d0d5dd]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
