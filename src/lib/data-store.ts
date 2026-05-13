import { create } from 'zustand';
import {
    studio,
    rooms as initialRooms,
    instructors as initialInstructors,
    members as initialMembers,
    adminUser,
    classTypes as initialClassTypes,
    classInstances as initialClassInstances,
    bookings as initialBookings,
    packages as initialPackages,
    memberships as initialMemberships,
    userPackages as initialUserPackages,
    userMemberships as initialUserMemberships,
    payments as initialPayments,
    walletTransactions as initialWalletTransactions,
    products as initialProducts,
    retailSales as initialRetailSales,
    promoCodes as initialPromoCodes,
    campaigns as initialCampaigns,
    notifications as initialNotifications,
    giftCards as initialGiftCards,
    instructorPayRules as initialPayRules,
    serviceAddOns as initialAddOns,
} from './mock-data';
import type {
    Studio, User, Room, ClassType, ClassInstance, Booking, Package, UserPackage, Membership, UserMembership, Payment, WalletTransaction,
    Notification, Product, RetailSale, PromoCode, Campaign, GiftCard, InstructorPayRule, ServiceAddOn
} from '@/types';

interface DataState {
    // Entities
    studio: Studio;
    rooms: Room[];
    users: User[]; // Combined admin, instructors, members
    classTypes: ClassType[];
    classInstances: ClassInstance[];
    bookings: Booking[];
    packages: Package[];
    memberships: Membership[];
    userPackages: UserPackage[];
    userMemberships: UserMembership[];
    payments: Payment[];
    walletTransactions: WalletTransaction[];
    products: Product[];
    retailSales: RetailSale[];
    promoCodes: PromoCode[];
    campaigns: Campaign[];
    notifications: Notification[];
    giftCards: GiftCard[];
    instructorPayRules: InstructorPayRule[];
    serviceAddOns: ServiceAddOn[];

    // Actions
    // -- Classes --
    addClass: (cls: Omit<ClassInstance, 'id' | 'created_at' | 'status' | 'booked_count' | 'waitlist_count' | 'class_type' | 'instructor' | 'room'>) => void;
    updateClass: (id: string, updates: Partial<ClassInstance>) => void;
    deleteClass: (id: string) => void;

    // -- Bookings & Attendance --
    addBooking: (classId: string, userId: string, paymentMethod: "credits" | "membership" | "direct_pay", packageId?: string, membershipId?: string, addOnIds?: string[]) => { success: boolean, error?: string };
    cancelBooking: (bookingId: string) => void;
    updateBookingStatus: (bookingId: string, status: Booking["status"]) => void;

    // -- Class Types --
    addClassType: (ct: Omit<ClassType, 'id' | 'created_at'>) => void;
    updateClassType: (id: string, updates: Partial<ClassType>) => void;
    deleteClassType: (id: string) => void;

    // -- Users --
    addUser: (user: Omit<User, 'id' | 'created_at'>) => void;
    updateUser: (id: string, updates: Partial<User>) => void;
    deleteUser: (id: string) => void;

    // -- Products --
    addPackage: (pkg: Omit<Package, 'id' | 'created_at'>) => void;
    addMembership: (mem: Omit<Membership, 'id' | 'created_at'>) => void;
    purchasePackage: (userId: string, packageId: string) => void; // Simulates buying a package
    purchaseMembership: (userId: string, membershipId: string) => void;

    // -- Retail --
    addProduct: (prod: Omit<Product, 'id'>) => void;
    updateProduct: (id: string, updates: Partial<Product>) => void;
    deleteProduct: (id: string) => void;
    recordRetailSale: (sale: Omit<RetailSale, 'id' | 'created_at'>) => void;

    // -- Marketing --
    addPromoCode: (pc: Omit<PromoCode, 'id'>) => void;
    deletePromoCode: (id: string) => void;
    addCampaign: (cmp: Omit<Campaign, 'id'>) => void;
    updateCampaign: (id: string, updates: Partial<Campaign>) => void;
    deleteCampaign: (id: string) => void;

    // -- Settings --
    updateStudio: (updates: Partial<Studio>) => void;
    addRoom: (room: Omit<Room, 'id'>) => void;
    toggleRoom: (id: string) => void;
    deleteRoom: (id: string) => void;

    // -- Notifications --
    dismissNotification: (id: string) => void;
    markAllNotificationsRead: (userId: string) => void;
    addNotification: (n: Omit<Notification, 'id' | 'created_at'>) => void;

