import { type ClassValue, clsx } from "clsx";
import type { ChangeEvent } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared convention for every `<input type="number">` in the app:
 * placeholder "0", empty when value is 0, strips leading zeros on type
 * (so "010" lands as "10").
 *
 * Usage:
 *   <input type="number" {...numericInputProps(value, setValue)} />
 *   <input type="number" {...numericInputProps(value, setValue, { max: 52 })} />
 */
export function numericInputProps(
  value: number,
  setValue: (n: number) => void,
  opts?: { max?: number }
) {
  return {
    placeholder: "0",
    value: value === 0 ? "" : String(value),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/^0+(?=\d)/, "");
      if (raw === "") { setValue(0); return; }
      const num = Number(raw);
      if (Number.isNaN(num)) return;
      if (opts?.max !== undefined && num > opts.max) return;
      setValue(num);
    },
  };
}

/**
 * Same convention but for fields that hold the value as a string
 * (typical for form objects where every field is a string until submit).
 * Also keeps decimals intact, so prices like "10.50" pass through.
 */
export function numericStringInputProps(
  value: string,
  setValue: (s: string) => void
) {
  return {
    placeholder: "0",
    value: value === "0" ? "" : value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/^0+(?=\d)/, "");
      setValue(raw);
    },
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  // Onra convention (client 2026-08): drop ":00" on whole hours, dot minutes.
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/:00(?=\s?[AP]M)/i, "").replace(/:(\d{2})/, ".$1");
}

/**
 * Canonical 12-hour clock formatter for the ADMIN + shared surfaces.
 * Onra convention (client 2026-08): AM/PM, NO ":00" on whole hours, and
 * minutes shown with a DOT and only when non-zero.
 *   "17:00" → "5 PM" · "09:30" → "9.30 AM" · "00:15" → "12.15 AM" · "12:00" → "12 PM"
 * Mirrors the customer app's `to12h` (src/lib/customer/dates.ts) so both
 * apps read times the same way. Passes odd/empty input straight through.
 */
export function to12h(time: string): string {
  if (!time || !time.includes(":")) return time || "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = Number.isNaN(m) ? 0 : m;
  return mm === 0 ? `${h12} ${period}` : `${h12}.${String(mm).padStart(2, "0")} ${period}`;
}

/**
 * Same conversion as {@link to12h} but returns the clock and meridiem as
 * separate parts — for layouts that stack the AM/PM under the time
 * (e.g. the dashboard schedule timeline). "17:00" → { clock: "5", meridiem: "PM" };
 * "09:30" → { clock: "9.30", meridiem: "AM" }.
 */
export function to12hParts(time: string): { clock: string; meridiem: "AM" | "PM" } {
  if (!time || !time.includes(":")) return { clock: time || "", meridiem: "AM" };
  const [h, m] = time.split(":").map(Number);
  const meridiem: "AM" | "PM" = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = Number.isNaN(m) ? 0 : m;
  return { clock: mm === 0 ? `${h12}` : `${h12}.${String(mm).padStart(2, "0")}`, meridiem };
}

/**
 * Canonical 12-hour "start - end" range used for every `displayTime` string
 * (class schedules, appointments, forms). Collapses a shared meridiem onto the
 * end only — "17:00","18:00" → "5:00 - 6:00 PM"; a range that crosses noon/
 * midnight keeps both — "11:30","13:00" → "11:30 AM - 1:00 PM". Mirrors the
 * old inline `fmt12` collapse in the store so output is identical everywhere.
 */
export function formatTimeRange12(start: string, end: string): string {
  if (!start) return end ? to12h(end) : "";
  if (!end) return to12h(start);
  const sh = Number(start.split(":")[0]);
  const eh = Number(end.split(":")[0]);
  const sameMeridiem = (sh < 12) === (eh < 12);
  return sameMeridiem
    ? `${to12h(start).replace(/\s(AM|PM)$/, "")} - ${to12h(end)}`
    : `${to12h(start)} - ${to12h(end)}`;
}

export function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "active":
    case "completed":
      return "bg-green-50 text-green-600";
    case "pending":
    case "waitlist":
      return "bg-blue-50 text-blue-600";
    case "cancelled":
    case "no_show":
    case "inactive":
    case "expired":
      return "bg-red-50 text-red-600";
    case "late_cancelled":
      return "bg-amber-50 text-amber-600";
    case "attended":
      return "bg-emerald-50 text-emerald-600";
    default:
      return "bg-gray-100 text-gray-500";
  }
}
