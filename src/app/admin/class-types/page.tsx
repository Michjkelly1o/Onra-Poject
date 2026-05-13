"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { Plus, Clock, Users, MapPin, Pencil, X, Layers, Trash2, Signal } from "lucide-react";
import type { DifficultyLevel } from "@/types";

export default function ClassTypesPage() {
    const { classTypes, rooms, addClassType, deleteClassType, updateClassType } = useDataStore();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        default_duration_min: 50,
        default_capacity: 10,
        default_room_id: "",
        color: "#6c47ff",
        equipment_notes: "",
        difficulty_level: "all_levels" as DifficultyLevel
    });

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            default_duration_min: 50,
            default_capacity: 10,
            default_room_id: "",
            color: "#6c47ff",
            equipment_notes: "",
            difficulty_level: "all_levels"
        });
        setEditingId(null);
    };

    const handleEdit = (ct: typeof classTypes[0]) => {
        setFormData({
            name: ct.name,
            description: ct.description,
            default_duration_min: ct.default_duration_min,
            default_capacity: ct.default_capacity,
            default_room_id: ct.default_room_id || "",
            color: ct.color,
            equipment_notes: ct.equipment_notes || "",
            difficulty_level: ct.difficulty_level || "all_levels"
        });
        setEditingId(ct.id);
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            updateClassType(editingId, { ...formData });
        } else {
            addClassType({
                ...formData,
                studio_id: "s1",
                is_active: true
            });
        }
        setShowForm(false);
        resetForm();
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this class type?")) {
            deleteClassType(id);
        }
    };

    const getLevelBadgeColor = (level: string) => {
        switch (level) {
            case "beginner": return "bg-green-50 text-green-700 border-green-100";
            case "intermediate": return "bg-yellow-50 text-yellow-700 border-yellow-100";
            case "advanced": return "bg-red-50 text-red-700 border-red-100";
            default: return "bg-blue-50 text-blue-700 border-blue-100";
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Class Types</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage your class type templates. These are reused when scheduling classes.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                >
                    <Plus className="w-4 h-4" />
                    New Class Type
                </button>
            </div>

            {/* Class Type Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {classTypes.map((ct) => {
                    const room = rooms.find((r) => r.id === ct.default_room_id);
                    return (
                        <div
                            key={ct.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-soft hover-lift overflow-hidden group"
                        >
                            {/* Color Bar */}
                            <div className="h-1.5" style={{ backgroundColor: ct.color }} />
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: `${ct.color}15` }}
                                        >
                                            <Layers className="w-5 h-5" style={{ color: ct.color }} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{ct.name}</h3>
                                            <div className="flex gap-2 mt-1">
                                                <span
                                                    className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium border uppercase tracking-wider",
                                                        getLevelBadgeColor(ct.difficulty_level)
                                                    )}
                                                >
                                                    {ct.difficulty_level?.replace("_", " ")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(ct)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(ct.id)}
                                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                                    {ct.description}
                                </p>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        {ct.default_duration_min} min
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <Users className="w-3.5 h-3.5 text-gray-400" />
                                        {ct.default_capacity} max
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        {room?.name || "Any"}
                                    </div>
                                </div>

                                {ct.equipment_notes && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-400">
                                            Equipment: {ct.equipment_notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingId ? "Edit Class Type" : "Create Class Type"}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Reformer Pilates"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty Level</label>
                                    <select
                                        value={formData.difficulty_level}
                                        onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value as DifficultyLevel })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    >
                                        <option value="all_levels">All Levels</option>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>

                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Room</label>
                                    <select
                                        value={formData.default_room_id}
                                        onChange={(e) => setFormData({ ...formData, default_room_id: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    >
                                        <option value="">Any room</option>
                                        {rooms.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (min)</label>
                                    <input
                                        type="number"
                                        value={formData.default_duration_min}
                                        onChange={(e) => setFormData({ ...formData, default_duration_min: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity</label>
                                    <input
                                        type="number"
                                        value={formData.default_capacity}
                                        onChange={(e) => setFormData({ ...formData, default_capacity: Number(e.target.value) })}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full h-[42px] border border-gray-200 rounded-xl cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipment Notes</label>
                                    <input
                                        type="text"
                                        value={formData.equipment_notes}
                                        onChange={(e) => setFormData({ ...formData, equipment_notes: e.target.value })}
                                        placeholder="e.g. Reformer machine"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the class type..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                                    {editingId ? "Save Changes" : "Create Class Type"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
