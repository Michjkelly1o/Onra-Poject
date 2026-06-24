"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor profile (/instructor/account)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 7282:5289 (Personal information tab) + Phase-1 modals
// (6378:546422 / 6378:547208 / 6378:547271).
//
// Tab strip:
//   • Personal information — built this phase
//   • Integrations         — Phase 2 (placeholder for now)
//   • Notification settings — Phase 3 (placeholder for now)
//
// All data flows through `currentUser` on the centralized store —
// instructor_profile is pushed in when the user lands on `/instructor/*`,
// so reads here mirror what the bell + dashboard see. Edit profile +
// Change password both call `updateAccountProfile` (the same admin
// mutator), so a future merge into a `staff_profiles` table will be one
// adapter swap instead of a fork.
//
// "Forgot password" link is intentionally omitted — the brief explicitly
// asks us to skip it.

import { useState } from "react";
import { Edit02, Pencil02, Eye, EyeOff } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { Button } from "@/components/ui/button";
import { ChangePasswordModal } from "@/components/account/AccountModals";
import {
    EditInstructorProfileModal,
    type InstructorProfileDraft,
} from "@/components/instructor/account/EditInstructorProfileModal";
import { IntegrationsTab } from "@/components/instructor/account/IntegrationsTab";
import { NotificationSettingsTab } from "@/components/instructor/account/NotificationSettingsTab";
import { cn } from "@/lib/utils";

type TabKey = "personal" | "integrations" | "notifications";
const TABS: { key: TabKey; label: string }[] = [
    { key: "personal",      label: "Personal information" },
    { key: "integrations",  label: "Integrations" },
    { key: "notifications", label: "Notification settings" },
];

type FlowState = { kind: "idle" } | { kind: "edit_profile" } | { kind: "change_password" };

// Weekday glyphs shown M-T-W-T-F-S-S. The instructor's working days
// determine which letters render dark/active vs. red/off. Two indices
// share the "T" + "S" glyphs because the row uses display-letters, not
// unique ids — the array carries the canonical day code as a second tuple.
const DAY_ROW: ReadonlyArray<{ code: "M" | "T" | "W" | "Th" | "F" | "Sa" | "Su"; glyph: string }> = [
    { code: "M",  glyph: "M" },
    { code: "T",  glyph: "T" },
    { code: "W",  glyph: "W" },
    { code: "Th", glyph: "T" },
    { code: "F",  glyph: "F" },
    { code: "Sa", glyph: "S" },
    { code: "Su", glyph: "S" },
];

