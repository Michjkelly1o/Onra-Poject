"use client";

import { useDataStore } from "@/lib/data-store";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, Clock, ShoppingBag, Crown, ArrowRight, Snowflake, Play } from "lucide-react";
import { useState } from "react";
import { TaxSuffix } from "@/components/ui/TaxSuffix";

export default function CustomerPackagesPage() {
    const { packages, memberships, userPackages, userMemberships, purchasePackage, purchaseMembership, freezePackage, unfreezePackage } = useDataStore();
    const [freezingId, setFreezingId] = useState<string | null>(null);
    const [freezeDays, setFreezeDays] = useState(7);

    // For member Olivia Martinez (u-mem-3)
    const currentUserId = "u-mem-3";
    const myPackages = userPackages.filter((p) => p.user_id === currentUserId);
    const myMemberships = userMemberships.filter((m) => m.user_id === currentUserId);

    const handlePurchasePackage = (pkg: any) => {
        if (confirm(`Purchase ${pkg.name} for ${formatCurrency(pkg.price)}?`)) {
            purchasePackage(currentUserId, pkg.id);
            alert("Package purchased successfully!");
        }
    };

    const handleSubscribeMembership = (mem: any) => {
        if (confirm(`Subscribe to ${mem.name} for ${formatCurrency(mem.price)}/${mem.billing_period}?`)) {
            purchaseMembership(currentUserId, mem.id);
            alert("Membership subscribed successfully!");
        }
    };

    const handleFreeze = (pkgId: string) => {
        freezePackage(pkgId, freezeDays);
        setFreezingId(null);
        alert(`Package frozen for ${freezeDays} days. Expiry extended accordingly.`);
    };

    const handleUnfreeze = (pkgId: string) => {
        unfreezePackage(pkgId);
        alert("Package unfrozen! You can book classes again.");
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Packages & Memberships</h1>
                <p className="text-sm text-gray-500 mt-1">View your active plans and purchase new ones</p>
            </div>

            {/* Active Plans */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myPackages.map((up) => {
                        const pkg = packages.find((p) => p.id === up.package_id);
                        const pct = (up.credits_remaining / up.credits_total) * 100;
                        return (
                            <div key={up.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{pkg?.name}</h3>
                                            <p className="text-xs text-gray-500">Purchased {formatDate(up.purchased_at)}</p>
                                        </div>
                                    </div>
                                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                                        up.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                                    )}>
                                        {up.status}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">{up.credits_remaining} of {up.credits_total} credits remaining</span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />Expires {formatDate(up.expires_at)}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                    <div
                                        className={cn("h-2.5 rounded-full transition-all duration-700",
                                            up.status === "frozen" ? "bg-blue-400" : pct > 50 ? "bg-blue-500" : pct > 25 ? "bg-amber-500" : "bg-red-500"
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>

                                {/* Freeze/Unfreeze Actions */}
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    {up.status === "frozen" ? (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-blue-600 flex items-center gap-1">
                                                <Snowflake className="w-3 h-3" />
                                                Frozen until {up.frozen_until ? formatDate(up.frozen_until) : "—"}
                                            </p>
                                            <button
                                                onClick={() => handleUnfreeze(up.id)}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center gap-1"
                                            >
                                                <Play className="w-3 h-3" /> Unfreeze
                                            </button>
                                        </div>
                                    ) : up.status === "active" ? (
                                        <div>
                                            {freezingId === up.id ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={freezeDays}
                                                        onChange={(e) => setFreezeDays(Number(e.target.value))}
                                                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                                                    >
                                                        <option value={7}>7 days</option>
                                                        <option value={14}>14 days</option>
                                                        <option value={30}>30 days</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleFreeze(up.id)}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setFreezingId(null)}
                                                        className="px-3 py-1.5 text-gray-400 text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setFreezingId(up.id)}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                                                >
                                                    <Snowflake className="w-3 h-3" /> Freeze Package
                                                </button>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    {myMemberships.map((um) => {
                        const mem = memberships.find((m) => m.id === um.membership_id);
                        return (
                            <div key={um.id} className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-5 hover-lift">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                            <Crown className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{mem?.name}</h3>
                                            <p className="text-xs text-purple-600">Since {formatDate(um.start_date)} • Auto-renews {um.auto_renew ? "ON" : "OFF"}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-700">{um.status}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">{formatCurrency(mem?.price || 0)} / {mem?.billing_period} • {mem?.max_bookings_per_period ? `${mem.max_bookings_per_period} classes` : "Unlimited classes"}</p>
                            </div>
                        );
                    })}
                    {myPackages.length === 0 && myMemberships.length === 0 && (
                        <div className="col-span-full bg-white rounded-2xl border border-gray-100 shadow-soft p-8 text-center">
                            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No active plans</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Buy Packages */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Packages</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {packages.filter((p) => p.is_active).map((pkg) => (
                        <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift">
                            <h3 className="font-semibold text-gray-900 mb-1">{pkg.name}</h3>
                            <p className="text-xs text-gray-500 mb-4">{pkg.description}</p>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-2xl font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                                <span className="text-sm text-gray-400">AED</span>
                            </div>
                            <div className="mb-3"><TaxSuffix category="credit_package" /></div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                                <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />{pkg.credit_count} credits</span>
                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{pkg.validity_days} days</span>
                            </div>
                            <button
                                onClick={() => handlePurchasePackage(pkg)}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Purchase <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Memberships */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Membership Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {memberships.filter((m) => m.is_active).map((mem) => (
                        <div key={mem.id} className="bg-white rounded-2xl border border-purple-100 shadow-soft p-5 hover-lift relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-indigo-500" />
                            <h3 className="font-semibold text-gray-900 mb-1">{mem.name}</h3>
                            <p className="text-xs text-gray-500 mb-4">{mem.description}</p>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className="text-2xl font-bold text-gray-900">{formatCurrency(mem.price)}</span>
                                <span className="text-sm text-gray-400">/ {mem.billing_period}</span>
                            </div>
                            <div className="mb-3"><TaxSuffix category="membership" /></div>
                            <p className="text-xs text-purple-600 mb-4">{mem.max_bookings_per_period ? `Up to ${mem.max_bookings_per_period} classes per ${mem.billing_period}` : "Unlimited classes"}</p>
                            <button
                                onClick={() => handleSubscribeMembership(mem)}
                                className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                            >
                                Subscribe <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
