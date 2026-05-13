"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, getInitials } from "@/lib/utils";
import { Plus, Mail, Phone, Calendar, DollarSign, Trash2, X } from "lucide-react";

export default function InstructorsPage() {
    const { users, classInstances, addUser, deleteUser } = useDataStore();
    const instructors = users.filter((u) => u.role === "instructor");

    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
    });

    const getInstructorStats = (instructorId: string) => {
        const classes = classInstances.filter((c) => c.instructor_id === instructorId);
        const totalAttendees = classes.reduce((sum, c) => sum + c.booked_count, 0);
        return { classCount: classes.length, totalAttendees };
    };

    const handleAddInstructor = (e: React.FormEvent) => {
        e.preventDefault();
        addUser({
            studio_id: "s1",
            role: "instructor",
            ...formData,
            is_active: true,
            waiver_signed: true,
            avatar_url: ""
        });
        setShowAddModal(false);
        setFormData({ first_name: "", last_name: "", email: "", phone: "" });
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Are you sure you want to delete instructor ${name}?`)) {
            deleteUser(id);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
                    <p className="text-sm text-gray-500 mt-1">{instructors.length} instructors</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                >
                    <Plus className="w-4 h-4" />
                    Add Instructor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {instructors.map((inst) => {
                    const stats = getInstructorStats(inst.id);
                    return (
                        <div key={inst.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift group relative">
                            {/* Delete Button */}
                            <button
                                onClick={() => handleDelete(inst.id, `${inst.first_name} ${inst.last_name}`)}
                                className="absolute top-4 right-4 p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl gradient-bg-brand flex items-center justify-center">
                                    <span className="text-white font-bold">{getInitials(inst.first_name, inst.last_name)}</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{inst.first_name} {inst.last_name}</h3>
                                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", inst.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500")}>
                                        {inst.is_active ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                    {inst.email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                    {inst.phone}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{stats.classCount}</p>
                                    <p className="text-xs text-gray-500">Classes/wk</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                                        <DollarSign className="w-3.5 h-3.5" />
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{stats.totalAttendees}</p>
                                    <p className="text-xs text-gray-500">Attendees</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Instructor Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Add New Instructor</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleAddInstructor} className="space-y-4">
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
                                <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">Create Instructor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
