"use node";

// ─── Weekly AI marketing suggestions — Node action ──────────────────────────
// This file lives in the Node runtime because the OpenAI SDK uses Node-only
// features. Queries / mutations / the internal persist mutation are in
// `aiSuggestionStore.ts` (V8 runtime).
//
// Public surface from this file:
//   • generateWeeklySuggestions — action
//
// Future kinds (holidays, trends, seasonal, reminders, campaign planning)
// can be added by:
//   1. Extending `SuggestionKind` and the schema `kind` union in
//      `aiSuggestionStore.ts`.
//   2. Adding a new `build{Kind}SystemPrompt` / `build{Kind}UserPrompt` here.
//   3. Adding a new public action (e.g. `generateHolidaySuggestions`) that
//      calls the same persist pipeline.

import { v as _v } from 'convex/values';
import OpenAI from 'openai';
import { api, internal } from './_generated/api';
import { action } from './_generated/server';

void _v; // reserved for future action args

type SuggestionKind = 'weekly' | 'holiday' | 'trend' | 'seasonal' | 'reminder' | 'campaign';

type GeneratedSuggestion = {
  title: string;
  description: string;
  posterType: string;
  visualStyle: string;
  suggestedGoal: string;
};

const MIN_SUGGESTIONS = 3;
const MAX_SUGGESTIONS = 5;

// Sunday 00:00 UTC anchor for the week containing `now`. Mirrors the V8
// helper in `aiSuggestionStore.ts` — kept local because `"use node"` modules
// cannot import V8 helpers cleanly.
function getCurrentWeekStart(now: number = Date.now()): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.getTime();
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

type BusinessProfileShape = {
  _id?: string;
  businessName?: string;
  businessType?: string;
  description?: string;
  audience?: string;
  style?: string;
  city?: string;
  services?: string;
  uniqueness?: string;
  goal?: string;
  products?: string;
  updatedAt?: number;
  createdAt?: number;
  websiteSummary?: string;
  websiteServices?: string[];
  websiteKeywords?: string[];
  websiteTone?: string;
} | null;

function buildWeeklySystemPrompt(kind: SuggestionKind): string {
  void kind;
  return (
    'You are the AI marketing manager for Easy-M, an Israeli AI marketing-post generator. ' +
    'Each week you suggest 3–5 personalized post ideas for a specific small business. ' +
    'Return JSON only with the exact shape requested. ' +
    'Each suggestion must include:\n' +
    '  • title — a short, catchy Hebrew headline (2–5 words) the user will see on a card.\n' +
    '  • description — one short Hebrew sentence (≤ 90 chars) explaining the idea.\n' +
    '  • posterType — one of: promotion, brand, product_spotlight, booking, seasonal, question_hook, announcement, reminder, offer.\n' +
    '  • visualStyle — one of: premium, bold, elegant, dramatic, minimal, luxury, friendly, energetic.\n' +
    '  • suggestedGoal — one of: sale, promotion, awareness, booking, holiday, new_product, reminder.\n\n' +
    'Rules:\n' +
    '  • Vary post types across the batch — never repeat the same posterType for every suggestion.\n' +
    '  • Adapt every suggestion to the actual business profile (type, products, audience, tone).\n' +
    '  • Avoid clichés. Avoid repeating ideas from the recent posts list.\n' +
    '  • Hebrew text should be natural Israeli marketing copy — short, energetic, professional.\n' +
    '  • Do not invent fake prices, phone numbers, websites, addresses, or contact details.\n' +
    '  • Keep each title and description short enough to fit on a card.'
  );
}

