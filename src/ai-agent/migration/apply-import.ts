"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration — client-side import applier
// ─────────────────────────────────────────────────────────────────────────────
//
// The server's `commit_import` tool is pure and stateless — it can only COUNT
// what would be imported (it has no access to the client's Zustand store). This
// module is the client half: when a confirmed `import_result` card lands in the
// chat, ChatThread calls `applyImportToStore` once per import to actually write
// the parsed rows into the live store AND drop a row into the Migrations module
// (importHistory) so the import is visible where the studio expects it.
//
// Phased rollout — one entity per phase so we never ship a half-wired writer:
//   • Phase 1 (this file): customers.
//   • Phase 2+: leads, memberships, packages, class_templates, class_schedule.
// Entities not yet wired return `null` (no write, no history) — exactly the
// pre-existing "counts only" behaviour, so nothing regresses.

import type { ParsedFile } from "@/ai-agent/migration/migration-cards";
import type { EntityKey } from "@/ai-agent/migration/entities";
import type {
    ClassTemplate,
    ClassCategory,
    ClassSchedule,
    Instructor,
    Room,
    Branch,
    Service,
    Staff,
    Role,
} from "@/lib/store";
import { materialize } from "@/ai-agent/migration/parser";

/** The narrow slice of store actions the applier needs. Structurally satisfied
 *  by the real Zustand actions passed from ChatThread via `getState()`. */
export interface ImportDeps {
    addCustomer: (input: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        planKind: "membership" | "package" | null;
        gender?: string;
        dateOfBirth?: string;
        country?: string;
        state?: string;
        city?: string;
        postalCode?: string;
        streetAddress?: string;
        branchId?: string;
    }) => string;
    addMembership: (input: {
        name: string;
        description?: string;
        credits: number | "unlimited";
        duration_months: number;
        price_aed: number;
        branch_ids: string[];
        status: "active" | "inactive" | "archived";
        auto_renew?: boolean;
    }) => string;
    addPackage: (input: {
        name: string;
        description?: string;
        credits: number;
        validity_days: number;
        price_aed: number;
        branch_ids: string[];
        status: "active" | "inactive" | "archived";
    }) => string;
    addLead: (input: {
        contact_name: string;
        contact_email: string;
        phone?: string;
        gender?: "Male" | "Female";
        source: "Instagram" | "Referral" | "Walk-in" | "Website" | "Google" | "WhatsApp";
        stage: "new" | "contacted" | "trial-booked" | "trial-attended" | "paid" | "lost";
        engagement_status: "cold" | "warm" | "hot" | "converted" | "lost";
        first_purchase_amount_aed?: number;
        branch_id: string;
    }) => string;
    addClassTemplate: (input: Omit<ClassTemplate, "id">) => void;
    addClassSchedule: (input: Omit<ClassSchedule, "id">) => string;
    addGiftCardDesign: (input: {
        name: string;
        value_type: "fixed" | "custom";
        fixed_value_aed?: number;
        min_value_aed?: number;
        max_value_aed?: number;
        validity_days: number;
        status: "active" | "inactive" | "archived";
        description?: string;
        price_aed?: number;
    }) => string;
    addService: (input: Omit<Service, "id">) => string;
    addRoom: (input: Room) => void;
    addBranch: (input: Branch) => void;
    addStaff: (
        input: Omit<Staff, "id" | "inviteSentAt" | "firstLoginCompleted"> & {
            id?: string;
            inviteSentAt?: string;
            firstLoginCompleted?: boolean;
        },
    ) => string;
    /** Live class categories, for resolving a CSV category name → its FK + color. */
    classCategories: ClassCategory[];
    /** Live slices class_schedule resolves its FKs against. */
    classTemplates: ClassTemplate[];
    instructors: Instructor[];
    rooms: Room[];
    branches: Branch[];
    /** Live roles, for resolving a CSV role name → its FK. */
    roles: Role[];
    addImportHistory: (input: {
        data_type:
            | "customers"
            | "memberships"
            | "packages"
            | "class_templates"
            | "class_schedule"
            | "leads"
            | "gift_cards"
            | "services"
            | "rooms"
            | "branches"
            | "staff";
        file_name: string;
        file_type: "csv" | "xlsx" | "xls";
        total_rows: number;
        imported_rows: number;
        invalid_rows: number;
        invalid_rows_file_name?: string;
        status: "imported" | "partial" | "failed" | "pending";
        branch_id: string;
    }) => string;
    /** Branch the import is attributed to in the Migrations history row. */
    branchId: string;
}