function fmtJoinedDate(iso: string | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmt12h(hhmm: string | undefined): string {
    if (!hhmm) return "—";
    const [h, m] = hhmm.split(":").map(s => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
    const period = h >= 12 ? "PM" : "AM";
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export default function InstructorAccountPage() {
    const currentUser           = useAppStore(s => s.currentUser);
    const branches              = useAppStore(s => s.branches);
    const updateAccountProfile  = useAppStore(s => s.updateAccountProfile);
    const showToast             = useAppStore(s => s.showToast);

    const [tab, setTab]   = useState<TabKey>("personal");
    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Resolve the branch row for the "Branch information" card. The
    // `instructors` slice mirrors the `staff_profiles` seed via
    // `instructorFromSeed`, so it carries the same `branchId` the
    // Supabase row will. Falls back to the seeded instructor when the
    // staff profile FK isn't on currentUser yet (boot-time race).
    const staffProfileId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;
    const instructors = useAppStore(s => s.instructors);
    const instructor  = instructors.find(i => i.id === staffProfileId);
    const branch      = branches.find(b => b.id === instructor?.branchId);

    // ── Live admin-side fields (Phase 4 sync) ─────────────────────────────
    //
    // The instructor's professional info — Work experience, Categories,
    // Shift hours, Working days — lives in the `staff` slice that the
    // admin Staff & Permissions module mutates. Reading it here ensures
    // every admin edit on /admin/staff propagates to /instructor/account
    // in the same render cycle (no cascade fan-out needed).
    const staffSlice      = useAppStore(s => s.staff);
    const shiftsSlice     = useAppStore(s => s.shifts);
    const classCategories = useAppStore(s => s.classCategories);
    const myStaffRow      = staffSlice.find(s => s.id === staffProfileId);
    const myShift         = myStaffRow?.shiftId ? shiftsSlice.find(s => s.id === myStaffRow.shiftId) : undefined;
    const myCategoryNames = (myStaffRow?.categoryIds ?? [])
        .map(id => classCategories.find(c => c.id === id)?.name)
        .filter((n): n is string => !!n);

    // ── Edit profile flow ──────────────────────────────────────────────────
    function openEditProfile() {
        setFlow({ kind: "edit_profile" });
    }
    function submitEditProfile(draft: InstructorProfileDraft) {
        updateAccountProfile({
            first_name:    draft.firstName,
            last_name:     draft.lastName,
            email:         draft.email,
            phone:         draft.phone,
            introduction:  draft.introduction,
            avatar_url:    draft.avatarUrl,
        });
        setFlow({ kind: "idle" });
        showToast(
            "Your profile is updated",
            "All the changes has been saved.",
            "success",
            "check",
        );
    }

    // ── Change password flow ───────────────────────────────────────────────
    function openChangePassword() {
        setFlow({ kind: "change_password" });
    }
    function submitChangePassword(newPassword: string) {
        updateAccountProfile({ password: newPassword });
        setFlow({ kind: "idle" });
        showToast(
            "Password updated successfully",
            "Your password has been updated.",
            "success",
            "check",
        );
    }

    return (
        <>
            <div className="flex flex-col gap-6">
                {/* ── Tab strip — admin underline-with-no-badge style ─────── */}
                <div className="border-b border-[#e4e7ec]">
                    <div className="flex gap-1 items-end">
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={cn(
                                    "h-[48px] flex items-center px-3 transition-colors whitespace-nowrap text-[14px] font-semibold",
                                    tab === t.key
                                        ? "border-b-2 border-[#101828] text-[#101828]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab content ──────────────────────────────────────────── */}
                {tab === "personal" && (
                    <PersonalInformationTab
                        user={currentUser}
                        branchName={branch?.name}
                        workingExperienceYears={myStaffRow?.workingExperienceYears}
                        categories={myCategoryNames}
                        shiftName={myShift?.name}
                        shiftStart={myShift?.start_time}
                        shiftEnd={myShift?.end_time}
                        shiftWorkingDays={myShift?.working_days}
                        onEditProfile={openEditProfile}
                        onChangePassword={openChangePassword}
                    />
                )}
                {tab === "integrations" && (
                    <IntegrationsTab staffProfileId={staffProfileId} />
                )}
                {tab === "notifications" && (
                    <NotificationSettingsTab />
                )}
            </div>

            {/* ── Modals ────────────────────────────────────────────────── */}
            {flow.kind === "edit_profile" && (
                <EditInstructorProfileModal
                    onClose={() => setFlow({ kind: "idle" })}
                    initial={{
                        firstName:    currentUser.first_name ?? "",
                        lastName:     currentUser.last_name ?? "",
                        email:        currentUser.email ?? "",
                        phone:        currentUser.phone ?? "",
                        introduction: currentUser.introduction ?? "",
                        avatarUrl:    currentUser.avatar_url ?? "",
                    }}
                    onSubmit={submitEditProfile}
                />
            )}
            {flow.kind === "change_password" && (
                <ChangePasswordModal
                    onClose={() => setFlow({ kind: "idle" })}
                    onDone={submitChangePassword}
                />
            )}
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Personal information tab
// ────────────────────────────────────────────────────────────────────────────

interface PersonalInformationTabProps {
    user: ReturnType<typeof useAppStore.getState>["currentUser"];
    branchName: string | undefined;
    /** Admin-side staff fields synced through the `staff` slice. Undefined
     *  when the instructor's staff row isn't loaded yet. */
    workingExperienceYears?: number;
    categories?: string[];
    /** Shift label + window. When provided drives the Shift hours row;
     *  otherwise falls back to the legacy `user.working_hours_*` window. */
    shiftName?: string;
    shiftStart?: string;
    shiftEnd?: string;
    /** Shift's [Sun..Sat] boolean array. When provided drives the
     *  Working days glyph row; otherwise falls back to `user.working_days`. */
    shiftWorkingDays?: boolean[];
    onEditProfile: () => void;
    onChangePassword: () => void;
}
function PersonalInformationTab({
    user,
    branchName,
    workingExperienceYears,
    categories,
    shiftName,
    shiftStart,
    shiftEnd,
    shiftWorkingDays,
    onEditProfile,
    onChangePassword,
}: PersonalInformationTabProps) {
    const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—";
    const initials = `${(user.first_name?.[0] ?? "").toUpperCase()}${(user.last_name?.[0] ?? "").toUpperCase()}`;
    const avatarSrc = user.avatar_url || "";

    // Build the per-glyph "on" set from the shift's working_days array when
    // the shift exists; otherwise fall back to the legacy `user.working_days`
    // codes. The shift array is indexed [Sun..Sat] but the DAY_ROW glyphs
    // run Mon..Sun, so we map per code-index here.
    const SHIFT_INDEX: Record<typeof DAY_ROW[number]["code"], number> = {
        M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6, Su: 0,
    };
    const workingDaySet = new Set<string>();
    if (shiftWorkingDays && shiftWorkingDays.length === 7) {
        for (const d of DAY_ROW) {
            if (shiftWorkingDays[SHIFT_INDEX[d.code]]) workingDaySet.add(d.code);
        }
    } else {
        for (const code of user.working_days ?? []) workingDaySet.add(code);
    }
    const introduction = user.introduction ?? "";

    // Categories: comma-separated string, "—" when empty (matches the
    // Figma reference at the top of this conversation turn).
    const categoriesLabel = categories && categories.length > 0
        ? categories.join(", ")
        : "—";

    // Work experience: "1 year" / "5 years" / "—" when missing or 0.
    const workExpLabel = workingExperienceYears && workingExperienceYears > 0
        ? `${workingExperienceYears} ${workingExperienceYears === 1 ? "year" : "years"}`
        : "—";

    // Shift hours row — prefer the live shift slice ("Morning shift (07:00
    // AM - 12:00 PM)") and fall back to the user's working_hours window
    // when no shift is assigned (matches admin-side behaviour where
    // shiftless instructors follow branch hours).
    const shiftHoursLabel = (() => {
        const startSrc = shiftStart ?? user.working_hours_start;
        const endSrc   = shiftEnd   ?? user.working_hours_end;
        const window = `${fmt12h(startSrc)} - ${fmt12h(endSrc)}`;
        if (shiftName) return `${shiftName} (${window})`;
        return window;
    })();

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)] p-6 w-full">
            <div className="flex flex-col gap-6">
                {/* ── Avatar + name + email + Edit profile ─────────────── */}
                <div className="flex items-center gap-4 w-full">
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#e0e0e0] shrink-0">
                        {avatarSrc ? (
                            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#667085] text-[24px] font-semibold">
                                {initials || "?"}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[20px] font-semibold text-[#101828] leading-[30px]">
                            {fullName}
                        </p>
                        <p className="text-[14px] text-[#667085] leading-5 break-words">
                            {user.email || "—"}
                        </p>
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<Edit02 className="w-5 h-5" />}
                        onClick={onEditProfile}
                    >
                        Edit profile
                    </Button>
                </div>

                <Divider />

                {/* ── Personal information ─────────────────────────────────
                     Single consolidated grid per Figma reference shared in
                     chat — 4 rows × 2 columns. Work experience, Categories,
                     Working days and Shift hours all read live from the
                     admin `staff` slice so admin edits propagate here in
                     the same render cycle. */}
                <Section title="Personal information">
                    <FieldGrid>
                        <ReadOnlyField label="Full name"       value={fullName} />
                        <ReadOnlyField label="Joined date"     value={fmtJoinedDate(user.joined_at ?? user.created_at)} />
                        <ReadOnlyField label="Email"           value={user.email || "—"} />
                        <ReadOnlyField label="Phone"           value={user.phone || "—"} />
                        <ReadOnlyField label="Work experience" value={workExpLabel} />
                        <ReadOnlyField label="Categories"      value={categoriesLabel} />
                        <div className="flex flex-col gap-1.5 min-w-0">
                            <p className="text-[14px] text-[#667085] leading-5">Working days</p>
                            <div className="flex items-center gap-4">
                                {DAY_ROW.map((d, idx) => {
                                    const isOn = workingDaySet.has(d.code);
                                    return (
                                        <span
                                            key={idx}
                                            className={cn(
                                                "text-[16px] font-medium leading-6",
                                                isOn ? "text-[#101828]" : "text-[#f04438]",
                                            )}
                                        >
                                            {d.glyph}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <ReadOnlyField label="Shift hours" value={shiftHoursLabel} />
                    </FieldGrid>

                    {/* Introduction (tinted card with "See more" toggle) */}
                    <IntroductionCard text={introduction} />
                </Section>

                <Divider />

                {/* ── Branch information ───────────────────────────────── */}
                <Section title="Branch information">
                    <FieldGrid>
                        <ReadOnlyField label="Branch"  value={branchName ?? "—"} />
                        <ReadOnlyField label="Address" value={user.address ?? "—"} />
                    </FieldGrid>
                </Section>

                <Divider />

                {/* ── Password ─────────────────────────────────────────── */}
                <Section title="Password">
                    <PasswordRow
                        password={user.password ?? ""}
                        onChange={onChangePassword}
                    />
                </Section>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Atoms
// ────────────────────────────────────────────────────────────────────────────

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-5 w-full">
            <p className="text-[18px] font-semibold text-[#101828] leading-7">{title}</p>
            {children}
        </div>
    );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 w-full">{children}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className="text-[16px] font-medium text-[#101828] leading-6 break-words">{value}</p>
        </div>
    );
}

function IntroductionCard({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const truncated = text.length > 220 && !expanded;

    return (
        // Figma 7282:5327 — white card (not tinted), 1px gray border, ~16px
        // padding. "Introduction" label sits flush to the top edge in muted
        // gray; body text directly below; "See more" link in sage-green at
        // the bottom-left.
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-5 py-4 flex flex-col gap-1.5 w-full">
            <p className="text-[14px] text-[#667085] leading-5">Introduction</p>
            <p className={cn(
                "text-[16px] text-[#101828] leading-6 break-words",
                truncated && "line-clamp-2",
            )}>
                {text || "—"}
            </p>
            {text.length > 220 && (
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="self-start text-[14px] font-semibold text-[#7ba08c] hover:text-[#5b8270] transition-colors"
                >
                    {expanded ? "See less" : "See more"}
                </button>
            )}
        </div>
    );
}

function PasswordRow({
    password,
    onChange,
}: {
    password: string;
    onChange: () => void;
}) {
    const [show, setShow] = useState(false);
    const displayed = show && password ? password : "••••••••••••";
    return (
        <div className="flex items-center gap-6 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-[14px] text-[#667085] leading-5">Password</p>
                <div className="flex items-center gap-2">
                    <p className="text-[16px] font-medium text-[#101828] leading-6 break-all">
                        {displayed}
                    </p>
                    <button
                        type="button"
                        onClick={() => setShow(s => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#475467] hover:text-[#101828] hover:bg-[#f2f4f7] transition-colors shrink-0"
                    >
                        {show ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            <Button
                variant="secondary-gray"
                size="md"
                leftIcon={<Pencil02 className="w-5 h-5" />}
                onClick={onChange}
            >
                Change password
            </Button>
        </div>
    );
}