function buildWeeklyUserPrompt(
  profile: NonNullable<BusinessProfileShape>,
  recentPostSummaries: string[],
): string {
  return (
    `Business name: ${profile.businessName ?? '(unknown)'}\n` +
    `Business type: ${profile.businessType ?? '(unknown)'}\n` +
    `Description: ${profile.description ?? ''}\n` +
    `Target audience: ${profile.audience ?? ''}\n` +
    `Brand tone/style: ${profile.style ?? profile.websiteTone ?? ''}\n` +
    `City: ${profile.city ?? ''}\n` +
    `Services / products: ${
      [profile.services ?? '', ...(profile.websiteServices ?? [])]
        .filter(Boolean)
        .join(', ') || '(unknown)'
    }\n` +
    `What makes the business unique: ${profile.uniqueness ?? ''}\n` +
    `Marketing goal: ${profile.goal ?? ''}\n` +
    `Website summary: ${profile.websiteSummary ?? ''}\n` +
    `Website keywords: ${(profile.websiteKeywords ?? []).join(', ')}\n\n` +
    `Recent posts (avoid repeating these ideas):\n${
      recentPostSummaries.length ? recentPostSummaries.join('\n') : '(none)'
    }\n\n` +
    'Return JSON only:\n' +
    '{\n' +
    '  "suggestions": [\n' +
    '    {\n' +
    '      "title": "...",\n' +
    '      "description": "...",\n' +
    '      "posterType": "promotion | brand | product_spotlight | booking | seasonal | question_hook | announcement | reminder | offer",\n' +
    '      "visualStyle": "premium | bold | elegant | dramatic | minimal | luxury | friendly | energetic",\n' +
    '      "suggestedGoal": "sale | promotion | awareness | booking | holiday | new_product | reminder"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n' +
    `Generate ${MIN_SUGGESTIONS}–${MAX_SUGGESTIONS} suggestions.`
  );
}

function normalizeSuggestions(raw: unknown): GeneratedSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: GeneratedSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const title = cleanString(record.title, 80);
    const description = cleanString(record.description, 200);
    const posterType = cleanString(record.posterType, 40) || 'promotion';
    const visualStyle = cleanString(record.visualStyle, 40) || 'premium';
    const suggestedGoal = cleanString(record.suggestedGoal, 40) || 'awareness';
    if (!title || !description) continue;
    cleaned.push({ title, description, posterType, visualStyle, suggestedGoal });
  }
  return cleaned.slice(0, MAX_SUGGESTIONS);
}

function fallbackSuggestionsForProfile(
  profile: NonNullable<BusinessProfileShape>,
): GeneratedSuggestion[] {
  const businessName = profile.businessName ?? 'העסק שלך';
  const businessType = (profile.businessType ?? '').toLowerCase();
  const corpus = businessType + (profile.services ?? '') + (profile.websiteSummary ?? '');
  const isFood = /(מסעדה|פיצה|סושי|קפה|cafe|restaurant|food)/.test(corpus);
  const isFitness = /(כושר|אימון|gym|fitness)/.test(corpus);
  const isBeauty = /(יופי|קוסמטיקה|מספרה|ציפורניים|beauty|salon)/.test(corpus);

  if (isFood) {
    return [
      { title: 'מנת השבוע', description: 'הצעה מיוחדת מהמטבח שמעלה סקרנות', posterType: 'product_spotlight', visualStyle: 'premium', suggestedGoal: 'awareness' },
      { title: 'מבצע סוף שבוע', description: 'הנחה מוגבלת בזמן שמושכת לקוחות חדשים', posterType: 'offer', visualStyle: 'bold', suggestedGoal: 'sale' },
      { title: 'דייט בלילה', description: 'פוסט אווירה לזוגות עם הזמנה רכה', posterType: 'brand', visualStyle: 'elegant', suggestedGoal: 'booking' },
      { title: 'המלצת השף', description: 'מבט קצר על המנה האהובה של הצוות', posterType: 'product_spotlight', visualStyle: 'luxury', suggestedGoal: 'awareness' },
    ];
  }
  if (isFitness) {
    return [
      { title: 'מוטיבציה לשבוע', description: 'משפט חזק שמניע להתחיל את האימון', posterType: 'brand', visualStyle: 'energetic', suggestedGoal: 'awareness' },
      { title: 'אימון לקיץ', description: 'תוכנית קצרה לתוצאה מורגשת', posterType: 'product_spotlight', visualStyle: 'bold', suggestedGoal: 'promotion' },
      { title: 'טיפ תזונה', description: 'עצה מעשית קצרה לקהל שלכם', posterType: 'announcement', visualStyle: 'friendly', suggestedGoal: 'awareness' },
      { title: 'חודש ראשון חינם', description: 'קמפיין רישום חברים חדשים', posterType: 'offer', visualStyle: 'dramatic', suggestedGoal: 'booking' },
    ];
  }
  if (isBeauty) {
    return [
      { title: 'לפני ואחרי', description: 'תוצאה אמיתית שמדברת בעד עצמה', posterType: 'product_spotlight', visualStyle: 'elegant', suggestedGoal: 'awareness' },
      { title: 'טיפוח עונתי', description: 'המלצה קצרה לשגרת העונה', posterType: 'seasonal', visualStyle: 'luxury', suggestedGoal: 'awareness' },
      { title: 'טיפ יופי', description: 'טיפ מקצועי קצר וברור', posterType: 'announcement', visualStyle: 'minimal', suggestedGoal: 'awareness' },
      { title: 'מבצע על טיפול', description: 'הזמנה לקבוע תור בהטבה', posterType: 'offer', visualStyle: 'premium', suggestedGoal: 'booking' },
    ];
  }
  return [
    { title: 'תזכורת חמה', description: `תזכורת קצרה ללקוחות של ${businessName}`, posterType: 'reminder', visualStyle: 'friendly', suggestedGoal: 'reminder' },
    { title: 'מותג בגובה העיניים', description: 'פוסט מיתוג שמראה ערך מובהק', posterType: 'brand', visualStyle: 'premium', suggestedGoal: 'awareness' },
    { title: 'מבצע השבוע', description: 'הצעה מוגבלת בזמן עם קריאה לפעולה', posterType: 'offer', visualStyle: 'bold', suggestedGoal: 'sale' },
    { title: 'הצגת שירות', description: 'מה השירות שאתם הכי גאים בו השבוע', posterType: 'product_spotlight', visualStyle: 'elegant', suggestedGoal: 'awareness' },
  ];
}

