"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, Search, Filter, AlertTriangle, Package, Edit, Trash2, X, ShoppingBag, ArrowUpDown, ClipboardList } from "lucide-react";
import { Product } from "@/types";

const ADJUSTMENT_REASONS = [
    "Received Shipment",
    "Return from Customer",
    "Damaged / Write-off",
    "Count Correction",
    "Sold (Manual)",
    "Internal Use",
    "Other",
] as const;

type AdjustmentLog = {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    reason: string;
    notes: string;
    timestamp: string;
};

export default function InventoryPage() {
    const { products, addProduct, updateProduct, deleteProduct } = useDataStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [adjustProductId, setAdjustProductId] = useState<string | null>(null);
    const [adjustQty, setAdjustQty] = useState("");
    const [adjustReason, setAdjustReason] = useState<string>(ADJUSTMENT_REASONS[0]);
    const [adjustNotes, setAdjustNotes] = useState("");
    const [adjustmentLogs, setAdjustmentLogs] = useState<AdjustmentLog[]>([]);
    const [showLogPanel, setShowLogPanel] = useState(false);

    // Form State
    const initialFormState = {
        name: "",
        description: "",
        price: "",
        cost_price: "",
        stock_quantity: "",
        low_stock_threshold: "10",
        category: "apparel" as Product["category"]
    };
    const [formData, setFormData] = useState(initialFormState);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === "all" || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setFormData({
            name: product.name,
            description: product.description || "",
            price: product.price.toString(),
            cost_price: product.cost_price?.toString() || "",
            stock_quantity: product.stock_quantity.toString(),
            low_stock_threshold: product.low_stock_threshold.toString(),
            category: product.category
        });
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this product?")) {
            deleteProduct(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            description: formData.description,
            price: parseFloat(formData.price),
            cost_price: formData.cost_price ? parseFloat(formData.cost_price) : undefined,
            stock_quantity: parseInt(formData.stock_quantity),
            low_stock_threshold: parseInt(formData.low_stock_threshold),
            category: formData.category,
            studio_id: "s1",
            is_active: true
        };

        if (editingId) {
            updateProduct(editingId, payload);
        } else {
            addProduct(payload);
        }

        setShowForm(false);
        setEditingId(null);
        setFormData(initialFormState);
    };

    const handleAdjust = (productId: string) => {
        setAdjustProductId(productId);
        setAdjustQty("");
        setAdjustReason(ADJUSTMENT_REASONS[0]);
        setAdjustNotes("");
        setShowAdjustModal(true);
    };

    const handleSubmitAdjustment = () => {
        if (!adjustProductId || !adjustQty) return;
        const product = products.find(p => p.id === adjustProductId);
        if (!product) return;
        const qty = parseInt(adjustQty);
        const newStock = Math.max(0, product.stock_quantity + qty);
        updateProduct(adjustProductId, { stock_quantity: newStock });
        setAdjustmentLogs(prev => [{
            id: `adj-${Date.now()}`,
            product_id: adjustProductId,
            product_name: product.name,
            quantity: qty,
            reason: adjustReason,
            notes: adjustNotes,
            timestamp: new Date().toISOString(),
        }, ...prev]);
        setShowAdjustModal(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage retail products and stock levels</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowLogPanel(!showLogPanel)}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        <ClipboardList className="w-4 h-4" />
                        Adjustment Log
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData(initialFormState);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                    >
                        <Plus className="w-4 h-4" />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="all">All Categories</option>
                    <option value="apparel">Apparel</option>
                    <option value="equipment">Equipment</option>
                    <option value="food_drink">Food & Drink</option>
                    <option value="other">Other</option>
                </select>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                    const isLowStock = product.stock_quantity <= product.low_stock_threshold;
                    return (
                        <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift group relative">
                            {/* Actions */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleAdjust(product.id)}
                                    className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg"
                                    title="Adjust Stock"
                                >
                                    <ArrowUpDown className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleEdit(product)}
                                    className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(product.id)}
                                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-start gap-4 mb-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                    isLowStock ? "bg-orange-100" : "bg-gray-100"
                                )}>
                                    {isLowStock ? (
                                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                                    ) : (
                                        <ShoppingBag className="w-6 h-6 text-gray-500" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                                    <span className="inline-block mt-2 text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                        {product.category.replace("_", " & ")}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Price</p>
                                    <p className="text-lg font-bold text-gray-900">{formatCurrency(product.price)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Stock</p>
                                    <div className="flex items-center justify-end gap-1.5">
                                        <p className={cn(
                                            "text-lg font-bold",
                                            isLowStock ? "text-orange-600" : "text-gray-900"
                                        )}>
                                            {product.stock_quantity}
                                        </p>
                                        {isLowStock && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">LOW</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No products found</h3>
                    <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
                </div>
            )}

            {/* Add/Edit Product Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingId ? "Edit Product" : "Add New Product"}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as Product["category"] })}
                                    >
                                        <option value="apparel">Apparel</option>
                                        <option value="equipment">Equipment</option>
                                        <option value="food_drink">Food & Drink</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (AED)</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 min-h-[80px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={formData.stock_quantity}
                                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Low Alert</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={formData.low_stock_threshold}
                                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost (Opt)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={formData.cost_price}
                                        onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    {editingId ? "Save Changes" : "Create Product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Adjustment Modal */}
            {showAdjustModal && adjustProductId && (() => {
                const product = products.find(p => p.id === adjustProductId);
                if (!product) return null;
                return (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-scale-in">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Adjust Stock</h2>
                                    <p className="text-sm text-gray-500">{product.name} — Current: {product.stock_quantity}</p>
                                </div>
                                <button onClick={() => setShowAdjustModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity (+/-)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={adjustQty}
                                        onChange={(e) => setAdjustQty(e.target.value)}
                                        placeholder="e.g. +10 or -5"
                                    />
                                    {adjustQty && (
                                        <p className="text-xs mt-1 text-gray-500">
                                            New stock: {Math.max(0, product.stock_quantity + parseInt(adjustQty || "0"))}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
                                    <select
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                        value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                    >
                                        {ADJUSTMENT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                                    <textarea
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 min-h-[60px]"
                                        value={adjustNotes}
                                        onChange={(e) => setAdjustNotes(e.target.value)}
                                        placeholder="Optional notes..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                                    <button onClick={handleSubmitAdjustment} className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90">Apply Adjustment</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Adjustment Log Panel */}
            {showLogPanel && (
                <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 border-l border-gray-100 animate-slide-in-right">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">Adjustment Log</h2>
                        <button onClick={() => setShowLogPanel(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[calc(100vh-80px)]">
                        {adjustmentLogs.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No adjustments yet</p>
                        ) : (
                            <div className="space-y-3">
                                {adjustmentLogs.map(log => (
                                    <div key={log.id} className="bg-gray-50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900">{log.product_name}</span>
                                            <span className={cn("text-sm font-bold", log.quantity > 0 ? "text-green-600" : "text-red-600")}>
                                                {log.quantity > 0 ? "+" : ""}{log.quantity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">{log.reason}</p>
                                        {log.notes && <p className="text-xs text-gray-400 mt-1">{log.notes}</p>}
                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
