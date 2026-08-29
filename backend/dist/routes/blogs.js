"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const dbHelpers_1 = require("../lib/dbHelpers");
const adminAudit_1 = require("../lib/adminAudit");
const router = (0, express_1.Router)();
const slugify = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
const mapBlogRow = (row) => ({
    id: String(row.id),
    _id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    content: row.content ?? '',
    category: row.category ?? '',
    coverImage: row.cover_image ?? '',
    author: row.author ?? 'BrajMart Team',
    readTime: Number(row.read_time ?? 5),
    status: row.status ?? 'draft',
    archivedAt: (0, dbHelpers_1.toIsoString)(row.archived_at),
    archivedBy: row.archived_by || '',
    archiveReason: row.archive_reason || '',
    publishedAt: (0, dbHelpers_1.toIsoString)(row.published_at),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const mapBlogListRow = (row) => ({
    id: String(row.id),
    _id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    category: row.category ?? '',
    coverImage: row.cover_image ?? '',
    author: row.author ?? 'BrajMart Team',
    readTime: Number(row.read_time ?? 5),
    status: row.status ?? 'draft',
    archivedAt: (0, dbHelpers_1.toIsoString)(row.archived_at),
    archivedBy: row.archived_by || '',
    archiveReason: row.archive_reason || '',
    publishedAt: (0, dbHelpers_1.toIsoString)(row.published_at),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const buildUpdate = (data) => {
    const fields = [];
    const values = [];
    const set = (column, value) => {
        fields.push(`${column} = ?`);
        values.push(value);
    };
    if (data.title !== undefined)
        set('title', data.title);
    if (data.slug !== undefined)
        set('slug', data.slug);
    if (data.excerpt !== undefined)
        set('excerpt', data.excerpt);
    if (data.content !== undefined)
        set('content', data.content);
    if (data.category !== undefined)
        set('category', data.category);
    if (data.coverImage !== undefined)
        set('cover_image', data.coverImage);
    if (data.author !== undefined)
        set('author', data.author);
    if (data.readTime !== undefined)
        set('read_time', data.readTime);
    if (data.status !== undefined)
        set('status', data.status);
    if (data.publishedAt !== undefined)
        set('published_at', data.publishedAt);
    if (!fields.length)
        return null;
    fields.push('updated_at = NOW()');
    return { sql: fields.join(', '), values };
};
router.get('/', async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)("SELECT * FROM blogs WHERE status = 'published' AND archived_at IS NULL ORDER BY COALESCE(published_at, created_at) DESC");
        res.json(rows.map(mapBlogListRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/admin', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM blogs ORDER BY created_at DESC');
        res.json(rows.map(mapBlogRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/admin/:slug', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [req.params.slug]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ message: 'Blog not found' });
        res.json(mapBlogRow(row));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)("SELECT * FROM blogs WHERE slug = ? AND status = 'published' AND archived_at IS NULL LIMIT 1", [req.params.slug]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ message: 'Blog not found' });
        res.json(mapBlogRow(row));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const data = req.body || {};
        const finalSlug = data.slug ? String(data.slug) : slugify(String(data.title || ''));
        if (!data.title)
            return res.status(400).json({ message: 'Title is required' });
        if (!finalSlug)
            return res.status(400).json({ message: 'Slug is required' });
        const excerpt = data.excerpt !== undefined && data.excerpt !== null
            ? data.excerpt
            : data.content
                ? String(data.content).slice(0, 200)
                : '';
        const status = data.status || 'draft';
        const publishedAt = status === 'published' ? data.publishedAt || new Date() : data.publishedAt || null;
        const result = await (0, db_1.dbExecute)('INSERT INTO blogs (title, slug, excerpt, content, category, cover_image, author, read_time, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            data.title,
            finalSlug,
            excerpt ?? '',
            data.content ?? '',
            data.category ?? '',
            data.coverImage ?? '',
            data.author ?? 'BrajMart Team',
            data.readTime ?? 5,
            status,
            publishedAt,
        ]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM blogs WHERE id = ? LIMIT 1', [result.insertId]);
        await (0, adminAudit_1.insertAdminAuditLog)(null, {
            req: req,
            action: 'BLOG_CREATE',
            entityType: 'blog',
            entityId: result.insertId,
            after: rows[0],
            reason: 'Blog created',
        }).catch(() => { });
        res.status(201).json(mapBlogRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const data = req.body || {};
        if (data.title && !data.slug)
            data.slug = slugify(String(data.title));
        if (data.status === 'published' && data.publishedAt === undefined) {
            data.publishedAt = new Date();
        }
        if (data.status === 'draft' && data.publishedAt === undefined) {
            data.publishedAt = null;
        }
        const update = buildUpdate(data);
        if (!update)
            return res.status(400).json({ message: 'No fields to update' });
        const beforeRows = await (0, db_1.dbQuery)('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
        const before = beforeRows[0];
        if (!before)
            return res.status(404).json({ message: 'Blog not found' });
        await (0, db_1.dbExecute)(`UPDATE blogs SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ message: 'Blog not found' });
        await (0, adminAudit_1.insertAdminAuditLog)(null, {
            req: req,
            action: data.status === 'published' && before.status !== 'published' ? 'BLOG_PUBLISH' : 'BLOG_UPDATE',
            entityType: 'blog',
            entityId: req.params.id,
            before,
            after: rows[0],
            reason: 'Blog updated',
        }).catch(() => { });
        res.json(mapBlogRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const reason = String(req.body?.reason || req.query.reason || 'Blog archived by admin').trim().slice(0, 255);
        const actor = (0, adminAudit_1.actorFromRequest)(req);
        let archived = null;
        await (0, db_1.withDbTransaction)(async (connection) => {
            const [rows] = await connection.execute('SELECT * FROM blogs WHERE id = ? FOR UPDATE', [req.params.id]);
            const before = rows[0];
            if (!before)
                throw new Error('Blog not found');
            await connection.execute('UPDATE blogs SET archived_at = COALESCE(archived_at, NOW()), archived_by = ?, archive_reason = ?, updated_at = NOW() WHERE id = ?', [actor.adminEmail || actor.adminId || 'admin', reason, req.params.id]);
            const [afterRows] = await connection.execute('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
            archived = afterRows[0];
            await (0, adminAudit_1.insertAdminAuditLog)(connection, {
                req,
                action: 'BLOG_ARCHIVE',
                entityType: 'blog',
                entityId: req.params.id,
                before,
                after: archived,
                reason,
            });
        });
        res.json({ message: 'Blog archived', blog: mapBlogRow(archived) });
    }
    catch (err) {
        const message = err?.message || 'Failed to archive blog';
        res.status(message === 'Blog not found' ? 404 : 500).json({ message });
    }
});
router.post('/:id/restore', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const reason = String(req.body?.reason || 'Blog restored by admin').trim().slice(0, 255);
        let restored = null;
        await (0, db_1.withDbTransaction)(async (connection) => {
            const [rows] = await connection.execute('SELECT * FROM blogs WHERE id = ? FOR UPDATE', [req.params.id]);
            const before = rows[0];
            if (!before)
                throw new Error('Blog not found');
            if (!before.title || !before.slug || !before.content)
                throw new Error('Cannot restore blog until title, slug, and content are valid.');
            const [dupes] = await connection.execute('SELECT id FROM blogs WHERE slug = ? AND id <> ? AND archived_at IS NULL LIMIT 1', [before.slug, req.params.id]);
            if (dupes.length)
                throw new Error('Cannot restore blog because another active blog uses this slug.');
            await connection.execute('UPDATE blogs SET archived_at = NULL, archived_by = NULL, archive_reason = NULL, updated_at = NOW() WHERE id = ?', [req.params.id]);
            const [afterRows] = await connection.execute('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
            restored = afterRows[0];
            await (0, adminAudit_1.insertAdminAuditLog)(connection, {
                req,
                action: 'BLOG_RESTORE',
                entityType: 'blog',
                entityId: req.params.id,
                before,
                after: restored,
                reason,
            });
        });
        res.json({ message: 'Blog restored', blog: mapBlogRow(restored) });
    }
    catch (err) {
        const message = err?.message || 'Failed to restore blog';
        res.status(message === 'Blog not found' ? 404 : 400).json({ message });
    }
});
exports.default = router;
