"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Account settings (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 2858:110671 — Account settings landing page.
//
// Phase 1 shipped the static page chrome + toast placeholders. Phase 2 now
// wires every action button to its proper modal flow:
//
//   • Edit profile  → 1-step modal (avatar + name) — Figma 4346:271454
//   • Change email  → 3-step modal chain (verify → OTP → new email)
//                       4344:266656 → 4346:266742 → 4346:267459
//   • Change phone  → 2-step modal chain (number → OTP)
//                       4346:272487 → 4346:278002
//   • Change pass.  → 1-step modal w/ live validation — 4346:282772
//
// Submitting any flow:
//   (1) mutates `currentUser` on the store so the page (and sidebar avatar
//       chip, and any other consumer) reflects the change immediately;
//   (2) closes the modal;
//   (3) fires the corresponding success toast.
//
// Phase 3 will centralize the seed file so account edits also propagate to
// the demo persona records — for now `setCurrentUser` is the single source
// of truth and every other consumer is already a subscriber.
//
// NOTE — "Forgot" link from the Figma is intentionally omitted per the
// brief: this is an in-app, already-authenticated account screen, so the
// forgot-password recovery path doesn't belong here.

import { useState } from "react";
import { Edit02, Eye, EyeOff } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { User } from "@/types";
import {
    EditProfileModal,
    ChangeEmailVerifyModal,
    ChangeEmailOtpModal,
    ChangeEmailNewModal,
    ChangePhoneNewModal,
    ChangePhoneOtpModal,
    ChangePasswordModal,
} from "@/components/account/AccountModals";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map the prototype's three legacy role buckets to the human-readable label
 *  shown in the "Role" row. Owner-tier users land on "Super admin" to match
 *  the Figma; instructor / member personas show their own label. */
function roleDisplayName(role: User["role"]): string {
    if (role === "admin") return "Super admin";
    if (role === "instructor") return "Instructor";
    return "Member";
}

function fullNameOf(user: User): string {
    const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    return name || "—";
}

/** ui-avatars fallback — same generation rule as the Sidebar so the chip
 *  beside the user-menu and the 96×96 photo on this page never diverge.
 *  Honours data-URL avatars uploaded via Edit profile. */
function avatarFor(user: User): string {
    if (user.avatar_url) return user.avatar_url;
    const seed = user.first_name
        ? `${user.first_name}+${user.last_name ?? ""}`
        : "Admin";
    return `https://ui-avatars.com/api/?name=${seed}&background=c4edd6&color=0c2d34&bold=true`;
}

// ─── Flow state ─────────────────────────────────────────────────────────────

/** Discriminated union driving the entire modal chain. One flow active at a
 *  time; each transition is captured here so back-stepping (e.g. closing the
 *  OTP modal cancels the email change) is automatic — just set kind to "idle". */