/** Parse a currency/number string into a finite number, or `fallback`. Strips
 *  AED, commas, and stray spaces so "AED 1,200" → 1200. */
function toNumber(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const n = Number(raw.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
}

/** Map a free-text billing cycle to a month count (monthly → 1, annual → 12). */
function billingToMonths(raw: string | undefined): number {
    const s = (raw ?? "").trim().toLowerCase();
    if (/year|annual|yr|12/.test(s)) return 12;
    if (/quarter|3\s*month/.test(s)) return 3;
    if (/(6|six)\s*month/.test(s)) return 6;
    if (/week/.test(s)) return 1; // no sub-month cycle in the model — floor to 1
    return 1; // monthly / unknown → 1
}

/** Truthy-string → boolean ("yes"/"true"/"1"/"on" → true). */
function toBool(raw: string | undefined): boolean {
    return /^(y|yes|true|1|on)$/i.test((raw ?? "").trim());
}

/** Snap a free-text lead source to the funnel's enum; unknowns → "Website". */
function coerceSource(raw: string | undefined): Parameters<ImportDeps["addLead"]>[0]["source"] {
    const s = (raw ?? "").trim().toLowerCase();
    if (/insta|ig\b/.test(s)) return "Instagram";
    if (/refer|word of mouth|friend/.test(s)) return "Referral";
    if (/walk|in.?person|front desk/.test(s)) return "Walk-in";
    if (/whats.?app|wa\b/.test(s)) return "WhatsApp";
    if (/google|search|adwords|ppc/.test(s)) return "Google";
    return "Website";
}

/** Snap a free-text stage to the funnel's enum; unknowns → "new". */
function coerceStage(raw: string | undefined): Parameters<ImportDeps["addLead"]>[0]["stage"] {
    const s = (raw ?? "").trim().toLowerCase();
    if (/paid|purchased|member|won|closed/.test(s)) return "paid";
    if (/attend/.test(s)) return "trial-attended";
    if (/book|trial.*book|scheduled/.test(s)) return "trial-booked";
    if (/contact|called|emailed|reached/.test(s)) return "contacted";
    if (/lost|dead|churn|no.?show/.test(s)) return "lost";
    return "new";
}

/** Snap a free-text engagement to the enum; unknowns → "cold". */
function coerceEngagement(raw: string | undefined): Parameters<ImportDeps["addLead"]>[0]["engagement_status"] {
    const s = (raw ?? "").trim().toLowerCase();
    if (/convert|paid|member/.test(s)) return "converted";
    if (/hot/.test(s)) return "hot";
    if (/warm/.test(s)) return "warm";
    if (/lost|dead/.test(s)) return "lost";
    return "cold";
}

/** Male / Female from a free-text gender cell, else undefined. */
function coerceGender(raw: string | undefined): "Male" | "Female" | undefined {
    const s = (raw ?? "").trim().toLowerCase();
    if (s.startsWith("m")) return "Male";
    if (s.startsWith("f") || s.startsWith("w")) return "Female";
    return undefined;
}

/** Snap a free-text role to a role TYPE the studio has; unknowns → instructor
 *  (the most common studio hire). */
function coerceRoleType(
    raw: string | undefined,
): "owner" | "branch_admin" | "operator" | "front_desk" | "instructor" {
    const s = (raw ?? "").trim().toLowerCase();
    if (/instructor|teacher|coach|trainer/.test(s)) return "instructor";
    if (/front|reception|desk/.test(s)) return "front_desk";
    if (/operator|manager|ops/.test(s)) return "operator";
    if (/admin/.test(s)) return "branch_admin";
    if (/owner/.test(s)) return "owner";
    return "instructor";
}

/** Deterministic avatar colours for imported staff (from the studio palette). */
const STAFF_PALETTE = ["#7ba08c", "#a3b18a", "#c4a484", "#8a9bb0", "#b0879b", "#87a8b0"];

// ── Date / time helpers (class_schedule) ─────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse a date cell into "YYYY-MM-DD", or null when unparseable. Accepts
 *  ISO (2026-08-15) and slash formats; slash order is inferred (first > 12 →
 *  day-first, else month-first). */
function toISODate(raw: string | undefined): string | null {
    const s = (raw ?? "").trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
    if (slash) {
        let a = parseInt(slash[1], 10);
        let b = parseInt(slash[2], 10);
        let y = parseInt(slash[3], 10);
        if (y < 100) y += 2000;
        // Ambiguous MM/DD vs DD/MM — if the first number can't be a month, treat
        // it as the day; otherwise assume month-first.
        let month: number, day: number;
        if (a > 12) { day = a; month = b; } else { month = a; day = b; }
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
}

/** Weekday name for an ISO date (UTC-anchored to avoid TZ drift). */
function dayName(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    return WEEKDAYS[d.getUTCDay()] ?? "";
}

/** "Aug 15, 2026" label for an ISO date. */
function dateLabel(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** Parse a time cell into 24h "HH:MM", or null. Accepts "7:00 AM", "07:00",
 *  "19:00", "7 PM". */
function to24h(raw: string | undefined): string | null {
    const s = (raw ?? "").trim().toLowerCase();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3];
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Add minutes to a 24h "HH:MM", wrapping at 24h. */
function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(":").map(Number);
    const total = (h * 60 + m + mins) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 24h "HH:MM" → "7:00 AM". */
function to12h(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const mer = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, "0")} ${mer}`;
}

/** "7:00 AM – 8:00 AM" display range. */
function displayRange(start: string, end: string): string {
    return `${to12h(start)} – ${to12h(end)}`;
}

export interface ApplyResult {
    created: number;
    failed: number;
}

/** Migration entity → ImportHistory `data_type`. Only the entities the applier
 *  actually writes appear here; others fall through with no history row. */
type HistoryType = Parameters<ImportDeps["addImportHistory"]>[0]["data_type"];
const HISTORY_TYPE: Partial<Record<EntityKey, HistoryType>> = {
    customers: "customers",
    memberships: "memberships",
    packages: "packages",
    leads: "leads",
    class_templates: "class_templates",
    class_schedule: "class_schedule",
    gift_cards: "gift_cards",
    services: "services",
    rooms: "rooms",
    branches: "branches",
    staff: "staff",
};

/** Write a confirmed import into the live store. Returns the created/failed
 *  counts, or `null` when the entity isn't wired yet (no-op, no history). */
export function applyImportToStore(
    entity: EntityKey,
    file: ParsedFile | null,
    fileName: string,
    deps: ImportDeps,
): ApplyResult | null {
    if (!file) return null;

    if (entity === "customers") {
        const records = materialize("customers", file);
        let created = 0;
        for (const rec of records) {
            // materialize already dropped rows that fail the entity validator,
            // but guard the required trio defensively before we insert.
            if (!rec.first_name || !rec.last_name || !rec.email) continue;
            deps.addCustomer({
                firstName: rec.first_name,
                lastName: rec.last_name,
                email: rec.email,
                phone: rec.phone || undefined,
                planKind: null,
                gender: rec.gender || undefined,
                dateOfBirth: rec.date_of_birth || undefined,
                country: rec.country || undefined,
                state: rec.state || undefined,
                city: rec.city || undefined,
                postalCode: rec.postal_code || undefined,
                streetAddress: rec.street_address || undefined,
                // branch left to the store's default so imported customers
                // always land on a valid branch.
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "memberships") {
        const records = materialize("memberships", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.name) continue;
            const limit = (rec.class_limit ?? "").trim().toLowerCase();
            const credits: number | "unlimited" =
                !limit || limit === "unlimited" || limit === "0"
                    ? "unlimited"
                    : toNumber(rec.class_limit, 0);
            deps.addMembership({
                name: rec.name,
                description: rec.description || undefined,
                credits,
                duration_months: billingToMonths(rec.billing_cycle),
                price_aed: toNumber(rec.price, 0),
                branch_ids: [], // empty = sellable at every active branch
                status: "active",
                auto_renew: toBool(rec.auto_renew_default),
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "packages") {
        const records = materialize("packages", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.name) continue;
            deps.addPackage({
                name: rec.name,
                description: rec.description || undefined,
                credits: toNumber(rec.credit_count, 0),
                validity_days: toNumber(rec.valid_days, 30),
                price_aed: toNumber(rec.price, 0),
                branch_ids: [],
                status: "active",
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "leads") {
        const records = materialize("leads", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.full_name) continue;
            deps.addLead({
                contact_name: rec.full_name,
                contact_email: rec.email || "",
                phone: rec.phone || undefined,
                gender: coerceGender(rec.gender),
                source: coerceSource(rec.source),
                stage: coerceStage(rec.stage),
                engagement_status: coerceEngagement(rec.engagement_status),
                first_purchase_amount_aed: rec.first_purchase_amount
                    ? toNumber(rec.first_purchase_amount, 0)
                    : undefined,
                branch_id: deps.branchId,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "class_templates") {
        // Category is a hard FK — resolve the CSV name to a live category, or
        // fall back to the first one. If the studio has NO categories, we
        // can't build a valid template, so skip every row (counted failed)
        // rather than insert a template with a dangling category.
        const cats = deps.classCategories;
        if (cats.length === 0) {
            writeHistory(entity, fileName, file.rows.length, 0, file.rows.length, deps);
            return { created: 0, failed: file.rows.length };
        }
        const byName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c]));
        const records = materialize("class_templates", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.name) continue;
            const cat = byName.get((rec.category ?? "").trim().toLowerCase()) ?? cats[0];
            deps.addClassTemplate({
                type: "class",
                name: rec.name,
                description: rec.description || "",
                categoryId: cat.id,
                category: cat.name,
                locationType: "Group",
                durationMin: toNumber(rec.duration_minutes, 60),
                capacity: toNumber(rec.capacity, 10),
                status: "Active",
                coverColor: cat.color_hex ?? "#f1f2ed",
                applicableMembershipIds: [],
                applicablePackageIds: [],
                applicableMemberships: [],
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "class_schedule") {
        // A schedule row hangs off a real template (for name / category /
        // cover / plans). Match by name; skip rows whose template, date, or
        // start time can't be resolved (counted failed) so we never insert a
        // schedule with a dangling FK or an unparseable slot that would break
        // the grid. Instructor + room are best-effort — an unmatched one lands
        // "unassigned"/no-room, exactly like the admin schedule form allows.
        const tByName = new Map(deps.classTemplates.map((t) => [t.name.trim().toLowerCase(), t]));
        const instByName = new Map(deps.instructors.map((i) => [i.name.trim().toLowerCase(), i]));
        const roomByName = new Map(deps.rooms.map((r) => [r.name.trim().toLowerCase(), r]));
        const branch = deps.branches.find((b) => b.id === deps.branchId) ?? deps.branches[0];
        const todayISO = new Date().toISOString().slice(0, 10);

        const records = materialize("class_schedule", file);
        let created = 0;
        for (const rec of records) {
            const tpl = tByName.get((rec.template_name ?? "").trim().toLowerCase());
            if (!tpl) continue;
            const dateISO = toISODate(rec.date);
            if (!dateISO) continue;
            const start = to24h(rec.start_time);
            if (!start) continue;
            const dur = tpl.durationMin > 0 ? tpl.durationMin : 60;
            const end = to24h(rec.end_time) ?? addMinutes(start, dur);
            const inst = instByName.get((rec.instructor_name ?? "").trim().toLowerCase());
            const room = roomByName.get((rec.room_name ?? "").trim().toLowerCase());
            deps.addClassSchedule({
                templateId: tpl.id,
                type: "class",
                name: tpl.name,
                description: tpl.description,
                category: tpl.category,
                branchId: deps.branchId,
                instructorId: inst?.id ?? "",
                instructorName: inst?.name ?? "",
                instructorInitials: inst?.initials ?? "",
                instructorColor: inst?.color ?? "#e0e0e0",
                location: branch?.name ?? "",
                roomId: room?.id ?? "",
                room: room?.name ?? "",
                date: dateLabel(dateISO),
                dateISO,
                dayOfWeek: dayName(dateISO),
                startTime: start,
                endTime: end,
                displayTime: displayRange(start, end),
                booked: 0,
                capacity: toNumber(rec.capacity, tpl.capacity > 0 ? tpl.capacity : 10),
                classType: "Group",
                equipment: "",
                spotSelectionEnabled: false,
                waitlistEnabled: true,
                rating: 0,
                ratingCount: 0,
                status: dateISO < todayISO ? "Completed" : "Upcoming",
                genderAccess: "all",
                coverColor: tpl.coverColor,
                coverImage: tpl.coverImage,
                applicableMembershipIds: tpl.applicableMembershipIds,
                applicablePackageIds: tpl.applicablePackageIds,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "services") {
        // Category is a soft FK (resolve by name, fall back to first). If the
        // studio has no categories we can't build a valid service → skip all.
        const cats = deps.classCategories;
        if (cats.length === 0) {
            writeHistory(entity, fileName, file.rows.length, 0, file.rows.length, deps);
            return { created: 0, failed: file.rows.length };
        }
        const byName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c]));
        const roomByName = new Map(deps.rooms.map((r) => [r.name.trim().toLowerCase(), r]));
        const branch = deps.branches.find((b) => b.id === deps.branchId) ?? deps.branches[0];
        const records = materialize("services", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.name) continue;
            const cat = byName.get((rec.category ?? "").trim().toLowerCase()) ?? cats[0];
            const type: "private" | "recovery" = /recover|wellness|spa/i.test(rec.type ?? "")
                ? "recovery"
                : "private";
            const capacity = type === "recovery" ? toNumber(rec.capacity, 1) : 0;
            const room = roomByName.get((rec.room ?? "").trim().toLowerCase());
            deps.addService({
                name: rec.name,
                description: rec.description || "",
                categoryId: cat.id,
                category: cat.name,
                type,
                openSession: type === "recovery" && capacity > 1,
                durationMin: toNumber(rec.duration_minutes, 60),
                capacity,
                price: toNumber(rec.price, 0),
                branchId: deps.branchId,
                branchName: branch?.name ?? "",
                roomId: room?.id ?? "",
                status: "Active",
                coverColor: cat.color_hex ?? "#f1f2ed",
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "staff") {
        // Role is a hard FK. Resolve a free-text role to a role the studio
        // actually has; if none match the coerced type, fall back to any
        // non-owner role (then any role). No roles at all → skip everything.
        const roles = deps.roles;
        if (roles.length === 0) {
            writeHistory(entity, fileName, file.rows.length, 0, file.rows.length, deps);
            return { created: 0, failed: file.rows.length };
        }
        const branchByName = new Map(deps.branches.map((b) => [b.name.trim().toLowerCase(), b]));
        const fallbackBranch = deps.branches.find((b) => b.id === deps.branchId) ?? deps.branches[0];
        const todayLabel = dateLabel(new Date().toISOString().slice(0, 10));
        const records = materialize("staff", file);
        let created = 0;
        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            let first = (rec.first_name ?? "").trim();
            let last = (rec.last_name ?? "").trim();
            // Single "name" column → split into first + rest.
            if (!last && first.includes(" ")) {
                const parts = first.split(/\s+/);
                first = parts.shift() ?? "";
                last = parts.join(" ");
            }
            if (!first || !rec.email) continue;
            const roleType = coerceRoleType(rec.role);
            const role =
                roles.find((r) => r.type === roleType) ??
                roles.find((r) => r.type !== "owner") ??
                roles[0];
            if (!role) continue;
            const branch = branchByName.get((rec.branch ?? "").trim().toLowerCase()) ?? fallbackBranch;
            deps.addStaff({
                firstName: first,
                lastName: last,
                fullName: `${first} ${last}`.trim(),
                email: rec.email,
                phone: rec.phone || "",
                initials: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase(),
                color: STAFF_PALETTE[i % STAFF_PALETTE.length],
                roleId: role.id,
                branchId: branch?.id ?? null,
                status: "active",
                joinedDate: todayLabel,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "branches") {
        const records = materialize("branches", file);
        let created = 0;
        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (!rec.name) continue;
            deps.addBranch({
                id: `branch_import_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                name: rec.name,
                status: "active",
                is_main: false, // imported branches never displace the main branch
                address: rec.address || undefined,
                city: rec.city || undefined,
                state: rec.state || undefined,
                country: rec.country || undefined,
                phone: rec.phone || undefined,
                email: rec.email || undefined,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "rooms") {
        // Rooms hang off a branch — resolve by name, fall back to the default.
        const branchByName = new Map(deps.branches.map((b) => [b.name.trim().toLowerCase(), b]));
        const fallback = deps.branches.find((b) => b.id === deps.branchId) ?? deps.branches[0];
        const records = materialize("rooms", file);
        let created = 0;
        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (!rec.name) continue;
            const branch = branchByName.get((rec.branch ?? "").trim().toLowerCase()) ?? fallback;
            if (!branch) continue; // no branch to attach the room to
            deps.addRoom({
                id: `room_import_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                branch_id: branch.id,
                name: rec.name,
                capacity: toNumber(rec.capacity, 10),
                status: "active",
                equipment_notes: rec.equipment_notes || undefined,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    if (entity === "gift_cards") {
        const records = materialize("gift_cards", file);
        let created = 0;
        for (const rec of records) {
            if (!rec.name) continue;
            const isCustom = /custom|range|variable/i.test(rec.value_type ?? "");
            const fixed = toNumber(rec.fixed_value, 0);
            deps.addGiftCardDesign({
                name: rec.name,
                value_type: isCustom ? "custom" : "fixed",
                fixed_value_aed: isCustom ? undefined : fixed || undefined,
                min_value_aed: isCustom ? toNumber(rec.min_value, 0) || undefined : undefined,
                max_value_aed: isCustom ? toNumber(rec.max_value, 0) || undefined : undefined,
                validity_days: toNumber(rec.validity_days, 365),
                status: "active",
                description: rec.description || undefined,
                price_aed: isCustom ? undefined : fixed || undefined,
            });
            created++;
        }
        const total = file.rows.length;
        const failed = Math.max(0, total - created);
        writeHistory(entity, fileName, total, created, failed, deps);
        return { created, failed };
    }

    return null;
}

/** Append the Migrations-module history row for a completed import. */
function writeHistory(
    entity: EntityKey,
    fileName: string,
    total: number,
    created: number,
    failed: number,
    deps: ImportDeps,
): void {
    const dataType = HISTORY_TYPE[entity];
    if (!dataType) return;
    deps.addImportHistory({
        data_type: dataType,
        file_name: fileName || "Imported file.csv",
        file_type: "csv",
        total_rows: total,
        imported_rows: created,
        invalid_rows: failed,
        invalid_rows_file_name: failed > 0 ? "Invalid rows data report.csv" : undefined,
        status: created === 0 ? "failed" : failed > 0 ? "partial" : "imported",
        branch_id: deps.branchId,
    });
}
