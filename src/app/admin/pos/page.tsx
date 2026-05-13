"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, formatCurrency } from "@/lib/utils";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, User as UserIcon, X, CheckCircle, Ticket } from "lucide-react";
import { Product, RetailSale, PromoCode } from "@/types";

export default function POSPage() {
    const { products, users, recordRetailSale, promoCodes } = useDataStore();
    const members = users.filter(u => u.role === "member");

    // State
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
    const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment" | "success">("cart");
    const [paymentMethod, setPaymentMethod] = useState<RetailSale["payment_method"]>("card_on_file");
    const [promoCodeInput, setPromoCodeInput] = useState("");
    const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
    const [promoError, setPromoError] = useState("");

    // Filter Products
    const filteredProducts = products.filter(p =>
        p.is_active &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Cart Actions
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_quantity) return prev; // Stock limit
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = item.quantity + delta;
                if (newQty < 1) return item;
                if (newQty > item.product.stock_quantity) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    // Promo Logic
    const handleApplyPromo = () => {
        setPromoError("");
        if (!promoCodeInput) return;

        const code = promoCodes.find(p => p.code === promoCodeInput.trim().toUpperCase() && p.is_active);

        if (!code) {
            setPromoError("Invalid code");
            setAppliedPromo(null);
            return;
        }

        // Basic validation
        if (code.min_spend && cartTotal < code.min_spend) {
            setPromoError(`Min spend: $${code.min_spend}`);
            setAppliedPromo(null);
            return;
        }

        // Check applicability (simplified)
        if (code.applies_to !== "all" && code.applies_to !== "retail") {
            setPromoError("Code not applicable to retail");
            setAppliedPromo(null);
            return;
        }

        setAppliedPromo(code);
    };

    const discountAmount = appliedPromo
        ? appliedPromo.type === "percentage"
            ? cartTotal * (appliedPromo.value / 100)
            : appliedPromo.value
        : 0;

    const taxableAmount = Math.max(0, cartTotal - discountAmount);
    const taxAmount = taxableAmount * 0.05;
    const finalTotal = taxableAmount + taxAmount;

    const handleCheckout = () => {
        if (!selectedUser) {
            alert("Please select a member first");
            return;
        }

        const sale: Omit<RetailSale, "id" | "created_at"> = {
            studio_id: "s1",
            user_id: selectedUser,
            total_amount: finalTotal,
            payment_method: paymentMethod,
            items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                price_at_sale: item.product.price
            }))
        };

        recordRetailSale(sale);
        setCheckoutStep("success");
        // Reset after delay or manual close
    };

    const resetPOS = () => {
        setCart([]);
        setSelectedUser("");
        setCheckoutStep("cart");
        setSearchTerm("");
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex -mx-6 -my-6">
            {/* Left: Product Catalog */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100 bg-gray-50/50">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Retail POS</h1>
                        <p className="text-sm text-gray-500 mt-1">Select items to add to the cart</p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                disabled={product.stock_quantity === 0}
                                className={cn(
                                    "text-left bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-brand-200 group relative overflow-hidden",
                                    product.stock_quantity === 0 && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                <p className="text-xs text-gray-500 mt-1 truncate">{product.category}</p>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="font-bold text-brand-600">{formatCurrency(product.price)}</span>
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                        product.stock_quantity > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                    )}>
                                        {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-96 bg-white flex flex-col shadow-2xl z-10">
                {checkoutStep === "success" ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Sale Completed!</h2>
                        <p className="text-sm text-gray-500 mb-6">The transaction has been recorded successfully.</p>
                        <button
                            onClick={resetPOS}
                            className="w-full py-2.5 gradient-bg-brand text-white rounded-xl font-medium hover:opacity-90"
                        >
                            Start New Sale
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Member Select */}
                        <div className="p-4 border-b border-gray-100">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                            >
                                <option value="">Select Member...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.first_name} {m.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <ShoppingCart className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm text-center">Cart is empty</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.product.id} className="flex gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                            <span className="text-xs font-bold text-gray-500">x{item.quantity}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">{item.product.name}</h4>
                                            <p className="text-xs text-gray-500">{formatCurrency(item.product.price)} each</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-bold text-gray-900">
                                                {formatCurrency(item.product.price * item.quantity)}
                                            </span>
                                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    className="p-1 hover:bg-white rounded text-gray-500"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.product.id)}
                                                    className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-gray-500"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                    className="p-1 hover:bg-white rounded text-gray-500"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totals & Checkout */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
                            <div className="space-y-3 pb-4 border-b border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase">Promo Code</h4>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                                            placeholder="Code"
                                            value={promoCodeInput}
                                            onChange={(e) => setPromoCodeInput(e.target.value)}
                                            disabled={!!appliedPromo}
                                        />
                                    </div>
                                    {appliedPromo ? (
                                        <button
                                            onClick={() => { setAppliedPromo(null); setPromoCodeInput(""); }}
                                            className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
                                        >
                                            Remove
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleApplyPromo}
                                            className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                                        >
                                            Apply
                                        </button>
                                    )}
                                </div>
                                {promoError && <p className="text-xs text-red-500">{promoError}</p>}
                                {appliedPromo && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Code applied!</p>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(cartTotal)}</span>
                                </div>
                                {appliedPromo && (
                                    <div className="flex justify-between text-sm text-green-600 font-medium">
                                        <span>Discount</span>
                                        <span>-{formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Tax (5%)</span>
                                    <span>{formatCurrency(taxAmount)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                                    <span>Total</span>
                                    <span>{formatCurrency(finalTotal)}</span>
                                </div>
                            </div>

                            {checkoutStep === "cart" ? (
                                <button
                                    onClick={() => setCheckoutStep("payment")}
                                    disabled={cart.length === 0 || !selectedUser}
                                    className="w-full py-3 gradient-bg-brand text-white rounded-xl font-bold shadow-glow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Proceed to Payment
                                </button>
                            ) : (
                                <div className="space-y-3 animate-slide-up">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setPaymentMethod("card_on_file")}
                                            className={cn(
                                                "p-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-2 transition-all",
                                                paymentMethod === "card_on_file"
                                                    ? "border-brand-500 bg-brand-50 text-brand-700"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                            )}
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            Card on File
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod("terminal")}
                                            className={cn(
                                                "p-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-2 transition-all",
                                                paymentMethod === "terminal"
                                                    ? "border-brand-500 bg-brand-50 text-brand-700"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                            )}
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            Terminal
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod("cash")}
                                            className={cn(
                                                "p-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-2 transition-all col-span-2",
                                                paymentMethod === "cash"
                                                    ? "border-brand-500 bg-brand-50 text-brand-700"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                            )}
                                        >
                                            <Banknote className="w-5 h-5" />
                                            Cash
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleCheckout}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Confirm Payment
                                    </button>
                                    <button
                                        onClick={() => setCheckoutStep("cart")}
                                        className="w-full py-2 text-sm text-gray-500 font-medium hover:text-gray-700"
                                    >
                                        Back to Cart
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
