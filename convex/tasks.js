import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ───

export const list = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .collect();
    },
});

export const listByStatus = query({
    args: { gatewayId: v.string(), status: v.string() },
    handler: async (ctx, { gatewayId, status }) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_gateway_status", (q) =>
                q.eq("gatewayId", gatewayId).eq("status", status)
            )
            .collect();
    },
});

// ─── Mutations ───

export const create = mutation({
    args: {
        gatewayId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        assigneeIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, { gatewayId, title, description, assigneeIds }) => {
        const now = Date.now();
        // Auto-assign: if agents are assigned, start in 'assigned' instead of 'inbox'
        const status = assigneeIds && assigneeIds.length > 0 ? "assigned" : "inbox";
        const id = await ctx.db.insert("tasks", {
            gatewayId,
            title,
            description: description || "",
            status,
            assigneeIds: assigneeIds || [],
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.insert("activities", {
            gatewayId,
            type: "task_created",
            agentName: "You",
            message: `Created task: ${title}${status === 'assigned' ? ' (auto-assigned)' : ''}`,
            ts: now,
        });
        return id;
    },
});

export const update = mutation({
    args: {
        id: v.id("tasks"),
        patch: v.object({
            title: v.optional(v.string()),
            description: v.optional(v.string()),
            status: v.optional(v.string()),
            assigneeIds: v.optional(v.array(v.string())),
            sessionKey: v.optional(v.string()),
        }),
    },
    handler: async (ctx, { id, patch }) => {
        const existing = await ctx.db.get(id);
        if (!existing) throw new Error("Task not found");

        const updates = { ...patch, updatedAt: Date.now() };

        // Auto-move: if assigning agents to an inbox task, move to assigned
        if (patch.assigneeIds && patch.assigneeIds.length > 0 && existing.status === 'inbox' && !patch.status) {
            updates.status = 'assigned';
        }

        await ctx.db.patch(id, updates);

        if (updates.status && updates.status !== existing.status) {
            await ctx.db.insert("activities", {
                gatewayId: existing.gatewayId,
                type: "task_status",
                agentName: "You",
                message: `Moved "${existing.title}" to ${updates.status}`,
                ts: Date.now(),
            });
        }
    },
});

export const remove = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, { id }) => {
        const existing = await ctx.db.get(id);
        if (!existing) return;

        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", existing._id.toString()))
            .collect();
        for (const c of comments) {
            await ctx.db.delete(c._id);
        }

        await ctx.db.delete(id);

        await ctx.db.insert("activities", {
            gatewayId: existing.gatewayId,
            type: "task_deleted",
            agentName: "You",
            message: `Deleted task: ${existing.title}`,
            ts: Date.now(),
        });
    },
});
