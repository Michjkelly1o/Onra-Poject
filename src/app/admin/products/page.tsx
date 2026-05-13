"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, formatCurrency } from "@/lib/utils";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { Plus, CreditCard, Clock, Users, X, Trash2 } from "lucide-react";

export default function ProductsPage() {
    const { packages, memberships, addPackage, addMembership } = useDataStore();
    const [tab, setTab] = useState<"packages" | "memberships">("packages");
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [productType, setProductType] = useState<"package" | "membership">("package");
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        credits: "",
        validity: "",
        interval: "month",
        max_bookings: ""
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (productType === "package") {
            addPackage({
                studio_id: "s1",
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                credit_count: parseInt(formData.credits),
                validity_days: parseInt(formData.validity),
                class_type_ids: [], // ALL by default
                is_active: true
            });
        } else {
            addMembership({
                studio_id: "s1",
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                billing_period: formData.interval as "monthly" | "quarterly" | "annual",
                max_bookings_per_period: formData.max_bookings ? parseInt(formData.max_bookings) : undefined,
                class_type_ids: [],
                is_active: true
            });
        }
        setShowForm(false);
        setFormData({ name: "", description: "", price: "", credits: "", validity: "", interval: "month", max_bookings: "" });
    };

    const handleDelete = (id: string, type: "package" | "membership") => {
        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            alert(`${type} deleted (demo mode)`);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your packages and memberships</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                >
                    <Plus className="w-4 h-4" />
                    Add Product
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setTab("packages")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", tab === "packages" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
                >
                    Packages ({packages.length})
                </button>
                <button
                    onClick={() => setTab("memberships")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", tab === "memberships" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
                >
                    Memberships ({memberships.length})
                </button>
            </div>

            {/* Packages */}
            {tab === "packages" && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {packages.map((pkg) => (
                        <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift group relative">
                            <button
                                onClick={() => handleDelete(pkg.id, "package")}
                                className="absolute top-4 right-4 p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                                </div>
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", pkg.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500")}>
                                    {pkg.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>

                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-2xl font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                                <span className="text-sm text-gray-400">AED</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                    <CreditCard className="w-4 h-4 text-brand-500" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{pkg.credit_count}</p>
                                        <p className="text-[10px] text-gray-500">Credits</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{pkg.validity_days}d</p>
                                        <p className="text-[10px] text-gray-500">Validity</p>
                                    </div>
                                </div>
                            </div>

                            {pkg.class_type_ids.length > 0 && (
                                <p className="text-xs text-gray-400 mt-3">Restricted to specific class types</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Memberships */}
            {tab === "memberships" && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {memberships.map((mem) => (
                        <div key={mem.id} className="bg-white rounded-2xl border border-purple-100 shadow-soft p-5 hover-lift relative overflow-hidden group">
                            <button
                                onClick={() => handleDelete(mem.id, "membership")}
                                className="absolute top-4 right-4 p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-brand-500" />
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{mem.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{mem.description}</p>
                                </div>
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", mem.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500")}>
                                    {mem.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>

                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-2xl font-bold text-gray-900">{formatCurrency(mem.price)}</span>
                                <span className="text-sm text-gray-400">/ {mem.billing_period}</span>
                            </div>

                            <div className="flex items-center gap-2 bg-purple-50 rounded-lg p-2.5">
                                <Users className="w-4 h-4 text-purple-500" />
                                <span className="text-sm text-purple-700">
                                    {mem.max_bookings_per_period ? `${mem.max_bookings_per_period} bookings/${mem.billing_period}` : "Unlimited bookings"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Product Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Add Product</h2>
                            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Type</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    value={productType}
                                    onChange={(e) => setProductType(e.target.value as "package" | "membership")}
                                >
                                    <option value="package">Package</option>
                                    <option value="membership">Membership</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder={productType === "package" ? "e.g. 10-Class Pack" : "e.g. Unlimited Monthly"}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <input
                                    type="text"
                                    placeholder="Brief description"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (AED)</label>
                                    <NumericStringInput
                                        required
                                        value={formData.price}
                                        onChange={v => setFormData({ ...formData, price: v })}
                                        min={0}
                                        step={0.01}
                                        className="rounded-xl"
                                        inputClassName="text-sm"
                                    />
                                </div>
                                {productType === "package" ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Credits</label>
                                        <NumericStringInput
                                            required
                                            value={formData.credits}
                                            onChange={v => setFormData({ ...formData, credits: v })}
                                            min={0}
                                            className="rounded-xl"
                                            inputClassName="text-sm"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Period</label>
                                        <select
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                            value={formData.interval}
                                            onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="quarterly">Quarterly</option>
                                            <option value="annual">Yearly</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {productType === "package" ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Validity (days)</label>
                                    <NumericStringInput
                                        required
                                        value={formData.validity}
                                        onChange={v => setFormData({ ...formData, validity: v })}
                                        min={0}
                                        suffix="days"
                                        className="rounded-xl"
                                        inputClassName="text-sm"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Bookings / Period (leave empty for unlimited)</label>
                                    <NumericStringInput
                                        value={formData.max_bookings}
                                        onChange={v => setFormData({ ...formData, max_bookings: v })}
                                        min={0}
                                        className="rounded-xl"
                                        inputClassName="text-sm"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                                    Create {productType === "package" ? "Package" : "Membership"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
