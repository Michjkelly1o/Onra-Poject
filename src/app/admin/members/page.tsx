"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, getInitials, formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { TableAvatar } from "@/components/ui/avatar";
import { Search, Plus, X, Mail, Phone, CheckCircle, AlertCircle, ChevronRight, Trash2 } from "lucide-react";

export default function MembersPage() {
    const { users, userPackages, userMemberships, bookings, walletTransactions, packages, memberships, addUser, deleteUser } = useDataStore();
    const members = users.filter(u => u.role === 'member');

    const [search, setSearch] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
    });

    const filteredMembers = members.filter((m) =>
        `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    );

    const selectedMember = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null;
    const memberPackages = selectedMemberId ? userPackages.filter((p) => p.user_id === selectedMemberId) : [];
    const memberMemberships = selectedMemberId ? userMemberships.filter((m) => m.user_id === selectedMemberId) : [];
    const memberBookings = selectedMemberId ? bookings.filter((b) => b.user_id === selectedMemberId) : [];
    const memberWallet = selectedMemberId ? walletTransactions.filter((w) => w.user_id === selectedMemberId) : [];

    const getCreditBalance = (userId: string) => {
        const ups = userPackages.filter((p) => p.user_id === userId && p.status === "active");
        return ups.reduce((sum, p) => sum + p.credits_remaining, 0);
    };

    const getMembershipName = (userId: string) => {
        const um = userMemberships.find((m) => m.user_id === userId && m.status === "active");
        if (!um) return null;
        const mem = memberships.find((m) => m.id === um.membership_id);
        return mem?.name || null;
    };

    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        addUser({
            studio_id: "s1",
            role: "member",
            ...formData,
            is_active: true,
            waiver_signed: false,
            avatar_url: ""
        });
        setShowAddModal(false);
        setFormData({ first_name: "", last_name: "", email: "", phone: "" });
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this member?")) {
            deleteUser(id);
            setSelectedMemberId(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Members</h1>
                    <p className="text-sm text-gray-500 mt-1">{members.length} total members</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                >
                    <Plus className="w-4 h-4" />
                    Add Member
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Member</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Contact</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Package / Membership</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Credits</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((member) => {
                                const credits = getCreditBalance(member.id);
                                const membershipName = getMembershipName(member.id);
                                return (
                                    <tr
                                        key={member.id}
                                        onClick={() => setSelectedMemberId(member.id)}
                                        className="table-row-hover border-b border-gray-50 cursor-pointer"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <TableAvatar initials={getInitials(member.first_name, member.last_name)} size={36} />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                                                    <p className="text-xs text-gray-500">Joined {formatDate(member.created_at)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-gray-600">{member.email}</p>
                                            <p className="text-xs text-gray-400">{member.phone}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {membershipName ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">{membershipName}</span>
                                            ) : credits > 0 ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">Credit Pack</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">None</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm font-semibold text-gray-900">{credits}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", member.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500")}>
                                                {member.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member Profile Slide-over */}
            {selectedMember && (
                <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-gray-100 z-50 animate-slide-in-right overflow-y-auto">
                    <div className="p-6 pb-24">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold text-lg text-gray-900">Member Profile</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDelete(selectedMember.id)}
                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setSelectedMemberId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* Profile Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl gradient-bg-brand flex items-center justify-center">
                                <span className="text-white text-lg font-bold">{getInitials(selectedMember.first_name, selectedMember.last_name)}</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedMember.first_name} {selectedMember.last_name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1 text-xs text-gray-500"><Mail className="w-3 h-3" />{selectedMember.email}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><Phone className="w-3 h-3" />{selectedMember.phone}</div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-gray-900">{getCreditBalance(selectedMember.id)}</p>
                                <p className="text-xs text-gray-500">Credits</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-gray-900">{memberBookings.length}</p>
                                <p className="text-xs text-gray-500">Bookings</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="flex items-center justify-center">
                                    {selectedMember.waiver_signed ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-amber-500" />
                                    )}
                                </div>
                                <p className="text-xs text-gray-500">Waiver</p>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        {selectedMember.emergency_contact_name && (
                            <div className="bg-amber-50 rounded-xl p-3 mb-6 border border-amber-100">
                                <p className="text-xs font-semibold text-amber-700 mb-1">Emergency Contact</p>
                                <p className="text-sm text-amber-800">{selectedMember.emergency_contact_name} • {selectedMember.emergency_contact_phone}</p>
                            </div>
                        )}

                        {/* Active Packages */}
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Packages</h4>
                            {memberPackages.length > 0 ? (
                                <div className="space-y-2">
                                    {memberPackages.map((up) => {
                                        const pkg = packages.find((p) => p.id === up.package_id);
                                        return (
                                            <div key={up.id} className="bg-gray-50 rounded-xl p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-900">{pkg?.name}</span>
                                                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(up.status))}>
                                                        {up.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>{up.credits_remaining}/{up.credits_total} credits left</span>
                                                    <span>Expires {formatDate(up.expires_at || "")}</span>
                                                </div>
                                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                                    <div
                                                        className="h-1.5 rounded-full bg-brand-500"
                                                        style={{ width: `${(up.credits_remaining / up.credits_total) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">No packages</p>
                            )}
                        </div>

                        {/* Memberships */}
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Memberships</h4>
                            {memberMemberships.length > 0 ? (
                                <div className="space-y-2">
                                    {memberMemberships.map((um) => {
                                        const mem = memberships.find((m) => m.id === um.membership_id);
                                        return (
                                            <div key={um.id} className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-purple-900">{mem?.name}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">{um.status}</span>
                                                </div>
                                                <p className="text-xs text-purple-600 mt-1">Since {formatDate(um.start_date)} • {formatCurrency(mem?.price || 0)}/{mem?.billing_period}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">No memberships</p>
                            )}
                        </div>

                        {/* Recent Bookings */}
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Bookings</h4>
                            {memberBookings.length > 0 ? (
                                <div className="space-y-2">
                                    {memberBookings.slice(0, 5).map((b) => (
                                        <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                                            <div>
                                                <p className="text-sm text-gray-900">{b.class_instance?.class_type?.name}</p>
                                                <p className="text-xs text-gray-500">{formatDate(b.booked_at)}</p>
                                            </div>
                                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(b.status))}>
                                                {b.status.replace("_", " ")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">No bookings yet</p>
                            )}
                        </div>

                        {/* Wallet Transactions */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Wallet History</h4>
                            {memberWallet.length > 0 ? (
                                <div className="space-y-2">
                                    {memberWallet.map((wt) => (
                                        <div key={wt.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                                            <div>
                                                <p className="text-sm text-gray-700">{wt.description}</p>
                                                <p className="text-xs text-gray-400">{formatDate(wt.created_at)}</p>
                                            </div>
                                            <span className={cn("text-sm font-semibold", wt.amount > 0 ? "text-green-600" : "text-red-500")}>
                                                {wt.amount > 0 ? "+" : ""}{wt.amount}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">No wallet transactions</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Add New Member</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">Create Member</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