export const generateWeeklySuggestions = action({
  args: {},
  handler: async (ctx): Promise<GeneratedSuggestion[]> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    const profile: BusinessProfileShape = await ctx.runQuery(
      api.businessProfiles.getMyBusinessProfile,
    );
    if (!profile || !profile.businessName) {
      throw new Error('NO_BUSINESS_PROFILE');
    }

    const recentPosts: Array<{ content?: string; captionText?: string; createdAt: number }> = await ctx
      .runQuery(api.posts.listMyRecentPosts, { limit: 8 })
      .catch(() => []);
    const recentPostSummaries = recentPosts
      .map((post) => post.captionText?.trim() || post.content?.trim() || '')
      .filter(Boolean)
      .slice(0, 8);

    const openai = new OpenAI({ apiKey });
    const kind: SuggestionKind = 'weekly';
    const startedAt = Date.now();

    let suggestions: GeneratedSuggestion[] = [];
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildWeeklySystemPrompt(kind) },
          { role: 'user', content: buildWeeklyUserPrompt(profile, recentPostSummaries) },
        ],
        max_tokens: 900,
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '';
      const parsed = parseJsonObject(raw);
      suggestions = normalizeSuggestions(parsed?.suggestions);
    } catch (error) {
      console.error('💡 [aiSuggestions] OpenAI call failed; using fallback', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
    }

    if (suggestions.length < MIN_SUGGESTIONS) {
      console.warn('💡 [aiSuggestions] AI returned too few; topping up from fallback', {
        aiCount: suggestions.length,
      });
      const fallback = fallbackSuggestionsForProfile(profile);
      const seen = new Set(suggestions.map((s) => s.title));
      for (const candidate of fallback) {
        if (suggestions.length >= MAX_SUGGESTIONS) break;
        if (seen.has(candidate.title)) continue;
        suggestions.push(candidate);
        seen.add(candidate.title);
      }
    }

    const weekStartAt = getCurrentWeekStart();
    await ctx.runMutation(internal.aiSuggestionStore.persistBatch, {
      userId: identity.subject,
      weekStartAt,
      kind,
      suggestions,
    });

    console.info('💡 [aiSuggestions] generated weekly batch', {
      kind,
      weekStartAt,
      count: suggestions.length,
      durationMs: Date.now() - startedAt,
    });

    return suggestions;
  },
});