    // -- Gift Cards --
    redeemGiftCard: (code: string, userId: string) => { success: boolean; amount?: number; error?: string };

    // -- Team Management --
    addAdmin: (user: Omit<User, 'id' | 'created_at'>) => void;
    removeAdmin: (userId: string) => void;

    // -- Member Actions --
    freezePackage: (id: string, days: number) => void;
    unfreezePackage: (id: string) => void;
}

// Helper to generate simple IDs
const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

import { devtools } from 'zustand/middleware';

export const useDataStore = create<DataState>()(devtools((set, get) => ({
    // Initial State
    studio: studio,
    rooms: initialRooms,
    users: [adminUser, ...initialInstructors, ...initialMembers],
    classTypes: initialClassTypes,
    classInstances: initialClassInstances,
    bookings: initialBookings,
    packages: initialPackages,
    memberships: initialMemberships,
    userPackages: initialUserPackages,
    userMemberships: initialUserMemberships,
    payments: initialPayments,
    walletTransactions: initialWalletTransactions,
    products: initialProducts,
    retailSales: initialRetailSales,
    promoCodes: initialPromoCodes,
    campaigns: initialCampaigns,
    notifications: initialNotifications,
    giftCards: initialGiftCards,
    instructorPayRules: initialPayRules,
    serviceAddOns: initialAddOns,

    // Actions
    addClass: (cls) => set((state) => {
        const id = generateId('ci');
        const classType = state.classTypes.find(ct => ct.id === cls.class_type_id);
        const instructor = state.users.find(u => u.id === cls.instructor_id);
        const room = state.rooms.find(r => r.id === cls.room_id);

        const newClass: ClassInstance = {
            id,
            ...cls,
            status: "scheduled",
            booked_count: 0,
            waitlist_count: 0,
            created_at: new Date().toISOString(),
            // Join fields for easy display
            class_type: classType,
            instructor,
            room
        };
        return { classInstances: [...state.classInstances, newClass] };
    }),

    updateClass: (id, updates) => set((state) => ({
        classInstances: state.classInstances.map(c => c.id === id ? { ...c, ...updates } : c)
    })),

    deleteClass: (id) => set((state) => ({
        classInstances: state.classInstances.filter(c => c.id !== id)
    })),

    addBooking: (classId, userId, paymentMethod, packageId, membershipId, addOnIds) => {
        const state = get();
        const cls = state.classInstances.find(c => c.id === classId);
        const user = state.users.find(u => u.id === userId);

        if (!cls || !user) return { success: false, error: "Invalid class or user" };
        if (cls.booked_count >= cls.capacity) return { success: false, error: "Class is full" };

        let creditsUsed = 0;

        // Credit deduction logic (simplified)
        if (paymentMethod === "credits" && packageId) {
            const pkg = state.userPackages.find(p => p.id === packageId);
            if (!pkg || pkg.credits_remaining < 1) return { success: false, error: "Insufficient credits" };
            creditsUsed = 1;
            // Update package credits
            set((prev) => ({
                userPackages: prev.userPackages.map(p => p.id === packageId ? { ...p, credits_used: p.credits_used + 1, credits_remaining: p.credits_remaining - 1 } : p)
            }));
            // Add wallet transaction
            set((prev) => ({
                walletTransactions: [...prev.walletTransactions, {
                    id: generateId('wt'),
                    user_id: userId,
                    studio_id: state.studio.id,
                    type: "credit_use",
                    amount: -1,
                    balance_after: pkg.credits_remaining - 1,
                    description: `Booked ${cls.class_type?.name}`,
                    reference_id: "new-booking",
                    created_at: new Date().toISOString()
                }]
            }));
        }

        // create booking
        const newBooking: Booking = {
            id: generateId('b'),
            studio_id: state.studio.id,
            class_instance_id: classId,
            user_id: userId,
            status: "confirmed",
            booked_at: new Date().toISOString(),
            credits_used: creditsUsed,
            payment_method: paymentMethod,
            user_package_id: packageId,
            user_membership_id: membershipId,
            add_on_ids: addOnIds, // Save add-ons
            created_at: new Date().toISOString(),
            user,
            class_instance: cls
        };

        // Update class booked count
        set((prev) => ({
            bookings: [...prev.bookings, newBooking],
            classInstances: prev.classInstances.map(c => c.id === classId ? { ...c, booked_count: c.booked_count + 1 } : c)
        }));

        return { success: true };
    },

    cancelBooking: (bookingId) => {
        const state = get();
        const booking = state.bookings.find(b => b.id === bookingId);
        if (!booking || booking.status === "cancelled") return;

        // Refund credit if applicable
        if (booking.payment_method === "credits" && booking.user_package_id && booking.credits_used > 0) {
            const pkg = state.userPackages.find(p => p.id === booking.user_package_id);
            if (pkg) {
                set((prev) => ({
                    userPackages: prev.userPackages.map(p => p.id === pkg.id ? { ...p, credits_used: p.credits_used - 1, credits_remaining: p.credits_remaining + 1 } : p),
                    walletTransactions: [...prev.walletTransactions, {
                        id: generateId('wt'),
                        user_id: booking.user_id,
                        studio_id: state.studio.id,
                        type: "credit_refund",
                        amount: 1,
                        balance_after: pkg.credits_remaining + 1,
                        description: `Refund for cancelled booking`,
                        reference_id: bookingId,
                        created_at: new Date().toISOString()
                    }]
                }));
            }
        }

        // Update booking status and class count
        set((prev) => ({
            bookings: prev.bookings.map(b => b.id === bookingId ? { ...b, status: "cancelled", cancelled_at: new Date().toISOString() } : b),
            classInstances: prev.classInstances.map(c => c.id === booking.class_instance_id ? { ...c, booked_count: Math.max(0, c.booked_count - 1) } : c)
        }));
    },

    updateBookingStatus: (bookingId, status) => set((state) => ({
        bookings: state.bookings.map(b => b.id === bookingId ? { ...b, status } : b)
    })),

    addClassType: (ct) => set((state) => ({
        classTypes: [...state.classTypes, { ...ct, id: generateId('ct'), created_at: new Date().toISOString() }]
    })),

    updateClassType: (id, updates) => set((state) => ({
        classTypes: state.classTypes.map(c => c.id === id ? { ...c, ...updates } : c)
    })),

    deleteClassType: (id) => set((state) => ({
        classTypes: state.classTypes.filter(c => c.id !== id)
    })),

    addUser: (user) => set((state) => ({
        users: [...state.users, { ...user, id: generateId('u'), created_at: new Date().toISOString() }]
    })),

    updateUser: (id, updates) => set((state) => ({
        users: state.users.map(u => u.id === id ? { ...u, ...updates } : u)
    })),

    deleteUser: (id) => set((state) => ({
        users: state.users.filter(u => u.id !== id)
    })),

    addPackage: (pkg) => set((state) => ({
        packages: [...state.packages, { ...pkg, id: generateId('pkg'), created_at: new Date().toISOString() }]
    })),

    addMembership: (mem) => set((state) => ({
        memberships: [...state.memberships, { ...mem, id: generateId('mem'), created_at: new Date().toISOString() }]
    })),

    purchasePackage: (userId, packageId) => {
        const state = get();
        const pkg = state.packages.find(p => p.id === packageId);
        if (!pkg) return;

        const newUp: UserPackage = {
            id: generateId('up'),
            user_id: userId,
            package_id: packageId,
            studio_id: state.studio.id,
            credits_total: pkg.credit_count,
            credits_used: 0,
            credits_remaining: pkg.credit_count,
            purchased_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + pkg.validity_days * 86400000).toISOString(),
            purchase_location: "online",
            status: "active",
            payment_id: generateId('pay'),
            created_at: new Date().toISOString(),
            package: pkg
        };

        set((prev) => ({
            userPackages: [...prev.userPackages, newUp],
            walletTransactions: [...prev.walletTransactions, {
                id: generateId('wt'),
                user_id: userId,
                studio_id: state.studio.id,
                type: "credit_purchase",
                amount: pkg.credit_count,
                balance_after: pkg.credit_count, // Simplified: assuming previous balance was 0 or strictly additive
                description: `Purchased ${pkg.name}`,
                created_at: new Date().toISOString()
            }]
        }));
    },

    purchaseMembership: (userId, membershipId) => {
        const state = get();
        const mem = state.memberships.find(m => m.id === membershipId);
        if (!mem) return;

        const newUm: UserMembership = {
            id: generateId('um'),
            user_id: userId,
            membership_id: membershipId,
            studio_id: state.studio.id,
            start_date: new Date().toISOString().split("T")[0],
            status: "active",
            auto_renew: true,
            created_at: new Date().toISOString(),
            membership: mem
        };

        set((prev) => ({
            userMemberships: [...prev.userMemberships, newUm]
        }));
    },

    updateStudio: (updates) => set((state) => ({
        studio: { ...state.studio, ...updates }
    })),

    addRoom: (room) => set((state) => ({
        rooms: [...state.rooms, { ...room, id: generateId('r') }]
    })),

    toggleRoom: (id) => set((state) => ({
        rooms: state.rooms.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r)
    })),

    deleteRoom: (id) => set((state) => ({
        rooms: state.rooms.filter(r => r.id !== id)
    })),

    // -- Retail --
    addProduct: (prod) => set((state) => ({
        products: [...state.products, { ...prod, id: generateId('p') }]
    })),

    updateProduct: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
    })),

    deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
    })),

    recordRetailSale: (sale) => set((state) => {
        // Decrease stock for sold items
        const newProducts = state.products.map(p => {
            const item = sale.items.find(i => i.product_id === p.id);
            if (item) {
                return { ...p, stock_quantity: p.stock_quantity - item.quantity };
            }
            return p;
        });

        return {
            retailSales: [...state.retailSales, { ...sale, id: generateId('rs'), created_at: new Date().toISOString() }],
            products: newProducts
        };
    }),

    // -- Marketing --
    addPromoCode: (pc) => set((state) => ({
        promoCodes: [...state.promoCodes, { ...pc, id: generateId('pc') }]
    })),

    deletePromoCode: (id) => set((state) => ({
        promoCodes: state.promoCodes.filter(p => p.id !== id)
    })),

    addCampaign: (cmp) => set((state) => ({
        campaigns: [...state.campaigns, { ...cmp, id: generateId('cmp') }]
    })),

    updateCampaign: (id, updates) => set((state) => ({
        campaigns: state.campaigns.map(c => c.id === id ? { ...c, ...updates } : c)
    })),

    deleteCampaign: (id) => set((state) => ({
        campaigns: state.campaigns.filter(c => c.id !== id)
    })),

    // -- Notifications --
    dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
    })),
    markAllNotificationsRead: (userId) => set((state) => ({
        notifications: state.notifications.map(n => n.user_id === userId ? { ...n, status: 'sent' as const } : n)
    })),
    addNotification: (n) => set((state) => ({
        notifications: [{ ...n, id: generateId('n'), created_at: new Date().toISOString() } as Notification, ...state.notifications]
    })),

    // -- Gift Cards --
    redeemGiftCard: (code, userId) => {
        const state = get();
        const gc = state.giftCards.find(g => g.code === code && g.status === 'active');
        if (!gc) return { success: false, error: 'Invalid or expired gift card code' };
        if (gc.balance <= 0) return { success: false, error: 'Gift card has no remaining balance' };
        const amount = gc.balance;
        set({
            giftCards: state.giftCards.map(g => g.id === gc.id ? { ...g, balance: 0, status: 'redeemed' as const } : g),
            walletTransactions: [{
                id: generateId('wt'), user_id: userId, studio_id: 's1', type: 'gift_card_redeem' as const,
                amount, balance_after: 0, description: `Redeemed gift card ${code} (AED ${amount})`, created_at: new Date().toISOString()
            }, ...state.walletTransactions],
        });
        return { success: true, amount };
    },

    // -- Member Actions --
    freezePackage: (id: string, days: number) => set((state) => ({
        userPackages: state.userPackages.map(p => p.id === id ? {
            ...p,
            status: "frozen" as const,
            frozen_until: new Date(Date.now() + days * 86400000).toISOString(),
            expires_at: new Date(new Date(p.expires_at).getTime() + days * 86400000).toISOString(),
        } : p)
    })),

    unfreezePackage: (id: string) => set((state) => ({
        userPackages: state.userPackages.map(p => p.id === id ? {
            ...p,
            status: "active" as const,
            frozen_until: undefined,
        } : p)
    })),

    // -- Team Management --
    addAdmin: (user) => set((state) => ({
        users: [...state.users, { ...user, id: generateId('u-admin'), role: 'admin', created_at: new Date().toISOString() }]
    })),

    removeAdmin: (userId) => set((state) => ({
        users: state.users.filter(u => u.id !== userId)
    })),
})));
