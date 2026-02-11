import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("journal")
            .withIndex("by_gateway_time", q => q.eq("gatewayId", gatewayId))
            .order("desc")
            .take(100);
    },
});

export const add = mutation({
    args: {
        gatewayId: v.string(),
        content: v.string(),
        mood: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("journal", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

export const remove = mutation({
    args: { id: v.id("journal") },
    handler: async (ctx, { id }) => {
        await ctx.db.delete(id);
    },
});
