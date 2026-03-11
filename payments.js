// ==========================================
// TO'LOV VA OBUNA TIZIMI (SUPABASE EDITION)
// Koyeb va Cloud hostinglar uchun 24/7 moslashuvchan baza
// ==========================================

const supabase = require('./utils/supabase_client');

const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
const HUMO_CARD = process.env.HUMO_CARD || '9860_XXXX_XXXX_XXXX';
const CARD_HOLDER = process.env.CARD_HOLDER || '';
const FREE_TRIALS = parseInt(process.env.FREE_TRIALS) || 3;

const PLANS = {
    starter: { name: '📦 Starter', credits: 30, price: 25000, duration: 30, description: '30 ta hujjat / 1 oy' },
    professional: { name: '💼 Professional', credits: 100, price: 70000, duration: 30, description: '100 ta hujjat / 1 oy' },
    unlimited: { name: '👑 Cheksiz (Unlimited)', credits: 999999, price: 50000, duration: 30, description: 'Cheksiz hujjat / 1 oy' }
};

const REGEN_LIMITS = {
    trial: 1,
    starter: 3,
    professional: 5,
    unlimited: 5
};

/**
 * 🛠 DATA LAYER: Migrating from JSON to Supabase
 */

async function getUser(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('userId', String(userId))
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Supabase getUser Error:', error);
    }
    return data || null;
}

async function createUser(userId, username, fullName) {
    let user = await getUser(userId);
    if (user) return user;

    const newUser = {
        userId: String(userId),
        username: username || '',
        fullName: fullName || '',
        plan: 'trial',
        credits: FREE_TRIALS,
        subscriptionEnd: null,
        token: null,
        active: true,
        autoRenew: false,
        joinDate: new Date().toISOString().split('T')[0],
        totalDocs: 0
    };

    const { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

    if (error) {
        console.error('Supabase createUser Error:', error);
        return newUser; // Fallback to memory
    }

    // Update Analytics (Mental check: in a real big app, use a separate table)
    await recordEvent('user_join');
    return data;
}

async function updateUser(userId, updates) {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('userId', String(userId))
        .select()
        .single();

    if (error) {
        console.error('Supabase updateUser Error:', error);
        return null;
    }
    return data;
}

async function useCredit(userId) {
    const user = await getUser(userId);
    if (!user) return { success: false, reason: 'user_not_found' };

    if (user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) {
        await updateUser(userId, { active: false, credits: 0 });
        return { success: false, reason: 'expired' };
    }

    if (user.credits <= 0) return { success: false, reason: 'no_credits' };

    const { data, error } = await supabase
        .from('users')
        .update({
            credits: user.credits - 1,
            totalDocs: (user.totalDocs || 0) + 1
        })
        .eq('userId', String(userId))
        .select()
        .single();

    return error ? { success: false } : { success: true, remaining: data.credits };
}

async function checkAccess(userId) {
    const user = await getUser(userId);
    if (!user) return { hasAccess: false, reason: 'not_registered' };
    if (user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) return { hasAccess: false, reason: 'expired', user };
    if (user.credits <= 0) return { hasAccess: false, reason: 'no_credits', user };
    return { hasAccess: true, user };
}

async function activateSubscription(userId, planKey) {
    const plan = PLANS[planKey];
    if (!plan) return null;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);
    const token = generateToken();

    return updateUser(userId, {
        plan: planKey,
        credits: plan.credits,
        subscriptionEnd: endDate.toISOString().split('T')[0],
        token: token,
        active: true
    }).then(updated => updated ? { user: updated, token, endDate: endDate.toISOString().split('T')[0] } : null);
}

function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'MFY-';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) token += chars[Math.floor(Math.random() * chars.length)];
        if (i < 2) token += '-';
    }
    return token;
}

async function recordEvent(id) {
    // Simple Increment Logic in Supabase
    const { data: analytics } = await supabase.from('analytics').select('*').eq('id', 'global').single();
    if (analytics) {
        const events = analytics.events || {};
        events[id] = (events[id] || 0) + 1;
        await supabase.from('analytics').update({ events }).eq('id', 'global');
    }
}

async function recordPerf(metric, time) {
    const { data: analytics } = await supabase.from('analytics').select('*').eq('id', 'global').single();
    if (analytics) {
        const perf = analytics.perf || {};
        if (!perf[metric]) perf[metric] = { count: 0, total: 0 };
        perf[metric].count++;
        perf[metric].total += time;
        await supabase.from('analytics').update({ perf }).eq('id', 'global');
    }
}

async function getStats() {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { data: analytics } = await supabase.from('analytics').select('*').eq('id', 'global').single();
    const { data: users } = await supabase.from('users').select('totalDocs, plan');

    return {
        totalUsers: totalUsers || 0,
        totalDocs: users ? users.reduce((sum, u) => sum + (u.totalDocs || 0), 0) : 0,
        paidUsers: users ? users.filter(u => u.plan !== 'trial').length : 0,
        revenue: users ? users.reduce((sum, u) => sum + (PLANS[u.plan]?.price || 0), 0) : 0,
        analytics: analytics || { events: {}, perf: {} }
    };
}

module.exports = {
    PLANS, ADMIN_ID, HUMO_CARD, CARD_HOLDER, FREE_TRIALS,
    getUser, createUser, updateUser, useCredit, checkAccess,
    activateSubscription, getStats, REGEN_LIMITS,
    recordEvent, recordPerf
};
