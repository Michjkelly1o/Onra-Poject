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
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
