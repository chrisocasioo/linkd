import Anthropic from '@anthropic-ai/sdk';
import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { contacts } from '../db/schema';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET / — list all contacts for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /scan — OCR a business card image, return extracted fields (does not save)
router.post('/scan', upload.single('card'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const base64 = req.file.buffer.toString('base64');
    const mediaType = (req.file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/jpeg' | 'image/png';

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: 'Extract contact information from this business card image. Return ONLY valid JSON with no other text or markdown: { "firstName": "", "lastName": "", "email": "", "phone": "", "company": "", "jobTitle": "", "website": "" }. Use null for any field not found on the card.',
          },
        ],
      }],
    });

    const raw = (msg.content[0] as any).text.trim()
      .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const extracted = JSON.parse(raw);
    res.json(extracted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — save a confirmed contact
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { firstName, lastName, email, phone, company, jobTitle, website, notes } = req.body;
    const [created] = await db
      .insert(contacts)
      .values({ userId, firstName, lastName, email, phone, company, jobTitle, website, notes })
      .returning();
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id — update contact fields
router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { firstName, lastName, email, phone, company, jobTitle, website, notes } = req.body;
    const [updated] = await db
      .update(contacts)
      .set({ firstName, lastName, email, phone, company, jobTitle, website, notes })
      .where(eq(contacts.id, id))
      .returning();
    if (!updated || updated.userId !== userId) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();
    if (!deleted || deleted.userId !== userId) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
