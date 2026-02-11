import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { gatewayId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, { gatewayId, limit }) => {
        const results = await ctx.db
            .query("activities")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .order("desc")
            .take(limit || 500);
        return results;
    },
});

export const add = mutation({
    args: {
        gatewayId: v.string(),
        type: v.string(),
        agentName: v.string(),
        message: v.string(),
    },
    handler: async (ctx, { gatewayId, type, agentName, message }) => {
        return await ctx.db.insert("activities", {
            gatewayId,
            type,
            agentName,
            message,
            ts: Date.now(),
        });
    },
});
