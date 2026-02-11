import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("documents")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .collect();
    },
});

export const create = mutation({
    args: {
        gatewayId: v.string(),
        title: v.string(),
        content: v.string(),
        type: v.optional(v.string()),
        taskId: v.optional(v.string()),
    },
    handler: async (ctx, { gatewayId, title, content, type, taskId }) => {
        const now = Date.now();
        const id = await ctx.db.insert("documents", {
            gatewayId,
            title,
            content,
            type: type || "deliverable",
            taskId: taskId || undefined,
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.insert("activities", {
            gatewayId,
            type: "document_created",
            agentName: "You",
            message: `Created document: ${title}`,
            ts: now,
        });
        return id;
    },
});

export const update = mutation({
    args: {
        id: v.id("documents"),
        patch: v.object({
            title: v.optional(v.string()),
            content: v.optional(v.string()),
            type: v.optional(v.string()),
        }),
    },
    handler: async (ctx, { id, patch }) => {
        await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    },
});

export const remove = mutation({
    args: { id: v.id("documents") },
    handler: async (ctx, { id }) => {
        await ctx.db.delete(id);
    },
});
