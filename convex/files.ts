import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Generate a signed URL the client uploads a file to (multipart/form-data)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר');
    return await ctx.storage.generateUploadUrl();
  },
});

// Resolve a storage id -> public URL
export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
