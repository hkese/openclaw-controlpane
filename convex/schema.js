import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    gateway_configs: defineTable({
        gatewayId: v.string(),
        name: v.string(),
        url: v.string(),
        token: v.string(),
        selected: v.boolean(),
    }).index("by_gatewayId", ["gatewayId"]),


    tasks: defineTable({
        gatewayId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        status: v.string(),
        assigneeIds: v.optional(v.array(v.string())),
        sessionKey: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_gateway", ["gatewayId"])
        .index("by_gateway_status", ["gatewayId", "status"]),

    comments: defineTable({
        gatewayId: v.string(),
        taskId: v.string(),
        content: v.string(),
        fromAgent: v.string(),
        ts: v.number(),
    })
        .index("by_task", ["taskId"])
        .index("by_gateway", ["gatewayId"]),

    documents: defineTable({
        gatewayId: v.string(),
        title: v.string(),
        content: v.string(),
        type: v.optional(v.string()),
        taskId: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_gateway", ["gatewayId"]),

    activities: defineTable({
        gatewayId: v.string(),
        type: v.string(),
        agentName: v.string(),
        message: v.string(),
        ts: v.number(),
    })
        .index("by_ts", ["ts"])
        .index("by_gateway", ["gatewayId"]),

    notifications: defineTable({
        gatewayId: v.string(),
        agentName: v.string(),
        content: v.string(),
        delivered: v.boolean(),
        ts: v.number(),
    })
        .index("by_delivered", ["delivered"])
        .index("by_gateway", ["gatewayId"]),

    journal: defineTable({
        gatewayId: v.string(),
        content: v.string(),
        mood: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        createdAt: v.number(),
    })
        .index("by_gateway", ["gatewayId"])
        .index("by_gateway_time", ["gatewayId", "createdAt"]),
});
