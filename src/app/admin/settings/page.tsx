"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { NumericInput, NumericStringInput } from "@/components/ui/NumericInput";
import { Building2, Clock, Globe, Mail, MapPin, Phone, Plus, Save, Trash2, X, Users } from "lucide-react";

export default function SettingsPage() {
    const { studio, rooms, users, updateStudio, addRoom, deleteRoom, toggleRoom, addAdmin, removeAdmin } = useDataStore();
    const [studioForm, setStudioForm] = useState(studio);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [roomForm, setRoomForm] = useState({ name: "", capacity: "" });
    const [adminForm, setAdminForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        isSuperAdmin: false
    });

    const handleSaveStudio = () => {
        updateStudio(studioForm);
        alert("Studio settings saved!");
    };

    const handleAddRoom = (e: React.FormEvent) => {
        e.preventDefault();
        addRoom({
            studio_id: studio.id,
            name: roomForm.name,
            capacity: parseInt(roomForm.capacity),
            is_active: true
        });
        setShowRoomModal(false);
        setRoomForm({ name: "", capacity: "" });
    };

    const handleDeleteRoom = (id: string) => {
        if (confirm("Are you sure you want to delete this room?")) {
            deleteRoom(id);
        }
    };

    const handleAddAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        addAdmin({
            studio_id: studio.id,
            first_name: adminForm.first_name,
            last_name: adminForm.last_name,
            email: adminForm.email,
            phone: "",
            waiver_signed: true,
            is_active: true,
            role: "admin",
            permissions: adminForm.isSuperAdmin ? ["all"] : ["manage_schedule", "manage_bookings"]
        });
        setShowAdminModal(false);
        setAdminForm({ first_name: "", last_name: "", email: "", isSuperAdmin: false });
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Manage studio profile, rooms, and booking rules</p>
            </div>

            {/* Studio Profile */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-brand-50">
                        <Building2 className="w-5 h-5 text-brand-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Studio Profile</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Studio Name</label>
                        <input
                            type="text"
                            value={studioForm.name}
                            onChange={(e) => setStudioForm({ ...studioForm, name: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
                        <input type="text" value={studioForm.slug} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-gray-50" readOnly />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <MapPin className="w-3.5 h-3.5 inline mr-1" />Address
                        </label>
                        <input
                            type="text"
                            value={studioForm.address}
                            onChange={(e) => setStudioForm({ ...studioForm, address: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <Phone className="w-3.5 h-3.5 inline mr-1" />Phone
                        </label>
                        <input
                            type="text"
                            value={studioForm.phone}
                            onChange={(e) => setStudioForm({ ...studioForm, phone: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <Mail className="w-3.5 h-3.5 inline mr-1" />Email
                        </label>
                        <input
                            type="text"
                            value={studioForm.email}
                            onChange={(e) => setStudioForm({ ...studioForm, email: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <Globe className="w-3.5 h-3.5 inline mr-1" />Timezone
                        </label>
                        <input
                            type="text"
                            value={studioForm.timezone}
                            onChange={(e) => setStudioForm({ ...studioForm, timezone: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        />
                    </div>
                </div>
            </div>

            {/* Branding Settings */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-purple-50">
                        <Globe className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Branding</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Studio Logo</label>
                        <div className="flex gap-4 items-start">
                            {/* Preview */}
                            <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {studioForm.logo_url ? (
                                    <img src={studioForm.logo_url} alt="Logo Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-gray-400">No Logo</span>
                                )}
                            </div>

                            <div className="flex-1">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="p-2 rounded-full bg-gray-100 mb-2">
                                            <Plus className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="mb-1 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-gray-500">SVG, PNG, JPG (MAX. 800x400px)</p>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setStudioForm({ ...studioForm, logo_url: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                                {studioForm.logo_url && (
                                    <button
                                        onClick={() => setStudioForm({ ...studioForm, logo_url: "" })}
                                        className="mt-2 text-xs text-red-500 hover:text-red-600 font-medium"
                                    >
                                        Remove Logo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSaveStudio}
                        className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                </div>
            </div>

            {/* Booking Rules */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-amber-50">
                        <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Booking Rules</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Cancellation Window (hours)</label>
                        <NumericInput
                            value={studioForm.cancellation_window_hours ?? 0}
                            onChange={n => setStudioForm({ ...studioForm, cancellation_window_hours: n })}
                            min={0}
                            suffix="hours"
                            className="rounded-xl"
                            inputClassName="text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">Credits are forfeited if cancelled within this window</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Booking Window (days ahead)</label>
                        <NumericInput
                            value={studioForm.booking_window_days ?? 0}
                            onChange={n => setStudioForm({ ...studioForm, booking_window_days: n })}
                            min={0}
                            suffix="days"
                            className="rounded-xl"
                            inputClassName="text-sm"
                        />
                        <p className="text-xs text-gray-400 mt-1">How far in advance members can book classes</p>
                    </div>
                </div>
            </div>

            {/* Rooms */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-50">
                            <MapPin className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h2 className="font-semibold text-gray-900">Rooms</h2>
                    </div>
                    <button
                        onClick={() => setShowRoomModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-xl font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Room
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Name</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Capacity</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Status</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rooms.map((room) => (
                                <tr key={room.id} className="table-row-hover border-b border-gray-50 group">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{room.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{room.capacity} people</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => toggleRoom(room.id)}
                                            className={cn("text-xs px-2 py-0.5 rounded-full font-medium transition-colors", room.is_active ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                        >
                                            {room.is_active ? "Active" : "Inactive"}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteRoom(room.id)}
                                            className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Team Management - Super Admin Only */}
            {
                useAppStore.getState().currentUser.permissions?.includes("all") && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-50">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <h2 className="font-semibold text-gray-900">Team Management</h2>
                            </div>
                            <button
                                onClick={() => setShowAdminModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-xl font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add Member
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Name</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Role</th>
                                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">Status</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter(u => u.role === "admin").map((admin) => (
                                        <tr key={admin.id} className="table-row-hover border-b border-gray-50 group">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{admin.first_name} {admin.last_name}</span>
                                                    <span className="text-xs text-gray-500">{admin.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    "text-xs px-2 py-1 rounded-full font-medium",
                                                    admin.permissions?.includes("all")
                                                        ? "bg-purple-50 text-purple-700"
                                                        : "bg-blue-50 text-blue-700"
                                                )}>
                                                    {admin.permissions?.includes("all") ? "Super Admin" : "Admin"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {/* Prevent deleting yourself or the main demo admin if desired */}
                                                {admin.id !== "u-admin-1" && (
                                                    <button
                                                        onClick={() => {
                                                            if (confirm("Remove this admin?")) {
                                                                removeAdmin(admin.id);
                                                            }
                                                        }}
                                                        className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Add Room Modal */}
            {
                showRoomModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl animate-scale-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-gray-900">Add Room</h2>
                                <button onClick={() => setShowRoomModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                            <form onSubmit={handleAddRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Room Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={roomForm.name}
                                        onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity</label>
                                    <NumericStringInput
                                        required
                                        value={roomForm.capacity}
                                        onChange={v => setRoomForm({ ...roomForm, capacity: v })}
                                        min={0}
                                        className="rounded-xl"
                                        inputClassName="text-sm"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowRoomModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">Add Room</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Add Admin Modal */}
            {
                showAdminModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-scale-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-gray-900">Add Team Member</h2>
                                <button onClick={() => setShowAdminModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                            <form onSubmit={handleAddAdmin} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={adminForm.first_name}
                                            onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={adminForm.last_name}
                                            onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={adminForm.email}
                                        onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Role & Permissions</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <label className={cn(
                                            "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                            adminForm.isSuperAdmin
                                                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                                                : "border-gray-200 hover:border-brand-200"
                                        )}>
                                            <div className="pt-0.5">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    checked={adminForm.isSuperAdmin}
                                                    onChange={() => setAdminForm({ ...adminForm, isSuperAdmin: true })}
                                                    className="text-brand-600 focus:ring-brand-500"
                                                />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-medium text-gray-900">Super Admin</span>
                                                <span className="block text-xs text-gray-500 mt-0.5">Full access to all settings, billing, and team management.</span>
                                            </div>
                                        </label>

                                        <label className={cn(
                                            "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                            !adminForm.isSuperAdmin
                                                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                                                : "border-gray-200 hover:border-brand-200"
                                        )}>
                                            <div className="pt-0.5">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    checked={!adminForm.isSuperAdmin}
                                                    onChange={() => setAdminForm({ ...adminForm, isSuperAdmin: false })}
                                                    className="text-brand-600 focus:ring-brand-500"
                                                />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-medium text-gray-900">Admin</span>
                                                <span className="block text-xs text-gray-500 mt-0.5">Can manage classes, bookings, and members. Limited access to settings.</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowAdminModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">Add Member</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
