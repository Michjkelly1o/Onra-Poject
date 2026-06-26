"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import {
    User,
    Mail,
    Phone,
    CreditCard,
    Gift,
    Copy,
    Check,
    Edit3,
    Save,
    Lock,
    Award,
    Star,
    Shield,
    Plus,
    ChevronRight,
} from "lucide-react";

export default function CustomerProfilePage() {
    const { users, walletTransactions, userPackages, userMemberships, packages, memberships, bookings, updateUser, giftCards, redeemGiftCard } = useDataStore();
    const currentUserId = "u-mem-3";
    const user = users.find(u => u.id === currentUserId);
    if (!user) return null;

    const myWallet = walletTransactions.filter(w => w.user_id === currentUserId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const myPackages = userPackages.filter(p => p.user_id === currentUserId);
    const myMemberships = userMemberships.filter(m => m.user_id === currentUserId);
    const myGiftCards = giftCards.filter(g => g.recipient_id === currentUserId && g.status === "active");

    // ── Editable Profile ──
    const [editing, setEditing] = useState(false);
    const [profileForm, setProfileForm] = useState({
        email: user.email,
        phone: user.phone || "+971 50 555 1234",
        emergency_contact: "Ahmed Al-Rashid (+971 55 999 8877)",
    });

    const handleSaveProfile = () => {
        updateUser(currentUserId, { email: profileForm.email, phone: profileForm.phone });
        setEditing(false);
    };

    // ── Referral Code ──
    const referralCode = "OLIVIA-FIT-2025";
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Gift Card Redeem ──
    const [giftCardCode, setGiftCardCode] = useState("");
    const [giftCardMsg, setGiftCardMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleRedeemGiftCard = () => {
        if (!giftCardCode.trim()) return;
        const result = redeemGiftCard(giftCardCode.trim(), currentUserId);
        if (result.success) {
            setGiftCardMsg({ type: "success", text: `AED ${result.amount} credited to your wallet!` });
            setGiftCardCode("");
        } else {
            setGiftCardMsg({ type: "error", text: result.error || "Invalid code" });
        }
        setTimeout(() => setGiftCardMsg(null), 4000);
    };

    // ── Level Progress ──
    const attendedCount = bookings.filter(b => b.user_id === currentUserId && b.status === "attended").length;
    const currentLevel = attendedCount >= 10 ? "Advanced" : attendedCount >= 5 ? "Intermediate" : "Beginner";
    const nextLevel = currentLevel === "Beginner" ? "Intermediate" : currentLevel === "Intermediate" ? "Advanced" : null;
    const progressTarget = currentLevel === "Beginner" ? 5 : currentLevel === "Intermediate" ? 10 : 10;
    const progressCurrent = currentLevel === "Beginner" ? attendedCount : currentLevel === "Intermediate" ? attendedCount - 5 : 5;
    const progressPercent = Math.min(100, (progressCurrent / (progressTarget - (currentLevel === "Beginner" ? 0 : currentLevel === "Intermediate" ? 5 : 5))) * 100);

    // ── Simulated payment methods ──
    const paymentMethods = [
        { id: "pm1", type: "visa", last4: "4242", expiry: "12/26", isDefault: true },
        { id: "pm2", type: "mastercard", last4: "8888", expiry: "03/27", isDefault: false },
    ];

    // Credit balance
    const latestBalance = myWallet.length > 0 ? myWallet[0].balance_after : 0;

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <span className="text-xl font-bold text-white">{user.first_name[0]}{user.last_name[0]}</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
                            <p className="text-sm text-gray-500">Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                                    currentLevel === "Advanced" ? "bg-purple-50 text-purple-600" :
                                        currentLevel === "Intermediate" ? "bg-blue-50 text-blue-600" :
                                            "bg-green-50 text-green-600"
                                )}>
                                    <Award className="w-3 h-3 inline mr-1" />{currentLevel}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => editing ? handleSaveProfile() : setEditing(true)}
                        className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            editing ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        {editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                        {editing ? (
                            <input
                                type="email"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                value={profileForm.email}
                                onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                            />
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-gray-900"><Mail className="w-4 h-4 text-gray-400" />{user.email}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                        {editing ? (
                            <input
                                type="tel"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                value={profileForm.phone}
                                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                            />
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-gray-900"><Phone className="w-4 h-4 text-gray-400" />{profileForm.phone}</p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Emergency Contact</label>
                        {editing ? (
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                value={profileForm.emergency_contact}
                                onChange={e => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                            />
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-gray-900"><Shield className="w-4 h-4 text-gray-400" />{profileForm.emergency_contact}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Level Progress */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-blue-500" /> Level Progress
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{currentLevel}</span>
                            {nextLevel && <span className="text-xs text-gray-400">→ {nextLevel}</span>}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${nextLevel ? progressPercent : 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            {nextLevel
                                ? `${attendedCount} classes attended · ${progressTarget - attendedCount} more to unlock ${nextLevel}`
                                : "Maximum level reached! 🎉"}
                        </p>
                    </div>
                </div>

                {/* Credit Balance */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" /> Credit Balance
                    </h3>
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-3xl font-bold text-gray-900">{latestBalance}</span>
                        <span className="text-sm text-gray-500">credits remaining</span>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                        {myWallet.slice(0, 5).map(w => (
                            <div key={w.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 truncate flex-1">{w.description}</span>
                                <span className={cn("font-medium ml-2", w.amount > 0 ? "text-green-600" : "text-red-500")}>
                                    {w.amount > 0 ? "+" : ""}{w.amount}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Referral Code */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-blue-500" /> Referral Program
                </h3>
                <p className="text-xs text-gray-500 mb-3">Share your code and both of you earn 2 bonus credits!</p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm font-mono font-semibold text-blue-700 tracking-wider">
                        {referralCode}
                    </code>
                    <button
                        onClick={handleCopy}
                        className={cn("px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5",
                            copied ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                    >
                        {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Methods */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-500" /> Payment Methods
                    </h3>
                    <div className="space-y-3">
                        {paymentMethods.map(pm => (
                            <div key={pm.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-7 rounded bg-gradient-to-r from-gray-700 to-gray-900 flex items-center justify-center">
                                        <CreditCard className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 capitalize">{pm.type} ···· {pm.last4}</p>
                                        <p className="text-xs text-gray-400">Expires {pm.expiry}</p>
                                    </div>
                                </div>
                                {pm.isDefault && (
                                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Default</span>
                                )}
                            </div>
                        ))}
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                            <Plus className="w-4 h-4" />
                            Add Payment Method
                        </button>
                    </div>
                </div>

                {/* Gift Cards */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-[#876567]" /> Gift Cards
                    </h3>

                    {/* Active gift cards */}
                    {myGiftCards.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {myGiftCards.map(gc => (
                                <div key={gc.id} className="flex items-center justify-between px-3 py-2.5 bg-purple-50 rounded-xl">
                                    <div>
                                        <p className="text-sm font-medium text-purple-900">{gc.code}</p>
                                        <p className="text-xs text-purple-600">Balance: AED {gc.balance}</p>
                                    </div>
                                    <span className="text-[10px] text-purple-500">Exp: {new Date(gc.expires_at).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Redeem input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter gift card code..."
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                            value={giftCardCode}
                            onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                        />
                        <button
                            onClick={handleRedeemGiftCard}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                        >
                            Redeem
                        </button>
                    </div>
                    {giftCardMsg && (
                        <p className={cn("text-xs mt-2 font-medium", giftCardMsg.type === "success" ? "text-green-600" : "text-red-600")}>
                            {giftCardMsg.text}
                        </p>
                    )}
                </div>
            </div>

            {/* Active Packages & Memberships */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Active Plans</h3>
                <div className="space-y-3">
                    {myPackages.map(up => {
                        const pkg = packages.find(p => p.id === up.package_id);
                        return (
                            <div key={up.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{pkg?.name || "Package"}</p>
                                    <p className="text-xs text-gray-500">
                                        {up.credits_remaining}/{up.credits_total} credits · Exp: {new Date(up.expires_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                                    up.status === "active" ? "bg-green-50 text-green-600" :
                                        up.status === "frozen" ? "bg-blue-50 text-blue-600" :
                                            "bg-gray-100 text-gray-500"
                                )}>
                                    {up.status}
                                </span>
                            </div>
                        );
                    })}
                    {myMemberships.map(um => {
                        const mem = memberships.find(m => m.id === um.membership_id);
                        return (
                            <div key={um.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{mem?.name || "Membership"}</p>
                                    <p className="text-xs text-gray-500">
                                        Next billing: {um.end_date ? new Date(um.end_date).toLocaleDateString() : "N/A"}
                                    </p>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600">
                                    {um.status}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