type FlowState =
    | { kind: "idle" }
    | { kind: "edit_profile" }
    | { kind: "change_email_verify" }
    | { kind: "change_email_otp" }
    | { kind: "change_email_new" }
    | { kind: "change_phone_new" }
    | { kind: "change_phone_otp"; pendingPhone: string }
    | { kind: "change_password" };

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
    const currentUser = useAppStore(s => s.currentUser);
    // Phase 3 — every edit goes through the partial-merge action so we
    // never have to re-spread the full user shape per-modal. Every consumer
    // of `currentUser` (Sidebar avatar chip, Customer Plan-tab "removed
    // by" attribution, Add complimentary credit granter) re-renders in
    // the same render cycle.
    const updateAccountProfile = useAppStore(s => s.updateAccountProfile);
    const showToast = useAppStore(s => s.showToast);

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // ── Per-flow handlers ────────────────────────────────────────────────

    function submitEditProfile(next: { firstName: string; lastName: string; avatarUrl: string }) {
        updateAccountProfile({
            first_name: next.firstName,
            last_name: next.lastName,
            avatar_url: next.avatarUrl,
        });
        setFlow({ kind: "idle" });
        showToast(
            "Profile updated",
            "Your profile information has been saved.",
            "success",
            "check",
        );
    }

    function submitChangeEmail(newEmail: string) {
        updateAccountProfile({ email: newEmail });
        setFlow({ kind: "idle" });
        showToast(
            "Email updated",
            "Your email address has been changed successfully.",
            "success",
            "check",
        );
    }

    function submitChangePhone() {
        if (flow.kind !== "change_phone_otp") return;
        updateAccountProfile({ phone: flow.pendingPhone });
        setFlow({ kind: "idle" });
        showToast(
            "Phone number updated",
            "Your phone number has been changed successfully.",
            "success",
            "check",
        );
    }

    function submitChangePassword(newPassword: string) {
        // Persist the new password into the centralized account profile so
        // the Password row's eye-toggle always reveals the current value.
        updateAccountProfile({ password: newPassword });
        setFlow({ kind: "idle" });
        showToast(
            "Password updated",
            "Your password has been changed successfully.",
            "success",
            "check",
        );
    }

    return (
        <>
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)] p-6 w-full">
                <div className="flex flex-col gap-6">
                    {/* ── Top: avatar + name + email + Edit profile ───────── */}
                    <div className="relative flex items-center gap-4 w-full">
                        <Avatar src={avatarFor(currentUser)} alt={fullNameOf(currentUser)} />
                        <div className="flex-1 min-w-0 flex flex-col">
                            <p className="text-[20px] font-semibold text-[#101828] leading-[30px]">
                                {fullNameOf(currentUser)}
                            </p>
                            <p className="text-[14px] text-[#667085] leading-5 break-words">
                                {currentUser.email || "—"}
                            </p>
                        </div>
                        <Button
                            variant="secondary-gray"
                            size="md"
                            leftIcon={<Edit02 className="w-5 h-5" />}
                            onClick={() => setFlow({ kind: "edit_profile" })}
                        >
                            Edit profile
                        </Button>
                    </div>

                    <Divider />

                    {/* ── Account details ────────────────────────────────── */}
                    <SectionBlock title="Account details">
                        <InfoRow
                            label="Role"
                            value={roleDisplayName(currentUser.role)}
                        />
                        <InfoRow
                            label="Email"
                            value={currentUser.email || "—"}
                            action={
                                <Button
                                    variant="secondary-gray"
                                    size="md"
                                    onClick={() => setFlow({ kind: "change_email_verify" })}
                                >
                                    Change
                                </Button>
                            }
                        />
                        <InfoRow
                            label="Phone number"
                            value={currentUser.phone || "—"}
                            action={
                                <Button
                                    variant="secondary-gray"
                                    size="md"
                                    onClick={() => setFlow({ kind: "change_phone_new" })}
                                >
                                    Change
                                </Button>
                            }
                        />
                    </SectionBlock>

                    <Divider />

                    {/* ── Password ───────────────────────────────────────── */}
                    <SectionBlock title="Password">
                        <PasswordRow
                            password={currentUser.password ?? ""}
                            onChange={() => setFlow({ kind: "change_password" })}
                        />
                    </SectionBlock>
                </div>
            </div>

            {/* ── Modal chain ────────────────────────────────────────────── */}

            {flow.kind === "edit_profile" && (
                <EditProfileModal
                    initialFirstName={currentUser.first_name ?? ""}
                    initialLastName={currentUser.last_name ?? ""}
                    initialAvatar={currentUser.avatar_url ?? ""}
                    onClose={() => setFlow({ kind: "idle" })}
                    onSubmit={submitEditProfile}
                />
            )}

            {flow.kind === "change_email_verify" && (
                <ChangeEmailVerifyModal
                    currentEmail={currentUser.email}
                    onClose={() => setFlow({ kind: "idle" })}
                    onSendCode={() => setFlow({ kind: "change_email_otp" })}
                />
            )}

            {flow.kind === "change_email_otp" && (
                <ChangeEmailOtpModal
                    onClose={() => setFlow({ kind: "idle" })}
                    onVerify={() => setFlow({ kind: "change_email_new" })}
                    onResend={() => { /* resend simulated — no-op for prototype */ }}
                />
            )}

            {flow.kind === "change_email_new" && (
                <ChangeEmailNewModal
                    onClose={() => setFlow({ kind: "idle" })}
                    onDone={submitChangeEmail}
                />
            )}

            {flow.kind === "change_phone_new" && (
                <ChangePhoneNewModal
                    currentPhone={currentUser.phone}
                    onClose={() => setFlow({ kind: "idle" })}
                    onSend={(country, number) => {
                        const pretty = `${country.dial} ${number.replace(/\s+/g, " ").trim()}`;
                        setFlow({ kind: "change_phone_otp", pendingPhone: pretty });
                    }}
                />
            )}

            {flow.kind === "change_phone_otp" && (
                <ChangePhoneOtpModal
                    onClose={() => setFlow({ kind: "idle" })}
                    onVerify={submitChangePhone}
                    onResend={() => { /* resend simulated — no-op for prototype */ }}
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

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Avatar({ src, alt }: { src: string; alt: string }) {
    return (
        <div
            className="relative rounded-full w-[96px] h-[96px] shrink-0 overflow-hidden border-4 border-white bg-[#e0e0e0]"
            style={{
                boxShadow:
                    "0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)",
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className="w-full h-full object-cover rounded-full"
            />
            {/* Contrast border — preserves the 1px dark hairline from the Figma. */}
            <div className="absolute inset-0 rounded-full border-1 border-[rgba(0,0,0,0.08)] pointer-events-none" />
        </div>
    );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <p className="text-[18px] font-semibold text-[#101828] leading-7">
                {title}
            </p>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

function InfoRow({
    label,
    value,
    action,
}: {
    label: string;
    value: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-6 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-[14px] text-[#667085] leading-5">{label}</p>
                <p className="text-[16px] font-medium text-[#101828] leading-6 break-words">
                    {value}
                </p>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

/** Password-specific row — same shape as InfoRow but the value has an
 *  inline eye-toggle so the saved password can be revealed in place. The
 *  toggle is local state (UI-only); the actual value comes from
 *  `currentUser.password` so a Change-password submit updates this row in
 *  the same render. */
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
                        className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#475467] hover:text-[#101828] hover:bg-[#f2f4f7] transition-colors shrink-0"
                        aria-label={show ? "Hide password" : "Show password"}
                        title={show ? "Hide password" : "Show password"}
                    >
                        {show ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                </div>
            </div>
            <div className="shrink-0">
                <Button variant="secondary-gray" size="md" onClick={onChange}>
                    Change password
                </Button>
            </div>
        </div>
    );
}

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}
