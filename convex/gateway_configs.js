import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* ──────────────────────────────────────────────────────
   gateway_configs — Persist gateway configurations in DB
   Replaces localStorage-based persistence.
   ────────────────────────────────────────────────────── */

// List all saved gateway configs
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("gateway_configs").collect();
    },
});

// Upsert a gateway config (create or update)
export const upsert = mutation({
    args: {
        gatewayId: v.string(),
        name: v.string(),
        url: v.string(),
        token: v.string(),
        selected: v.boolean(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("gateway_configs")
            .withIndex("by_gatewayId", q => q.eq("gatewayId", args.gatewayId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                url: args.url,
                token: args.token,
                selected: args.selected,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("gateway_configs", args);
        }
    },
});

// Remove a gateway config
export const remove = mutation({
    args: { gatewayId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("gateway_configs")
            .withIndex("by_gatewayId", q => q.eq("gatewayId", args.gatewayId))
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

// Set which gateway is selected
export const setSelected = mutation({
    args: { gatewayId: v.string() },
    handler: async (ctx, args) => {
        // Deselect all first
        const all = await ctx.db.query("gateway_configs").collect();
        for (const cfg of all) {
            if (cfg.selected) {
                await ctx.db.patch(cfg._id, { selected: false });
            }
        }
        // Select the target
        const target = await ctx.db
            .query("gateway_configs")
            .withIndex("by_gatewayId", q => q.eq("gatewayId", args.gatewayId))
            .first();
        if (target) {
            await ctx.db.patch(target._id, { selected: true });
        }
    },
});
