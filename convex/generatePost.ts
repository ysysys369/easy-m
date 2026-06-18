"use node";
import { v } from 'convex/values';
import type { Uploadable } from 'openai';
import OpenAI, { toFile } from 'openai';
import { api, internal } from './_generated/api';
import { action } from './_generated/server';

type PostImageType = 'photo' | 'designed' | 'premium_ad';
type PostGoal =
  | 'sale'
  | 'awareness'
  | 'booking'
  | 'holiday'
  | 'new_product'
  | 'reminder'
  | 'promotion';
type PosterType =
  | 'promotion'
  | 'brand'
  | 'product_spotlight'
  | 'booking'
  | 'seasonal'
  | 'question_hook'
  | 'announcement'
  | 'reminder'
  | 'offer';
type CreativeVisualStyle =
  | 'premium'
  | 'bold'
  | 'elegant'
  | 'dramatic'
  | 'minimal'
  | 'luxury'
  | 'friendly'
  | 'energetic'
  | 'aggressive'
  | 'clean';
type PosterLanguageMode = 'english' | 'hebrew';
type TextElementRole = 'headline' | 'subheadline' | 'offer' | 'cta' | 'brand_name';
type TextElementImportance = 'primary' | 'secondary' | 'small';
type TextElement = {
  role: TextElementRole;
  text: string;
  importance: TextElementImportance;
};
type LayoutDensity = 'minimal' | 'medium' | 'rich';
type LayoutHierarchy = 'strong' | 'elegant' | 'soft' | 'bold';
type LayoutDirection = {
  density: LayoutDensity;
  hierarchy: LayoutHierarchy;
};
type CreativeTemplate =
  | 'bold_sales'
  | 'elegant_beauty'
  | 'food_promo'
  | 'premium_instagram'
  | 'minimal_luxury';
type PosterStructure =
  | 'bold_promo'
  | 'soft_branding'
  | 'product_spotlight'
  | 'question_hook'
  | 'booking_focused'
  | 'seasonal_mood'
  | 'offer_sale';
type TextPosition = 'top' | 'bottom' | 'right' | 'left' | 'center';
type LogoPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
type CtaPosition = 'bottom' | 'center' | 'bottom-right' | 'bottom-left';
type PosterLayout = {
  text_position: TextPosition;
  logo_position: LogoPosition;
  cta_position: CtaPosition;
  safe_area: string;
};
type PostCreativePlan = {
  poster_type: PosterType;
  visual_style: CreativeVisualStyle;
  tone: string;
  main_message: string;
  text_elements: TextElement[];
  layout_direction: LayoutDirection;
  style_notes: string;
  image_prompt_direction: string;
  language_mode: PosterLanguageMode;
  show_cta: boolean;
  poster_structure: PosterStructure;
  layout: PosterLayout;
};
// Each PosterTemplate represents a distinct industry creative direction:
// unique photography, palette, typography, CTA, and composition. Templates
// are intentionally narrow so two different industries never look alike.
type PosterTemplate =
  | 'sushi_delivery'
  | 'restaurant_promo'
  | 'pizza_promo'
  | 'cafe_bakery'
  | 'gym_campaign'
  | 'beauty_luxury'
  | 'nails_manicure'
  | 'hair_barber'
  | 'fashion_boutique'
  | 'real_estate'
  | 'legal_corporate'
  | 'judaica_luxury'
  | 'retail_product'
  | 'general_business_ad';

type BusinessProfile = {
  businessName?: string;
  businessType?: string;
  description?: string;
  audience?: string;
  targetAudience?: string;
  style?: string;
  tone?: string;
  brandColors?: string;
  city?: string;
  website?: string;
  websiteUrl?: string;
  phone?: string;
  websiteSummary?: string;
  websiteServices?: string[];
  websiteKeywords?: string[];
  websiteTone?: string;
  lastWebsiteScanAt?: number;
  socialInstagram?: string;
  socialFacebook?: string;
  goal?: string;
  postGoal?: PostGoal | string;
  services?: string;
  products?: string;
  uniqueness?: string;
  logoUrl?: string;
  images?: string[];
  uploadedImages?: string[];
  postImageType?: PostImageType;
} | null;

const ENABLE_DEV_GENERATION_LOGS =
  process.env.EASY_M_DEV_GENERATION_LOGS === 'true' &&
  process.env.EASY_M_RUNTIME_ENV === 'development' &&
  process.env.NODE_ENV !== 'production';

function devInfo(message: string, payload?: unknown): void {
  if (ENABLE_DEV_GENERATION_LOGS) {
    console.info(message, payload ?? '');
  }
}

function devWarn(message: string, payload?: unknown): void {
  if (ENABLE_DEV_GENERATION_LOGS) {
    console.warn(message, payload ?? '');
  }
}

function devError(message: string, payload?: unknown): void {
  if (ENABLE_DEV_GENERATION_LOGS) {
    console.error(message, payload ?? '');
  }
}

type BrandAssetInsight = {
  visualSummary: string;
  visualStyleSummary?: string;
  productHints: string[];
  atmosphereHints?: string[];
  lightingHints?: string[];
  compositionHints?: string[];
  colorHints?: string[];
  textureHints?: string[];
  brandingHints?: string[];
  avoidHints?: string[];
  analyzedImageCount: number;
  imageContextUsed: boolean;
};

type CompositionStrategy = 'complete_image' | 'background_with_overlay';

const HEBREW_RE = /[֐-׿יִ-ﭏ]+/g;
const BEST_OPENAI_IMAGE_MODEL = 'gpt-image-2';

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripHebrewForImagePrompt(value: string | undefined): string {
  return (value ?? '')
    .replace(HEBREW_RE, ' ')
    .replace(/[•—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function englishOnlyOrEmpty(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw || HEBREW_RE.test(raw)) return '';
  return raw;
}

function buildBusinessContext(p: BusinessProfile): string {
  if (!p) return '';
  const lines: string[] = [];
  const website = p.websiteUrl ?? p.website;
  if (p.businessName)    lines.push(`שם העסק: ${p.businessName}`);
  if (p.businessType)    lines.push(`סוג העסק: ${p.businessType}`);
  if (p.description)     lines.push(`תיאור: ${p.description}`);
  if (p.audience ?? p.targetAudience) {
    lines.push(`קהל יעד: ${p.audience ?? p.targetAudience}`);
  }
  if (p.style ?? p.tone) lines.push(`סגנון/טון מועדף: ${p.style ?? p.tone}`);
  if (p.brandColors)     lines.push(`צבעי מותג: ${p.brandColors}`);
  if (p.city)            lines.push(`אזור: ${p.city}`);
  if (p.services)        lines.push(`שירותים/מוצרים: ${p.services}`);
  if (p.products)        lines.push(`מוצרים: ${p.products}`);
  if (p.uniqueness)      lines.push(`מה מיוחד: ${p.uniqueness}`);
  if (p.goal ?? p.postGoal) lines.push(`מטרת הפוסט: ${p.goal ?? p.postGoal}`);
  if (website)           lines.push(`אתר: ${website}`);
  if (p.phone)           lines.push(`טלפון: ${p.phone}`);
  if (p.websiteSummary)  lines.push(`סיכום האתר: ${p.websiteSummary}`);
  if (p.websiteServices?.length) {
    lines.push(`שירותים/מוצרים שזוהו באתר: ${p.websiteServices.join(', ')}`);
  }
  if (p.websiteKeywords?.length) {
    lines.push(`מילות מפתח מהאתר: ${p.websiteKeywords.join(', ')}`);
  }
  if (p.websiteTone)     lines.push(`טון שזוהה באתר: ${p.websiteTone}`);
  if (p.socialInstagram) lines.push(`אינסטגרם: ${p.socialInstagram}`);
  if (p.socialFacebook)  lines.push(`פייסבוק: ${p.socialFacebook}`);
  if (p.logoUrl)         lines.push('יש לוגו עסקי שהאפליקציה תוסיף לפוסטר');
  if ((p.images?.length ?? 0) + (p.uploadedImages?.length ?? 0) > 0) {
    lines.push(`תמונות עסק שהועלו: ${(p.images?.length ?? 0) + (p.uploadedImages?.length ?? 0)}`);
  }
  return lines.join('\n');
}

function buildEnglishVisualContext(p: BusinessProfile): string {
  if (!p) return '';
  const parts: string[] = [];
  const websiteServices = dedupe([...(p.websiteServices ?? []), p.services ?? '']);
  if (p.businessName) parts.push(`Business name: "${p.businessName}" — this is a personalized ad for THIS specific business`);
  if (p.businessType) parts.push(`Business type: ${p.businessType}`);
  if (websiteServices.length) {
    parts.push(`Services/products offered (MUST be visible in the scene): ${websiteServices.join(', ')}`);
  }
  if (p.products)   parts.push(`Products: ${p.products}`);
  if (p.uniqueness)   parts.push(`What makes this business unique (highlight visually): ${p.uniqueness}`);
  if (p.audience ?? p.targetAudience) {
    parts.push(`Target audience (the people in the scene should look like them): ${p.audience ?? p.targetAudience}`);
  }
  if (p.style ?? p.tone) {
    parts.push(`Brand tone (drives the entire mood): ${p.style ?? p.tone}`);
  }
  if (p.brandColors) parts.push(`Brand colors: ${p.brandColors}`);
  if (p.websiteTone)  parts.push(`Website tone/style cues: ${p.websiteTone}`);
  if (p.city)         parts.push(`Location: ${p.city}, Israel — incorporate authentic local environment`);
  if (p.description)  parts.push(`Business description: ${p.description}`);
  if (p.websiteSummary) {
    parts.push(`Website scan summary: ${p.websiteSummary}`);
  }
  if (p.websiteKeywords?.length) {
    parts.push(`Important website keywords: ${p.websiteKeywords.join(', ')}`);
  }
  return parts.join('\n• ');
}

// ─── Visual style per business type ─────────────────────────────────────────
// Maps Hebrew business-type labels to industry-specific photography direction.
// Matching is substring-based to tolerate emojis and minor wording variants.
type BusinessStyle = { category: string; direction: string };

const BUSINESS_STYLE_MAP: { match: string[]; style: BusinessStyle }[] = [
  {
    match: [
      'מסעדה',
      'בית קפה',
      'אוכל',
      'קפה',
      'מאפיה',
      'סושי',
      'restaurant',
      'cafe',
      'sushi',
    ],
    style: {
      category: 'food photography',
      direction:
        'Professional FOOD PHOTOGRAPHY aesthetic. Warm golden tungsten lighting, ' +
        'extreme close-up macro of textures (melting cheese, steam, glistening sauce, fresh herbs, charred edges). ' +
        'Rustic wooden surfaces or marble. Hands plating or reaching in. Backlit steam wisps. ' +
        'Earthy palette: amber, terracotta, deep green. Appetizing, mouthwatering, hyper-tactile.',
    },
  },
  {
    match: ['כושר', 'ספורט', 'אימון', 'fitness', 'gym'],
    style: {
      category: 'fitness / sports',
      direction:
        'High-energy FITNESS / SPORTS photography. Dynamic frozen-motion captures of movement — ' +
        'sweat droplets in mid-air, muscle tension, athletic form. Strong directional lighting with hard shadows. ' +
        'Industrial gym environment or outdoor urban setting. Bold contrast palette: black, charcoal, electric accent color. ' +
        'Powerful, raw, motivational, kinetic energy.',
    },
  },
  {
    match: ['קוסמטיקה', 'יופי', 'איפור', 'beauty', 'cosmetics', 'spa'],
    style: {
      category: 'beauty / luxury',
      direction:
        'Luxury BEAUTY / EDITORIAL aesthetic. Soft diffused lighting, large softbox or natural window light. ' +
        'Clean minimal background — cream, blush, ivory, soft pastels. Glowing dewy skin texture. ' +
        'Marble, glass, silk, brass details. Hands gently applying product. Negative space. ' +
        'Premium luxury vibe, polished, serene, magazine-cover quality.',
    },
  },
  {
    match: ['ציפורניים', 'מניקור', 'nails'],
    style: {
      category: 'nails / manicure',
      direction:
        'Hyper-detailed NAIL photography. Macro close-up of glossy lacquered nails with perfect reflections. ' +
        'Elegant hand poses, jewelry accents, soft silk or velvet backdrop. ' +
        'Pastel or jewel-tone palette. Bright soft beauty lighting with subtle highlights. ' +
        'Luxurious, refined, tactile.',
    },
  },
  {
    match: ['מספרה', 'תספורת', 'barber', 'hair'],
    style: {
      category: 'hair / barbershop',
      direction:
        'Editorial BARBER / HAIR SALON portrait. Stylized portrait with crisp haircut detail visible. ' +
        'Salon environment in background — chairs, mirrors, scissors, warm vintage lighting. ' +
        'Cinematic rim light separating subject. Confident expression. ' +
        'Rich warm palette: amber, leather brown, deep navy.',
    },
  },
  {
    match: ['חנות', 'קמעונאות', 'retail', 'shop', 'store'],
    style: {
      category: 'retail / product',
      direction:
        'RETAIL lifestyle photography. Product styled in an authentic in-use moment — ' +
        'customer holding, examining, smiling. Bright airy store interior or curated flat-lay. ' +
        'Clean modern palette, soft natural daylight. Brand-consistent props. ' +
        'Aspirational and approachable.',
    },
  },
  {
    match: ['שירותים מקצועיים', 'עורך דין', 'רואה חשבון', 'יועץ', 'professional'],
    style: {
      category: 'professional services',
      direction:
        'Premium CORPORATE / PROFESSIONAL photography. Modern minimalist office or co-working space. ' +
        'Confident, trustworthy human portrait — direct eye contact, warm authentic smile, polished business attire. ' +
        'Clean palette: navy, white, soft grey, subtle wood tones. Soft natural window light. ' +
        'Conveys expertise, reliability, calm authority.',
    },
  },
  {
    match: ['נדל', 'דירה', 'בית', 'real estate', 'property'],
    style: {
      category: 'real estate / architecture',
      direction:
        'Architectural REAL ESTATE photography. Wide-angle interior or exterior at golden hour. ' +
        'Perfectly lit space — natural light streaming through windows, warm practical lamps glowing. ' +
        'Clean staged composition, leading lines, spaciousness emphasized. ' +
        'Aspirational lifestyle palette. Real-estate-magazine quality.',
    },
  },
  {
    match: ['טכנולוגיה', 'דיגיטל', 'tech', 'startup', 'software'],
    style: {
      category: 'tech / modern',
      direction:
        'Modern TECH / STARTUP aesthetic. Minimalist composition, clean geometric lines, ' +
        'modern devices on a tidy desk, focused person working. ' +
        'Cool palette: white, silver, deep blue, soft purple accents. ' +
        'Bright airy daylight or cool LED office light. Sleek, future-forward, premium.',
    },
  },
  {
    match: ['חינוך', 'הדרכה', 'education', 'training'],
    style: {
      category: 'education',
      direction:
        'Warm EDUCATION lifestyle photography. Authentic moment of learning — student engaged, teacher guiding, ' +
        'books or laptop in frame. Bright welcoming environment. ' +
        'Soft natural light. Optimistic palette: warm whites, light wood, mustard accents. ' +
        'Encouraging, human, inspiring.',
    },
  },
];

// ─── Short, image-prompt-friendly business identity summary ───────────────
// Used in the final image prompt to keep the image model anchored to THIS business
function buildBusinessIdentitySummary(p: BusinessProfile): string {
  if (!p) return '';
  const bits: string[] = [];
  if (p.businessType) bits.push(p.businessType);
  const offering = dedupe([p.services ?? '', ...(p.websiteServices ?? [])]).join(', ');
  if (offering)       bits.push(`offering: ${offering}`);
  if (p.audience)     bits.push(`for ${p.audience}`);
  if (p.style || p.websiteTone) {
    bits.push(`${p.style ?? p.websiteTone} tone`);
  }
  if (p.city)         bits.push(`in ${p.city}`);
  const summary = bits.join(', ');
  return p.businessName
    ? `This is a tailored marketing visual for "${p.businessName}" — a ${summary}.`
    : `This is a tailored marketing visual for a ${summary}.`;
}

function getStyleByBusinessType(businessType?: string): BusinessStyle | null {
  if (!businessType) return null;
  const lower = businessType.toLowerCase();
  for (const entry of BUSINESS_STYLE_MAP) {
    if (entry.match.some((kw) => lower.includes(kw.toLowerCase()))) {
      return entry.style;
    }
  }
  return null;
}

// Industry detection that falls back to the full website-scan corpus when the
// user hasn't entered a `businessType`. This ensures a sushi restaurant whose
// type field is blank but whose scanned website mentions "סושי" still routes
// to the food / sushi visual mandate.
function resolveBusinessStyle(p: NonNullable<BusinessProfile>): BusinessStyle | null {
  const direct = getStyleByBusinessType(p.businessType);
  if (direct) return direct;

  const corpus = buildBusinessTextCorpus(p);
  if (!corpus) return null;
  for (const entry of BUSINESS_STYLE_MAP) {
    if (entry.match.some((kw) => corpus.includes(kw.toLowerCase()))) {
      return entry.style;
    }
  }
  return null;
}

// ─── Weighted random pick utility ─────────────────────────────────────────
function weightedPick<T extends { name: string }>(
  items: ReadonlyArray<T>,
  weights: ReadonlyArray<number>,
): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── VISUAL FOCUS: what the camera shows ─────────────────────────────────
// This is the most important axis for breaking the "person holding product"
// cliché. Most weights favor product/environment/craft — people are rare.
const VISUAL_FOCUSES = [
  {
    name: 'product',
    direction:
      'PRODUCT-FOCUSED frame. The product/dish/item being sold is the unmistakable hero — ' +
      'NO PEOPLE in the frame. Beautifully styled and lit against a fitting background or surface. ' +
      'The composition should make the viewer want to buy/taste/own the thing itself.',
  },
  {
    name: 'environment',
    direction:
      'ENVIRONMENT-FOCUSED frame. The physical space, interior, or atmosphere IS the subject. ' +
      'NO PEOPLE in the frame (or at most a tiny distant silhouette). ' +
      'Focus on inviting details — light through windows, textures, decor, layout, materials.',
  },
  {
    name: 'craft',
    direction:
      'CRAFT / PROCESS-FOCUSED frame. Close-up on skilled hands at work, tools in motion, ' +
      'or materials being shaped. NO FACES shown — hands and craft only. ' +
      'Conveys expertise and quality purely through detail.',
  },
  {
    name: 'human-subtle',
    direction:
      'SUBTLE HUMAN PRESENCE. A person appears but is NOT the hero — ' +
      'distant figure, back of head, hand reaching in, silhouette, blurred motion, or fragment. ' +
      'Never a smiling face directly to camera. The product/space remains the real subject.',
  },
  {
    name: 'human-hero',
    direction:
      'HUMAN HERO frame. A real authentic person is the subject — mid-action, candid emotion, never posed. ' +
      'AVOID at all costs the "smiling person holding product to camera" cliché. ' +
      'Document a real moment: training, cooking, working, treating, building, eating, browsing — captured naturally.',
  },
] as const;

type VisualFocusName = (typeof VISUAL_FOCUSES)[number]['name'];

// Weights are in order: [product, environment, craft, human-subtle, human-hero]
// Heavily biased away from people for most categories.
const FOCUS_WEIGHTS_BY_CATEGORY: Record<string, ReadonlyArray<number>> = {
  // Restaurants/cafes → food is the hero
  'food photography':     [55, 20, 15, 7, 3],
  // Beauty/spa → space + tools + occasional hands
  'beauty / luxury':      [30, 35, 20, 10, 5],
  'nails / manicure':     [40, 25, 25, 7, 3],
  'hair / barbershop':    [25, 35, 20, 10, 10],
  // Retail/product brands → product hero
  'retail / product':     [55, 25, 10, 7, 3],
  // Professional services → environment heavy
  'professional services':[15, 50, 15, 15, 5],
  // Real estate → architecture only
  'real estate / architecture': [10, 75, 5, 8, 2],
  // Tech → devices + environment
  'tech / modern':        [40, 35, 10, 10, 5],
  // Education → environment + occasional people
  'education':            [20, 40, 15, 15, 10],
  // Fitness → mix (action shots matter here)
  'fitness / sports':     [25, 35, 10, 15, 15],
};
// Fallback when no category match — slight people-shy default
const FOCUS_WEIGHTS_DEFAULT: ReadonlyArray<number> = [35, 30, 15, 12, 8];

function pickVisualFocus(category: string | null) {
  const weights = (category && FOCUS_WEIGHTS_BY_CATEGORY[category]) || FOCUS_WEIGHTS_DEFAULT;
  return weightedPick(VISUAL_FOCUSES, weights);
}

// ─── STYLE TREATMENT: aesthetic / look (rotated freely) ────────────────────
const STYLE_TREATMENTS = [
  {
    name: 'close-up',
    direction:
      'extreme close-up macro framing — intimate texture detail, shallow focus, every surface visible.',
  },
  {
    name: 'cinematic',
    direction:
      'cinematic film-still aesthetic — anamorphic feel, color graded like a movie, narrative tension.',
  },
  {
    name: 'luxury',
    direction:
      'luxury editorial magazine style — refined elegance, premium brand campaign, high-end materials.',
  },
  {
    name: 'product-shot',
    direction:
      'clean studio product shot — controlled professional lighting, soft seamless background, e-commerce hero quality.',
  },
  {
    name: 'flat-lay',
    direction:
      'flat lay overhead arrangement — styled top-down composition with intentional negative space and color harmony.',
  },
  {
    name: 'interior',
    direction:
      'architectural interior photography — wide spatial composition, atmospheric depth, natural light through the space.',
  },
  {
    name: 'moody-lighting',
    direction:
      'moody dramatic lighting — deep shadows, single warm key light, atmospheric and intimate.',
  },
  {
    name: 'modern-commercial-ad',
    direction:
      'modern commercial advertising look — bold and confident, contemporary brand aesthetic, scroll-stopping graphic energy.',
  },
] as const;

function pickStyleTreatment() {
  return STYLE_TREATMENTS[Math.floor(Math.random() * STYLE_TREATMENTS.length)];
}

// ─── Composition rotation: HOW the camera frames it ──────────────────────
// All shot types are now people-neutral — none mandate a human subject.
const SHOT_TYPES = [
  {
    name: 'close-up-macro',
    direction:
      'TIGHT CLOSE-UP / MACRO. Subject fills 70% of the frame. ' +
      'Hyper-detailed texture and intimate focus. Buttery bokeh background. ' +
      'f/1.8 aperture, extreme shallow depth of field.',
  },
  {
    name: 'wide-environmental',
    direction:
      'WIDE ENVIRONMENTAL shot. Show the full scene with rich context and depth. ' +
      'Subject placed using rule of thirds. Layers from foreground to background. ' +
      '35mm lens, f/4.',
  },
  {
    name: 'flat-lay-overhead',
    direction:
      'TOP-DOWN FLAT-LAY composition shot directly from above. ' +
      'Carefully styled arrangement with intentional negative space and color harmony. ' +
      '50mm at 90° angle.',
  },
  {
    name: 'editorial-bold',
    direction:
      'EDITORIAL FASHION-MAGAZINE composition. Bold framing with strong negative space. ' +
      'Single hero subject, dramatic lighting contrast. 85mm lens, f/1.4.',
  },
  {
    name: 'detail-texture',
    direction:
      'DETAIL / TEXTURE shot. Tight crop on materials, surface, finish, or pattern. ' +
      'Light raked across the surface to bring out depth. 100mm macro, f/4.',
  },
  {
    name: 'angled-cinematic',
    direction:
      'CINEMATIC ANGLED shot — slight tilt, three-quarter perspective, foreground element for depth. ' +
      'Film-still framing. 35mm lens, f/2.0.',
  },
  {
    name: 'symmetric-hero',
    direction:
      'SYMMETRIC HERO composition — subject centered, surrounded by negative space, ' +
      'creating reverence and focus. 50mm lens, f/2.8.',
  },
];

function pickShotType() {
  return SHOT_TYPES[Math.floor(Math.random() * SHOT_TYPES.length)];
}

// ─── Marketing angle: WHY this image sells ────────────────────────────────
// Every ad needs a selling hook. ALL angles are people-optional — the actual
// human presence is controlled by the VISUAL_FOCUS axis above, not here.
const MARKETING_ANGLES = [
  {
    name: 'hero-product',
    direction:
      'HERO PRODUCT MOMENT — the product/dish/item as the unmistakable star. ' +
      'Beautifully styled, dramatically lit, the single focus that says "want this." ' +
      'Pure desirability, frame-worthy.',
  },
  {
    name: 'desire-trigger',
    direction:
      'DESIRE TRIGGER — capture the exact visual moment that creates instant want. ' +
      'Steam rising, cheese pulling, light catching glass, color popping, texture inviting touch. ' +
      'A frozen moment of irresistible appeal.',
  },
  {
    name: 'atmosphere-mood',
    direction:
      'ATMOSPHERE & MOOD — sell the feeling of the place or experience without showing it overtly. ' +
      'Warm light, inviting space, intimate corner, lived-in details. ' +
      'The viewer feels they want to step inside.',
  },
  {
    name: 'craftsmanship-detail',
    direction:
      'CRAFTSMANSHIP & EXPERTISE — show the skill and quality behind the offering. ' +
      'Hands at work, tools in motion, materials being shaped, the process itself. ' +
      'Conveys quality and trust through detail, not faces.',
  },
  {
    name: 'luxury-experience',
    direction:
      'PREMIUM LUXURY FEEL — pure indulgence and refined elegance. ' +
      'High-end materials, controlled lighting, "you deserve this" sophistication. ' +
      'No people needed — the objects and space speak luxury.',
  },
  {
    name: 'transformation-result',
    direction:
      'TRANSFORMATION / RESULT — show the visible outcome itself. ' +
      'The polished nails, the finished plate, the styled room, the completed product. ' +
      'Let the result speak — no need to show a person.',
  },
  {
    name: 'social-proof-bustle',
    direction:
      'SOCIAL PROOF / BUSTLE — imply popularity through environmental cues. ' +
      'A full menu, a busy counter, evidence of activity, traces of customers. ' +
      'The viewer senses "everyone is here" without needing crowds in frame.',
  },
  {
    name: 'authentic-moment',
    direction:
      'AUTHENTIC CANDID MOMENT — a real slice-of-life detail that feels documentary. ' +
      'Not staged, not posed. Could be a product mid-use, a candid hand, a real environmental detail.',
  },
];

function pickMarketingAngle() {
  return MARKETING_ANGLES[Math.floor(Math.random() * MARKETING_ANGLES.length)];
}

// ─── Per-business Visual Identity (LOCKED, not randomized) ─────────────────
// Each business gets a consistent look: color palette + lighting + mood.
// Locking these means posts feel like they're from the same brand.
// Composition and marketing angle still rotate for post-to-post variety.
type VisualIdentity = {
  name: string;
  colorPalette: string;
  lightingStyle: string;
  mood: string;
};

const STYLE_IDENTITIES: Record<string, VisualIdentity[]> = {
  // יוקרתי — luxury
  'יוקרתי': [
    {
      name: 'warm-luxury',
      colorPalette: 'Warm luxury palette — champagne, cream, soft gold, ivory, deep cognac brown',
      lightingStyle: 'Soft diffused window light, gentle warm highlights, subtle glow, no harsh shadows, minimal and elegant',
      mood: 'Elegant, refined, indulgent, magazine-cover sophistication',
    },
    {
      name: 'cool-luxury',
      colorPalette: 'Cool luxury palette — pearl white, soft grey, brushed silver, deep navy, jet-black accents',
      lightingStyle: 'Clean studio softbox lighting, even and minimal, crisp soft shadow falloff, architectural',
      mood: 'Minimalist, architectural, premium, quietly powerful',
    },
  ],
  // מצחיק — fun / playful
  'מצחיק': [
    {
      name: 'playful-vibrant',
      colorPalette: 'Vibrant playful palette — sunshine yellow, coral pink, mint green, sky blue, pop accents',
      lightingStyle: 'Bright high-key lighting, even and cheerful, soft fill, almost no deep shadows',
      mood: 'Playful, energetic, joyful, smile-inducing, bursting with personality',
    },
  ],
  // מקצועי — professional
  'מקצועי': [
    {
      name: 'corporate-clean',
      colorPalette: 'Professional palette — crisp white, deep navy, slate grey, subtle warm wood accent',
      lightingStyle: 'Clean even daylight, balanced soft exposure, neutral white balance, polished',
      mood: 'Polished, trustworthy, confident, focused, calm authority',
    },
  ],
  // צעיר — young / energetic
  'צעיר': [
    {
      name: 'bold-dynamic',
      colorPalette: 'Bold dynamic palette — electric blue, vivid orange accent, charcoal black, white highlights',
      lightingStyle: 'Strong directional lighting with hard shadows, rim light separation, high contrast, energetic',
      mood: 'Energetic, edgy, confident, kinetic, bold',
    },
    {
      name: 'sunset-fresh',
      colorPalette: 'Fresh youthful palette — coral, peach, lavender, golden hour glow, gradient sky tones',
      lightingStyle: 'Golden-hour or late-afternoon sunlight, warm glow, subtle lens flare, lively',
      mood: 'Optimistic, free-spirited, aspirational, alive, sunlit',
    },
  ],
  // רגוע — calm / serene
  'רגוע': [
    {
      name: 'natural-serene',
      colorPalette: 'Calm natural palette — sage green, beige, terracotta, cream, earthy organic tones',
      lightingStyle: 'Soft natural overcast or window light, gentle balanced shadows, no extremes',
      mood: 'Serene, grounded, calm, mindful, breathable',
    },
  ],
};

// Fallback identity when style is unknown / missing
const DEFAULT_IDENTITY: VisualIdentity = {
  name: 'editorial-neutral',
  colorPalette: 'Balanced contemporary palette — neutral warm tones, modern accent color, natural skin tones',
  lightingStyle: 'Soft natural daylight, balanced exposure, gentle directional shadows',
  mood: 'Authentic, premium, contemporary, approachable',
};

// Simple deterministic hash so each businessName picks a stable variant
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getVisualIdentityForBusiness(p: BusinessProfile): VisualIdentity {
  if (!p) return DEFAULT_IDENTITY;
  const variants = (p.style && STYLE_IDENTITIES[p.style]) || null;
  if (!variants || variants.length === 0) return DEFAULT_IDENTITY;
  // Deterministic — same business always gets the same identity variant
  const seed = hashString(p.businessName ?? p.style ?? 'default');
  return variants[seed % variants.length];
}

function validRemoteImageUrls(values: Array<string | undefined>): string[] {
  return dedupe(values.filter((value): value is string => Boolean(value))).filter((url) =>
    /^https?:\/\//i.test(url),
  );
}

function collectUploadedBusinessImageUrls(p: BusinessProfile): string[] {
  if (!p) return [];
  return validRemoteImageUrls([
    ...(p.uploadedImages ?? []),
    ...(p.images ?? []),
  ]).slice(0, 6);
}

function collectBrandAssetUrls(p: BusinessProfile): string[] {
  if (!p) return [];
  const businessImages = collectUploadedBusinessImageUrls(p);
  const logoUrls = validRemoteImageUrls([p.logoUrl]).slice(0, 1);

  return dedupe([...businessImages, ...logoUrls]).slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// COST TRACKING
// All figures are estimates based on published OpenAI pricing.
// Update TEXT_PRICING / IMAGE_PRICING if OpenAI changes rates.
// These logs are server-side only — never sent to the client or shown to users.
// ─────────────────────────────────────────────────────────────────────────────

type TextCallCost = {
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
};

type ImageCallCost = {
  step: string;
  model: string;
  operation: 'generate' | 'edit';
  estimatedUsd: number;
};

type CostAccumulator = {
  textCalls: TextCallCost[];
  imageCalls: ImageCallCost[];
};

// USD per 1M tokens — update when OpenAI changes pricing
const TEXT_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o-mini': { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gpt-4o':      { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini-2024-07-18': { inputPer1M: 0.15, outputPer1M: 0.60 },
};

// USD per image at 1024×1024 high quality — update when OpenAI changes pricing
const IMAGE_PRICING: Record<string, { generate: number; edit: number }> = {
  'gpt-image-2':   { generate: 0.04, edit: 0.06 },
};

function trackTextCost(
  acc: CostAccumulator,
  step: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
): void {
  const inputTokens  = usage?.prompt_tokens     ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const p = TEXT_PRICING[model] ?? TEXT_PRICING['gpt-4o-mini'];
  const estimatedUsd = (inputTokens * p.inputPer1M + outputTokens * p.outputPer1M) / 1_000_000;
  acc.textCalls.push({ step, model, inputTokens, outputTokens, estimatedUsd });
}

function trackImageCost(
  acc: CostAccumulator,
  step: string,
  model: string,
  operation: 'generate' | 'edit',
): void {
  const p = IMAGE_PRICING[model] ?? IMAGE_PRICING[BEST_OPENAI_IMAGE_MODEL];
  acc.imageCalls.push({ step, model, operation, estimatedUsd: p[operation] });
}

type CostSummary = {
  textCalls: TextCallCost[];
  imageCalls: ImageCallCost[];
  totalTextInputTokens: number;
  totalTextOutputTokens: number;
  textModels: string;
  imageModels: string;
  totalTextUsd: number;
  totalImageUsd: number;
  totalUsd: number;
};

function summarizeCosts(acc: CostAccumulator): CostSummary {
  const totalTextInputTokens  = acc.textCalls.reduce((s, c) => s + c.inputTokens,  0);
  const totalTextOutputTokens = acc.textCalls.reduce((s, c) => s + c.outputTokens, 0);
  const totalTextUsd  = acc.textCalls.reduce((s, c) => s + c.estimatedUsd, 0);
  const totalImageUsd = acc.imageCalls.reduce((s, c) => s + c.estimatedUsd, 0);
  const textModels  = [...new Set(acc.textCalls.map((c) => c.model))].join(', ');
  const imageModels = [...new Set(acc.imageCalls.map((c) => c.model))].join(', ');
  return {
    textCalls: acc.textCalls,
    imageCalls: acc.imageCalls,
    totalTextInputTokens,
    totalTextOutputTokens,
    textModels,
    imageModels,
    totalTextUsd,
    totalImageUsd,
    totalUsd: totalTextUsd + totalImageUsd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function analyzeBrandAssets(
  openai: OpenAI,
  profile: BusinessProfile,
  acc: CostAccumulator,
): Promise<BrandAssetInsight | null> {
  const assetUrls = collectBrandAssetUrls(profile);
  const uploadedBusinessImageCount = collectUploadedBusinessImageUrls(profile).length;
  if (!assetUrls.length) return null;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You analyze brand visuals for a small business and return JSON only. ' +
            'Return an object with keys: visualSummary, visualStyleSummary, productHints, atmosphereHints, lightingHints, compositionHints, colorHints, textureHints, brandingHints, avoidHints. ' +
            'Use uploaded business photos as authenticity references for future ads: real products, space, materials, colors, lighting, brand mood, audience, and composition. ' +
            'Do NOT suggest copying or pasting the exact uploaded photos into ads; convert them into reusable visual inspiration and art direction. ' +
            'visualSummary should be 2 short English sentences describing branding, colors, setting, products, and overall vibe. ' +
            'visualStyleSummary should be one compact English phrase describing the extracted campaign style, such as "glossy nude manicure with soft salon lighting" or "dark industrial gym energy". ' +
            'productHints should be up to 6 short English phrases about visible products/services/items that should appear in future ads. ' +
            'atmosphereHints should be up to 4 cues about the mood and customer feeling. lightingHints should be up to 4 cues about lighting direction and quality. ' +
            'compositionHints should be up to 5 practical art-direction cues from the images, such as best crop, hero angle, negative space, background style, foreground/background relation. ' +
            'colorHints should be up to 4 real palette/material cues. textureHints should be up to 4 tactile details to make ads feel realistic. ' +
            'brandingHints should be up to 4 reusable brand consistency cues. avoidHints should be up to 4 issues to avoid if the uploaded images are cluttered, low quality, off-brand, or visually confusing. Do not invent facts.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Business name: ${profile?.businessName ?? ''}\n` +
                `Business type: ${profile?.businessType ?? ''}\n` +
                `Known services: ${profile?.services ?? ''}\n` +
                `Business photos included first: ${uploadedBusinessImageCount}\n` +
                'Analyze these uploaded business images deeply and infer visual inspiration for future marketing posts. Prioritize actual business photos over the logo if both appear.',
            },
            ...assetUrls.map((url) => ({
              type: 'image_url' as const,
              image_url: { url },
            })),
          ],
        },
      ],
      max_tokens: 350,
    });

    trackTextCost(acc, 'asset_analysis', 'gpt-4o-mini', response.usage);

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      visualSummary?: string;
      visualStyleSummary?: string;
      productHints?: string[];
      atmosphereHints?: string[];
      lightingHints?: string[];
      compositionHints?: string[];
      colorHints?: string[];
      textureHints?: string[];
      brandingHints?: string[];
      avoidHints?: string[];
    };

    const visualSummary = parsed.visualSummary?.trim();
    const visualStyleSummary = parsed.visualStyleSummary?.trim();
    const cleanHintArray = (value: unknown, maxItems: number) =>
      Array.isArray(value)
        ? dedupe(value.map((item) => String(item))).slice(0, maxItems)
        : [];
    const productHints = cleanHintArray(parsed.productHints, 6);
    const atmosphereHints = cleanHintArray(parsed.atmosphereHints, 4);
    const lightingHints = cleanHintArray(parsed.lightingHints, 4);
    const compositionHints = cleanHintArray(parsed.compositionHints, 5);
    const colorHints = cleanHintArray(parsed.colorHints, 4);
    const textureHints = cleanHintArray(parsed.textureHints, 4);
    const brandingHints = cleanHintArray(parsed.brandingHints, 4);
    const avoidHints = cleanHintArray(parsed.avoidHints, 4);

    if (
      !visualSummary &&
      !visualStyleSummary &&
      !productHints.length &&
      !atmosphereHints.length &&
      !lightingHints.length &&
      !compositionHints.length &&
      !colorHints.length &&
      !textureHints.length &&
      !brandingHints.length
    ) return null;

    return {
      visualSummary: visualSummary ?? '',
      visualStyleSummary: visualStyleSummary ?? '',
      productHints,
      atmosphereHints,
      lightingHints,
      compositionHints,
      colorHints,
      textureHints,
      brandingHints,
      avoidHints,
      analyzedImageCount: assetUrls.length,
      imageContextUsed: assetUrls.length > 0,
    };
  } catch (error) {
    const isApiError = error != null && typeof error === 'object' && 'status' in error;
    const status  = isApiError ? (error as { status?: number }).status : undefined;
    const errCode = isApiError ? (error as { code?: string }).code : undefined;
    const rawMsg  = error instanceof Error ? error.message : String(error);
    const innerMsg = isApiError
      ? ((error as { error?: { message?: string } }).error?.message ?? null)
      : null;
    devError('🔴 [analyzeBrandAssets] OpenAI call FAILED — returning null', {
      httpStatus: status ?? null,
      errorCode: errCode ?? null,
      errorMessage: rawMsg,
      innerMessage: innerMsg,
    });
    return null;
  }
}

// ─── Poster text
// For designed/premium_ad, OpenAI Image API creates a complete final poster.
// These fields are still returned for preview metadata and for the legacy
// overlay renderer, but the active Create Post flow saves the OpenAI poster.
type PosterText = {
  headline: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  offer?: string;
  footer?: string;
};

function buildBusinessTextCorpus(p: BusinessProfile): string {
  if (!p) return '';
  return [
    p.businessName,
    p.businessType,
    p.description,
    p.audience,
    p.targetAudience,
    p.style,
    p.tone,
    p.brandColors,
    p.city,
    p.services,
    p.products,
    p.uniqueness,
    p.goal,
    p.postGoal,
    p.websiteSummary,
    p.websiteTone,
    ...(p.websiteServices ?? []),
    ...(p.websiteKeywords ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function businessMatchesAny(p: BusinessProfile, terms: string[]): boolean {
  const corpus = buildBusinessTextCorpus(p);
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}

function isSushiBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, ['סושי', 'sushi', 'סשימי', 'ניגירי', 'מאקי']);
}

function isRestaurantBusiness(
  p: BusinessProfile,
  industryCategory?: string | null,
): boolean {
  return (
    industryCategory === 'food photography' ||
    businessMatchesAny(p, [
      'מסעדה',
      'בית קפה',
      'אוכל',
      'קפה',
      'מאפיה',
      'restaurant',
      'cafe',
      'food',
    ])
  );
}

function isFitnessBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, ['כושר', 'ספורט', 'אימון', 'fitness', 'gym']);
}

function isBeautyBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'קוסמטיקה',
    'יופי',
    'איפור',
    'טיפוח',
    'ביוטי',
    'beauty',
    'cosmetics',
    'spa',
    'nails',
    'salon',
  ]);
}

function isFashionBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'אופנה',
    'בגדים',
    'בוטיק',
    'fashion',
    'clothing',
    'boutique',
    'apparel',
  ]);
}

function isPizzaBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, ['פיצה', 'פיצריה', 'pizza', 'pizzeria']);
}

function isCafeOrBakeryBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'בית קפה',
    'קפה',
    'מאפיה',
    'מאפייה',
    'קונדיטוריה',
    'cafe',
    'café',
    'coffee',
    'bakery',
    'patisserie',
  ]);
}

function isNailsBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, ['ציפורניים', 'מניקור', 'פדיקור', 'nails', 'manicure', 'pedicure']);
}

function isHairOrBarberBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'מספרה',
    'מספרת',
    'תספורת',
    'ברבר',
    'שיער',
    'hair',
    'barber',
    'barbershop',
    'salon',
  ]);
}

function isRealEstateBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'נדל',          // matches נדל"ן with any quote style
    'דירה',
    'דירות',
    'בית למכירה',
    'נכס',
    'real estate',
    'realtor',
    'property',
    'apartment',
  ]);
}

function isLegalOrCorporateBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'עורך דין',
    'עורכת דין',
    'משרד עורכי דין',
    'משפט',
    'רואה חשבון',
    'רו"ח',
    'יועץ מס',
    'יועץ עסקי',
    'יועץ פיננסי',
    'לוביסט',
    'lawyer',
    'attorney',
    'law firm',
    'accountant',
    'consultant',
    'consulting',
    'advisor',
  ]);
}

function isJudaicaBusiness(p: BusinessProfile): boolean {
  return businessMatchesAny(p, [
    'יודאיקה',
    'מזוז',
    'חנוכ',
    'שופר',
    'תשמישי קדושה',
    'judaica',
  ]);
}

function isRetailProductBusiness(
  p: BusinessProfile,
  industryCategory?: string | null,
): boolean {
  return (
    industryCategory === 'retail / product' ||
    businessMatchesAny(p, [
      'חנות',
      'קמעונאות',
      'מותג',
      'shop',
      'store',
      'retail',
      'brand',
    ])
  );
}

// Selection order is intentional — narrower / more visually distinctive
// templates win over broader categories so a "sushi café" routes to sushi,
// not to general restaurant or café.
function selectPosterTemplate(
  p: BusinessProfile,
  industryCategory?: string | null,
): PosterTemplate {
  if (isSushiBusiness(p))                          return 'sushi_delivery';
  if (isPizzaBusiness(p))                          return 'pizza_promo';
  if (isCafeOrBakeryBusiness(p))                   return 'cafe_bakery';
  if (isRestaurantBusiness(p, industryCategory))   return 'restaurant_promo';
  if (isFitnessBusiness(p))                        return 'gym_campaign';
  if (isJudaicaBusiness(p))                        return 'judaica_luxury';
  if (isNailsBusiness(p))                          return 'nails_manicure';
  if (isHairOrBarberBusiness(p))                   return 'hair_barber';
  if (isBeautyBusiness(p))                         return 'beauty_luxury';
  if (isFashionBusiness(p))                        return 'fashion_boutique';
  if (isRealEstateBusiness(p))                     return 'real_estate';
  if (isLegalOrCorporateBusiness(p))               return 'legal_corporate';
  if (isRetailProductBusiness(p, industryCategory)) return 'retail_product';
  return 'general_business_ad';
}

function selectCreativeTemplate(
  p: BusinessProfile,
  postGoal: PostGoal,
  posterTemplate: PosterTemplate,
): CreativeTemplate {
  if (
    posterTemplate === 'sushi_delivery' ||
    posterTemplate === 'pizza_promo' ||
    posterTemplate === 'cafe_bakery' ||
    posterTemplate === 'restaurant_promo'
  ) {
    return 'food_promo';
  }

  if (
    posterTemplate === 'beauty_luxury' ||
    posterTemplate === 'nails_manicure' ||
    posterTemplate === 'hair_barber' ||
    posterTemplate === 'fashion_boutique'
  ) {
    return 'elegant_beauty';
  }

  if (posterTemplate === 'real_estate' || posterTemplate === 'legal_corporate') {
    return 'minimal_luxury';
  }

  if (
    postGoal === 'sale' ||
    postGoal === 'booking' ||
    businessMatchesAny(p, ['כושר', 'ספורט', 'fitness', 'gym', 'מבצע', 'promotion'])
  ) {
    return 'bold_sales';
  }

  if (postGoal === 'awareness' && businessMatchesAny(p, ['יוקרתי', 'luxury', 'premium'])) {
    return 'minimal_luxury';
  }

  return 'premium_instagram';
}

const DEFAULT_CREATIVE_LAYOUTS: Record<CreativeTemplate, PosterLayout> = {
  bold_sales: {
    text_position: 'bottom',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area:
      'Bottom third has a dark gradient and enough clean empty space for a large bold Hebrew headline and CTA button.',
  },
  elegant_beauty: {
    text_position: 'right',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area:
      'Right side has soft clean negative space for elegant RTL Hebrew text without covering the hero subject.',
  },
  food_promo: {
    text_position: 'bottom',
    logo_position: 'top-right',
    cta_position: 'bottom',
    safe_area:
      'Bottom third has intentional dark empty space for bold Hebrew offer text while food remains visible above.',
  },
  premium_instagram: {
    text_position: 'top',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area:
      'Top third has calm clean copy space and the product/service hero remains visible in the center.',
  },
  minimal_luxury: {
    text_position: 'center',
    logo_position: 'top-left',
    cta_position: 'bottom',
    safe_area:
      'Center or lower-center has generous minimal copy space with lots of premium empty area around the text.',
  },
};

function inferPostGoal(
  profile: BusinessProfile,
  topic: string,
  captionText = '',
): PostGoal {
  const corpus = [
    topic,
    captionText,
    profile?.goal ?? '',
    profile?.postGoal ?? '',
    profile?.description ?? '',
    profile?.services ?? '',
    profile?.products ?? '',
  ]
    .join(' ')
    .toLowerCase();

  if (/(חג|holiday|חנוכה|פסח|פורים|ראש השנה|christmas|new year|eid|ramadan)/i.test(corpus)) {
    return 'holiday';
  }
  if (/(חדש|השקה|קולקציה|תפריט חדש|new|launch|collection|new product)/i.test(corpus)) {
    return 'new_product';
  }
  if (/(קידום|promotion|campaign|special offer|promo)/i.test(corpus)) {
    return 'promotion';
  }
  if (/(הנחה|מבצע|sale|discount|deal|coupon|%|1\+1|promo|promotion)/i.test(corpus)) {
    return 'sale';
  }
  if (/(תור|הזמנה|שריינו|קבעו|booking|book|appointment|reservation|schedule)/i.test(corpus)) {
    return 'booking';
  }
  if (/(תזכורת|reminder|last chance|deadline|אל תשכחו|סוף שבוע|today only)/i.test(corpus)) {
    return 'reminder';
  }
  return 'awareness';
}

function buildFooterContact(p: BusinessProfile): string | undefined {
  if (!p) return undefined;
  const phone = p.phone?.trim();
  if (phone) return phone;

  const website = (p.websiteUrl ?? p.website)?.trim();
  if (!website) return undefined;

  return website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/g, '');
}

function buildDefaultPosterFooter(p: BusinessProfile): string | undefined {
  const footerParts = dedupe([
    p?.businessName ?? '',
    buildFooterContact(p) ?? '',
  ]);
  return footerParts.length ? footerParts.join(' | ') : undefined;
}

function buildDefaultCta(
  p: BusinessProfile,
  industryCategory?: string | null,
): string {
  if (isRestaurantBusiness(p, industryCategory)) return 'הזמינו עכשיו';
  if (isFitnessBusiness(p)) {
    return 'התחילו עכשיו';
  }
  if (isBeautyBusiness(p)) {
    return 'קבעו תור';
  }
  if (isFashionBusiness(p) || isRetailProductBusiness(p, industryCategory)) {
    return 'לקנייה עכשיו';
  }
  if (isRealEstateBusiness(p)) {
    return 'תאמו ביקור';
  }
  if (isLegalOrCorporateBusiness(p)) {
    return 'לתיאום שיחה';
  }
  return 'לפרטים';
}

// Short, modern, 2-3 word Hebrew fallback set. Used only when the generator
// model fails to return valid JSON. No offer/promo is invented — only the
// generator can decide if a real offer is part of the post.
function buildFallbackOnImageText(
  p: BusinessProfile,
  industryCategory?: string | null,
  template: PosterTemplate = selectPosterTemplate(p, industryCategory),
): PosterText {
  const footer = buildDefaultPosterFooter(p);

  if (template === 'sushi_delivery') {
    return {
      headline: '10% הנחה',
      subtitle: 'משלוחים עד הבית',
      cta: 'הזמינו עכשיו',
      offer: 'סושי טרי',
      footer,
    };
  }

  if (template === 'restaurant_promo') {
    return {
      headline: 'חדש בתפריט',
      subtitle: 'טרי מהמטבח',
      cta: 'הזמינו עכשיו',
      footer,
    };
  }

  if (template === 'pizza_promo') {
    return {
      headline: 'מבצע השבוע',
      subtitle: 'חם מהתנור',
      cta: 'הזמינו עכשיו',
      offer: '1+1',
      footer,
    };
  }

  if (template === 'cafe_bakery') {
    return {
      headline: 'בוקר מושלם',
      subtitle: 'קפה ומאפה טרי',
      cta: 'בואו לבקר',
      offer: 'טרי היום',
      footer,
    };
  }

  if (template === 'gym_campaign') {
    return {
      headline: 'מתחילים היום',
      subtitle: 'אימון שמתאים לכם',
      cta: 'התחילו עכשיו',
      offer: 'שיעור ניסיון',
      footer,
    };
  }

  if (template === 'beauty_luxury') {
    return {
      headline: 'היופי שלך',
      subtitle: 'טיפול ברמה אחרת',
      cta: 'קבעו תור',
      footer,
    };
  }

  if (template === 'nails_manicure') {
    return {
      headline: 'מראה מושלם',
      subtitle: 'ציפורניים ברמה אחרת',
      cta: 'קבעו תור',
      offer: 'לק חדש',
      footer,
    };
  }

  if (template === 'hair_barber') {
    return {
      headline: 'לוק חדש',
      subtitle: 'תוצאה שמרגישים',
      cta: 'קבעו תור',
      footer,
    };
  }

  if (template === 'fashion_boutique') {
    return {
      headline: 'קולקציה חדשה',
      subtitle: 'סטייל שנראה טוב',
      cta: 'לקנייה עכשיו',
      offer: 'חדש',
      footer,
    };
  }

  if (template === 'real_estate') {
    return {
      headline: 'הבית הבא',
      subtitle: 'מחכה לכם כאן',
      cta: 'תאמו ביקור',
      footer,
    };
  }

  if (template === 'legal_corporate') {
    return {
      headline: 'ייעוץ מקצועי',
      subtitle: 'בראש שקט',
      cta: 'לתיאום שיחה',
      footer,
    };
  }

  if (template === 'judaica_luxury') {
    return {
      headline: 'יוקרה מסורתית',
      subtitle: 'פריט עם נשמה',
      cta: 'לפרטים',
      footer,
    };
  }

  if (template === 'retail_product') {
    return {
      headline: 'חדש אצלנו',
      subtitle: 'איכות שמרגישים',
      cta: 'לקנייה עכשיו',
      offer: 'מלאי חדש',
      footer,
    };
  }

  return {
    headline: 'בדיוק בשבילכם',
    subtitle: 'שירות מקצועי',
    cta: buildDefaultCta(p, industryCategory),
    footer,
  };
}

// ─── Business-anchored visual mandate ────────────────────────────────────────
// Hard "MUST SHOW / MUST NOT SHOW" block that locks the hero image to the
// actual business category. Switched on the same PosterTemplate enum used by
// the rest of the pipeline so the mandate, photo template, and frontend
// composition stay in sync.
function buildBusinessVisualMandate(
  p: NonNullable<BusinessProfile>,
  industryCategory: string | null,
): { mustShow: string; mustNotShow: string; categoryLabel: string } {
  const template = selectPosterTemplate(p, industryCategory);

  switch (template) {
    case 'sushi_delivery':
      return {
        categoryLabel: 'Israeli sushi restaurant',
        mustShow:
          'fresh sushi rolls (maki), nigiri, sashimi, soy sauce, chopsticks, ' +
          'wasabi, ginger, and a dark slate or wooden board. Japanese-restaurant ' +
          'atmosphere. Premium food photography of the actual dishes.',
        mustNotShow:
          'pizza, burgers, pasta, sandwiches, salads as the hero, generic Italian ' +
          'or American food, random people eating, random restaurant interiors ' +
          'unrelated to Japanese cuisine.',
      };

    case 'pizza_promo':
      return {
        categoryLabel: 'Israeli pizzeria',
        mustShow:
          'fresh hot pizza slices with melted cheese, pepperoni or vegetable toppings, ' +
          'wooden pizza peel, brick oven backdrop, Italian pizza-restaurant feel.',
        mustNotShow: 'sushi, Asian food, burgers as the hero, random unrelated dishes.',
      };

    case 'cafe_bakery':
      return {
        categoryLabel: 'Israeli café / bakery',
        mustShow:
          'fresh pastries, coffee cups with latte art, wooden bakery counter, ' +
          'warm café atmosphere, hands plating, soft natural daylight.',
        mustNotShow:
          'sushi, pizza, gym equipment, salon scenes, unrelated industries.',
      };

    case 'restaurant_promo':
      return {
        categoryLabel: 'Israeli restaurant',
        mustShow:
          'the actual dishes the business serves, plated beautifully, premium ' +
          'restaurant food photography, real ingredients, restaurant atmosphere.',
        mustNotShow:
          'unrelated cuisines, random food categories the business does not serve, ' +
          'random people eating who are not the focus.',
      };

    case 'gym_campaign':
      return {
        categoryLabel: 'Israeli fitness / gym',
        mustShow:
          'gym equipment (kettlebells, dumbbells, barbells), training environment, ' +
          'sweat-marked floors, athletic atmosphere. Equipment is the hero.',
        mustNotShow:
          'food, restaurants, beauty products, random unrelated industries, ' +
          'random celebrities, brand logos that are not this business.',
      };

    case 'beauty_luxury':
      return {
        categoryLabel: 'Israeli luxury beauty / cosmetics',
        mustShow:
          'beauty / cosmetic products, salon environment, marble or glass surfaces, ' +
          'soft diffused light, hands working on a treatment, refined luxury detail.',
        mustNotShow:
          'food, gym equipment, unrelated industries, random celebrities, ' +
          'brand logos that are not this business.',
      };

    case 'nails_manicure':
      return {
        categoryLabel: 'Israeli nail salon',
        mustShow:
          'macro close-up of glossy lacquered nails on an elegant hand, soft silk or ' +
          'marble backdrop, refined polish bottles, manicure tools just visible.',
        mustNotShow:
          'food, gym equipment, generic beauty products unrelated to nails, ' +
          'distorted hands or extra fingers, random celebrities.',
      };

    case 'hair_barber':
      return {
        categoryLabel: 'Israeli barbershop / hair salon',
        mustShow:
          'editorial salon portrait — sharp haircut detail, scissors and mirrors blurred ' +
          'in the background, warm vintage salon atmosphere. The salon environment IS the hero.',
        mustNotShow:
          'food, gym equipment, generic beauty products, random celebrities, ' +
          'brand logos that are not this business.',
      };

    case 'fashion_boutique':
      return {
        categoryLabel: 'Israeli fashion boutique',
        mustShow:
          'styled garments or accessories the boutique sells, clean editorial fashion flat-lay ' +
          'or styled mannequin, modern boutique environment.',
        mustNotShow:
          'food, gym equipment, fast-fashion brand logos, random celebrities, ' +
          'brand logos that are not this business.',
      };

    case 'real_estate':
      return {
        categoryLabel: 'Israeli luxury real estate / property',
        mustShow:
          'interior or exterior of a real property, golden-hour or premium interior light, ' +
          'clean staged architectural composition, aspirational lifestyle.',
        mustNotShow:
          'food, gym, beauty products, unrelated industries, fake brand signage.',
      };

    case 'legal_corporate':
      return {
        categoryLabel: 'Israeli law firm / corporate consultancy',
        mustShow:
          'modern minimalist office detail — leather chair, marble desk, brass pen, legal book, ' +
          'or a refined architectural office corner. Trusted-authority atmosphere.',
        mustNotShow:
          'food, gym equipment, beauty products, casual interiors, cluttered office stock photos, ' +
          'random celebrities, scales of justice clipart, gavel clipart cartoonish.',
      };

    case 'judaica_luxury':
      return {
        categoryLabel: 'Israeli luxury Judaica brand',
        mustShow:
          'menorah, mezuzah, shofar or other Judaica piece on a dark walnut surface, ' +
          'candlelight glow, brass and dark-wood detail, reverent traditional atmosphere.',
        mustNotShow:
          'food, gym equipment, beauty products, unrelated retail, cartoon religious clipart.',
      };

    case 'retail_product':
      return {
        categoryLabel: 'Israeli retail / boutique',
        mustShow:
          'the actual products the business sells, styled cleanly on shelves or a flat surface, ' +
          'modern boutique environment, premium retail photography.',
        mustNotShow:
          'food unrelated to the business, gym scenes, unrelated industries, ' +
          'brand logos that are not this business.',
      };

    case 'general_business_ad':
      break; // fall through to the generic fallback below
  }

  // Generic fallback uses whatever services/products the profile lists so the
  // image model still has something concrete to anchor to.
  const services = [
    p.services ?? '',
    ...(p.websiteServices ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return {
    categoryLabel: p.businessType ?? 'local business',
    mustShow: services
      ? `the actual offering of this business: ${services}.`
      : 'the actual product or service this business provides.',
    mustNotShow:
      'unrelated industries, third-party brand logos, fake celebrity faces.',
  };
}

// ─── Industry background template ────────────────────────────────────────────
// Returns the short, focused opening line for the image model. Non-photo modes
// now request ONLY a realistic background/product photo with clean negative
// space. Typography, CTA, logo, and flyer design are composed by our app.
// Per-template creative brief. Every industry gets its own unique combination
// of photography style, composition, palette, mood and "headline-safe area"
// — so two different industries never produce visually similar backgrounds.
type IndustryBackgroundBrief = {
  opening: string;          // Lead sentence (highest image-model weight).
  composition: string;      // How the hero is framed.
  palette: string;          // Concrete color direction for the photo.
  mood: string;             // Emotional register.
  headlineSafeArea: string; // Where the photo must leave room for overlay text.
};

function buildIndustryBackgroundTemplate(
  p: NonNullable<BusinessProfile>,
  template: PosterTemplate,
): IndustryBackgroundBrief {
  switch (template) {
    case 'sushi_delivery':
      return {
        opening:
          'EXTREME CLOSE-UP cinematic food photography of fresh sushi for a premium Israeli sushi-brand Instagram ad. ' +
          'The sushi IS the hero — glossy salmon nigiri, maki rolls cut to show interior, sashimi slices, ' +
          'condensation droplets on fresh fish, soy sauce reflection, chopsticks resting on the side. ' +
          'Premium dark restaurant food photography, NOT a wide restaurant shot, NOT a storefront.',
        composition:
          'Tight macro framing, sushi fills 65-75% of the frame, shot at 45° or top-down. ' +
          'Shallow depth of field (f/1.8), one piece in razor-sharp focus, the rest melting into bokeh. ' +
          'Hero pieces placed on the right two-thirds, dark slate or polished black surface fills the rest.',
        palette:
          'Deep charcoal black, polished dark slate, glossy salmon orange-pink, soft cream rice, ' +
          'jade green wasabi, amber soy accents. Dark-on-dark luxury food advertising palette.',
        mood: 'Refined, appetizing, premium Japanese luxury food advertising — Wolt/Sushi Express campaign quality.',
        headlineSafeArea:
          'Reserve the upper-left third of the frame as smooth dark out-of-focus surface (slate, polished wood, or moody background bokeh) with NO food, NO objects, NO patterns occupying it — pure dark negative space for headline overlay.',
      };

    case 'pizza_promo':
      return {
        opening:
          'EXTREME CLOSE-UP cinematic food photography of fresh hot pizza for a premium Israeli pizzeria Instagram ad. ' +
          'The pizza IS the hero — melted cheese pull mid-stretch, golden bubbling crust char, vibrant toppings, ' +
          'tomato sauce glistening, basil leaf on top, light steam rising. ' +
          'Premium close-up food photography, NOT a wide pizzeria shot, NOT a storefront.',
        composition:
          'Tight close-up of one slice being lifted (cheese pull) or top-down macro of one full pizza. ' +
          'Pizza fills 70% of the frame. Shallow depth of field (f/2.0), razor-sharp focus on cheese & crust texture.',
        palette:
          'Warm tomato red, golden bubbling crust, melted yellow cheese, charred dark edges, ' +
          'rustic wood, ember warm light. Appetizing food-magazine palette.',
        mood: 'Warm, mouth-watering, premium Italian-pizzeria food advertising — Domino\'s/Pizza Hut campaign quality without their branding.',
        headlineSafeArea:
          'Reserve the upper-left quadrant as smooth dark out-of-focus area (dark wood, dark stone, or moody bokeh) with NO food, NO objects, NO patterns — pure dark negative space for headline overlay.',
      };

    case 'cafe_bakery':
      return {
        opening:
          'EXTREME CLOSE-UP cinematic food photography of fresh pastries and coffee for a premium Israeli café Instagram ad. ' +
          'The food IS the hero — golden flaky croissant, warm steam from latte cup, latte art swirl, ' +
          'powdered-sugar pastry, hands plating, warm wooden counter texture. ' +
          'Premium close-up café food photography, NOT a wide café shot, NOT a storefront.',
        composition:
          'Tight macro 45° angle on a single pastry + coffee cup, food fills 65% of the frame, ' +
          'shallow depth of field with warm bokeh, soft natural daylight.',
        palette:
          'Warm cream, latte brown, golden pastry crust, beige linen, soft pastels. Natural-daylight food-magazine palette.',
        mood: 'Cozy, contemporary, slow-morning café food advertising — Aroma/Lehem Erez quality without branding.',
        headlineSafeArea:
          'Reserve the upper-right area as smooth cream / latte-toned out-of-focus surface (warm wood, soft napkin, blurred kitchen bokeh) with NO food, NO objects, NO text — pure soft negative space for headline overlay.',
      };

    case 'restaurant_promo':
      return {
        opening:
          'EXTREME CLOSE-UP cinematic food photography of one signature plated dish for a premium Israeli restaurant Instagram ad. ' +
          'The dish IS the hero — glistening sauce, fresh herbs, tactile textures, ' +
          'restaurant-grade plating, shallow depth of field, warm tungsten restaurant lighting. ' +
          'Premium close-up food photography, NOT a wide restaurant shot, NOT a dining-room shot, NOT a storefront.',
        composition:
          'Tight close-up 45° angle on one hero dish, dish fills 65-75% of the frame, ' +
          'razor-sharp focus on key texture, restaurant ambient bokeh behind.',
        palette:
          'Warm tungsten light, earthy plate tones, deep restaurant background. Amber, terracotta, deep green accents.',
        mood: 'Appetizing, refined, restaurant-magazine cover quality.',
        headlineSafeArea:
          'Reserve a darker calm out-of-focus area at the top of the frame (dark restaurant bokeh or dark plate edge) with NO food, NO objects, NO patterns occupying it — pure dark negative space for headline overlay.',
      };

    case 'gym_campaign':
      return {
        opening:
          'EXTREME CLOSE-UP commercial photography of premium gym equipment for an Israeli fitness-brand Instagram ad. ' +
          'The equipment IS the hero — sweat-marked black kettlebell, knurled barbell grip, ' +
          'dumbbells stacked, chalk dust in the air, hard rim light catching the metal edge. ' +
          'NO full-body athletes mid-pose, NO gym-floor wide shots, NO building exteriors.',
        composition:
          'Tight low-angle macro on one piece of equipment, equipment fills 60% of frame, ' +
          'hard directional rim light, deep dramatic shadows around the hero.',
        palette:
          'Charcoal black, concrete grey, electric blue or vivid orange single accent, deep shadows.',
        mood: 'Powerful, kinetic, motivational dramatic fitness-campaign close-up — Nike Training quality without branding.',
        headlineSafeArea:
          'Reserve the lower-left or upper area as deep-shadow out-of-focus space (pure black, dark concrete, or motion-blurred dark background) with NO equipment, NO body parts — pure dark negative space for headline overlay.',
      };

    case 'beauty_luxury':
      return {
        opening:
          'EXTREME CLOSE-UP cinematic beauty photography for a premium Israeli luxury beauty / cosmetics Instagram ad. ' +
          'The product IS the hero — a cosmetic bottle on marble, hand gently applying cream, ' +
          'glossy lip detail, dewy skin texture, brushed-gold packaging detail. ' +
          'NO full-face portraits, NO wide salon shots, NO storefronts.',
        composition:
          'Tight macro 45° or side angle on a single product or hand-treatment, hero fills 55-65% of frame, ' +
          'large soft negative space, softbox diffused light.',
        palette:
          'Blush pink, cream, ivory, soft brushed gold, marble white. Diffused softbox light.',
        mood: 'Elegant feminine luxury beauty campaign — Aesop/Glossier close-up quality without branding.',
        headlineSafeArea:
          'Reserve a soft cream / blush smooth out-of-focus area along the top (marble surface or blush bokeh) with NO products, NO body parts, NO patterns — pure soft negative space for headline overlay.',
      };

    case 'nails_manicure':
      return {
        opening:
          'EXTREME CLOSE-UP MACRO photography of beautifully manicured nails for a premium Israeli nail-salon Instagram ad. ' +
          'The hand and nails ARE the hero — glossy lacquered nails with perfect reflections, ' +
          'one elegant hand posed on silk / velvet / marble. ' +
          'NO full-face portraits, NO wide salon shots, NO storefronts.',
        composition:
          'Hyper-detailed macro, hand fills 50-60% of frame, silk/velvet/marble surface behind, ' +
          'soft pastel bokeh, beauty-detail lighting.',
        palette:
          'Pastel or jewel-tone polish, blush, lavender, dusty rose, soft champagne gold.',
        mood: 'Hyper-refined, tactile, glossy beauty-detail photography.',
        headlineSafeArea:
          'Reserve a soft pastel out-of-focus area in the upper-right (silk bokeh or marble surface) with NO hand, NO objects, NO patterns — pure soft negative space for headline overlay.',
      };

    case 'hair_barber':
      return {
        opening:
          'EXTREME CLOSE-UP editorial photography of a precise haircut detail for a premium Israeli barbershop Instagram ad. ' +
          'The haircut IS the hero — sharp fade detail, beard-trim precision, hairstyle silhouette, ' +
          'scissors mid-cut, salon detail blurred in background. ' +
          'NO full-portrait headshots, NO wide salon shots, NO storefronts.',
        composition:
          'Tight side-profile macro on hair / fade / beard detail, hero fills 60-70% of frame, ' +
          'strong rim light, warm tungsten bokeh behind.',
        palette:
          'Warm leather brown, amber tungsten, deep navy, vintage cream. Cinematic warm tones.',
        mood: 'Confident, fashion-magazine salon advertising, editorial cool — Murdock London quality without branding.',
        headlineSafeArea:
          'Reserve a dark warm out-of-focus salon-bokeh area on the left with NO objects, NO body parts, NO patterns — pure dark negative space for headline overlay.',
      };

    case 'fashion_boutique':
      return {
        opening:
          'EXTREME CLOSE-UP editorial fashion photography for a premium Israeli boutique Instagram ad. ' +
          'The garment / accessory IS the hero — fabric texture detail, stitching, leather grain, ' +
          'jewelry on neutral surface, styled flat-lay close-up. ' +
          'NO full-body model shots, NO street-style shots, NO storefronts.',
        composition:
          'Editorial macro on fabric / garment detail or single accessory, hero fills 55-65% of frame, ' +
          'generous whitespace, soft directional studio light.',
        palette:
          'Neutral premium — soft tan, cream, charcoal, with ONE bold accent color (terracotta, deep red, or olive).',
        mood: 'Trendy, refined, magazine-cover editorial fashion campaign — Aritzia/COS quality without branding.',
        headlineSafeArea:
          'Reserve a clean neutral smooth out-of-focus area along the top (cream surface or soft fabric bokeh) with NO garments, NO objects — pure neutral negative space for headline overlay.',
      };

    case 'real_estate':
      return {
        opening:
          'EXTREME CLOSE-UP architectural-detail photography for a premium Israeli luxury real-estate Instagram ad. ' +
          'A refined INTERIOR DETAIL is the hero — warm interior corner with designer chair + side table, ' +
          'window light hitting hardwood floor, key turning in a brass lock, marble countertop with brass tap. ' +
          'NO wide building exteriors, NO storefronts, NO street scenes, NO city skylines, NO neighborhoods.',
        composition:
          'Tight architectural detail at 45° or eye-level, hero fills 60-70% of frame, ' +
          'shallow depth of field, warm window light, premium interior bokeh.',
        palette:
          'Warm beige, deep terracotta, charcoal accents, warm golden-hour interior light. Aspirational lifestyle tones.',
        mood: 'Modern luxury property marketing, refined and serene — premium interior-detail photography.',
        headlineSafeArea:
          'Reserve a calm warm-toned out-of-focus area in the upper part of the frame (cream wall bokeh or warm interior shadow) with NO furniture, NO objects, NO patterns — pure soft negative space for headline overlay.',
      };

    case 'legal_corporate':
      return {
        opening:
          'EXTREME CLOSE-UP still-life photography for a premium Israeli law-firm / consultancy Instagram ad. ' +
          'A refined OBJECT DETAIL is the hero — brass fountain pen on marble, leather-bound legal book ' +
          'with brass corner, hand signing a document with a heavy pen, marble surface with watch and pen. ' +
          'NO building exteriors, NO storefronts, NO wide office shots, NO city skylines.',
        composition:
          'Tight 45° close-up on a single refined object, hero fills 55-65% of frame, ' +
          'controlled studio light, premium still-life styling.',
        palette:
          'Deep navy, charcoal, ivory, brass and warm wood accents. Soft natural window light.',
        mood: 'Trustworthy, polished, authoritative — premium corporate still-life photography.',
        headlineSafeArea:
          'Reserve a calm ivory or navy smooth out-of-focus area at the top (marble surface or soft wall bokeh) with NO objects, NO patterns — pure refined negative space for headline overlay.',
      };

    case 'judaica_luxury':
      return {
        opening:
          'EXTREME CLOSE-UP still-life photography for a premium Israeli luxury Judaica brand Instagram ad. ' +
          'A single Judaica piece IS the hero — polished brass menorah arms, a mezuzah with hand-engraved detail, ' +
          'silver Kiddush cup catching candlelight, on a dark walnut surface. ' +
          'NO synagogue interiors, NO building exteriors, NO storefronts.',
        composition:
          'Tight 45° close-up on a single piece, hero fills 60-70% of frame, candlelight glow, ' +
          'dark walnut surface bokeh behind, soft directional light.',
        palette:
          'Brass, deep walnut, ivory candle glow, deep navy. Rich traditional luxury palette.',
        mood: 'Refined, reverent, traditional luxury still-life.',
        headlineSafeArea:
          'Reserve a dark walnut smooth out-of-focus area along the top with NO objects, NO patterns — pure dark negative space for headline overlay.',
      };

    case 'retail_product':
      return {
        opening:
          'EXTREME CLOSE-UP studio product photography for a premium Israeli retail Instagram ad. ' +
          'The product IS the hero — clean macro of the actual item the business sells, ' +
          'styled on a seamless backdrop with controlled studio light. ' +
          'NO storefront shots, NO retail-floor shots, NO street scenes, NO model shots.',
        composition:
          'Tight studio shot on a single hero product, product fills 60-70% of frame, ' +
          'soft seamless backdrop, controlled directional light.',
        palette:
          'Clean neutral premium palette derived from the product itself, with one supporting accent.',
        mood: 'Clean modern ecommerce product photography, premium and aspirational.',
        headlineSafeArea:
          'Reserve a clean seamless smooth area in the upper third (solid seamless background) with NO products, NO objects, NO patterns — pure seamless negative space for headline overlay.',
      };

    case 'general_business_ad':
      return {
        opening:
          `EXTREME CLOSE-UP commercial photography for an Israeli social-media ad for "${p.businessName}". ` +
          'The actual product or service detail this business provides IS the hero — macro on the deliverable, ' +
          'styled and lit like a premium magazine campaign. ' +
          'NO building exteriors, NO storefronts, NO wide environment shots, NO city scenes.',
        composition:
          'Tight close-up at 45°, single hero subject fills 60% of frame, controlled premium light, ' +
          'refined out-of-focus negative space.',
        palette:
          'Clean modern neutral palette aligned with the business brand colors.',
        mood: 'Premium, refined, contemporary Israeli local-business close-up photography.',
        headlineSafeArea:
          'Reserve a calm smooth out-of-focus area in the upper third (solid or blurred neutral background) with NO objects, NO patterns — pure clean negative space for headline overlay.',
      };
  }
}

type CreativePlanContext = {
  businessContext: string;
  websiteContext: string;
  visualContext: string;
  assetInsight: BrandAssetInsight | null;
  recentPostSummaries: string[];
  styleByType: BusinessStyle | null;
  identity: VisualIdentity;
  sceneDescription: string;
  servicesFromAllSources: string[];
  cleanTopic: string;
  captionText: string;
  postImageType: Exclude<PostImageType, 'photo'>;
  posterTemplate: PosterTemplate;
  creativeTemplate: CreativeTemplate;
  languageMode: PosterLanguageMode;
};

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function cleanPosterText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/["“”]/g, '')
    .replace(/#[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeVisualStyle(value: unknown, fallback: CreativeVisualStyle): CreativeVisualStyle {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: CreativeVisualStyle[] = [
    'premium',
    'bold',
    'elegant',
    'dramatic',
    'minimal',
    'luxury',
    'friendly',
    'energetic',
    'aggressive',
    'clean',
  ];
  return allowed.includes(normalized as CreativeVisualStyle)
    ? (normalized as CreativeVisualStyle)
    : fallback;
}

function normalizePosterType(value: unknown, fallback: PosterType): PosterType {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: PosterType[] = [
    'promotion',
    'brand',
    'product_spotlight',
    'booking',
    'seasonal',
    'question_hook',
    'announcement',
    'reminder',
    'offer',
  ];
  return allowed.includes(normalized as PosterType)
    ? (normalized as PosterType)
    : fallback;
}

function normalizeLayoutDensity(value: unknown, fallback: LayoutDensity): LayoutDensity {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: LayoutDensity[] = ['minimal', 'medium', 'rich'];
  return allowed.includes(normalized as LayoutDensity)
    ? (normalized as LayoutDensity)
    : fallback;
}

function normalizeLayoutHierarchy(value: unknown, fallback: LayoutHierarchy): LayoutHierarchy {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: LayoutHierarchy[] = ['strong', 'elegant', 'soft', 'bold'];
  return allowed.includes(normalized as LayoutHierarchy)
    ? (normalized as LayoutHierarchy)
    : fallback;
}

function normalizeTextElementRole(value: unknown): TextElementRole | null {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: TextElementRole[] = ['headline', 'subheadline', 'offer', 'cta', 'brand_name'];
  return allowed.includes(normalized as TextElementRole)
    ? (normalized as TextElementRole)
    : null;
}

function normalizeTextElementImportance(value: unknown): TextElementImportance {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: TextElementImportance[] = ['primary', 'secondary', 'small'];
  return allowed.includes(normalized as TextElementImportance)
    ? (normalized as TextElementImportance)
    : 'secondary';
}

function normalizeTextElements(value: unknown, fallback: TextElement[]): TextElement[] {
  if (!Array.isArray(value)) return fallback;
  const elements = value
    .map((item): TextElement | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const role = normalizeTextElementRole(raw.role);
      const text = cleanPosterText(raw.text, role === 'headline' ? 34 : 28);
      if (!role || !text) return null;
      return {
        role,
        text,
        importance: normalizeTextElementImportance(raw.importance),
      };
    })
    .filter((item): item is TextElement => Boolean(item));

  const limited = elements
    .filter((element, index, arr) =>
      arr.findIndex((candidate) => candidate.role === element.role && candidate.text === element.text) === index,
    )
    .slice(0, 5);

  return limited.length ? limited : fallback;
}

function normalizeTextPosition(value: unknown, fallback: TextPosition): TextPosition {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: TextPosition[] = ['top', 'bottom', 'right', 'left', 'center'];
  return allowed.includes(normalized as TextPosition)
    ? (normalized as TextPosition)
    : fallback;
}

function normalizeLogoPosition(value: unknown, fallback: LogoPosition): LogoPosition {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: LogoPosition[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  return allowed.includes(normalized as LogoPosition)
    ? (normalized as LogoPosition)
    : fallback;
}

function normalizeCtaPosition(value: unknown, fallback: CtaPosition): CtaPosition {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: CtaPosition[] = ['bottom', 'center', 'bottom-right', 'bottom-left'];
  return allowed.includes(normalized as CtaPosition)
    ? (normalized as CtaPosition)
    : fallback;
}

function normalizeLayout(value: unknown, creativeTemplate: CreativeTemplate): PosterLayout {
  const fallback = DEFAULT_CREATIVE_LAYOUTS[creativeTemplate];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const layout = value as Record<string, unknown>;

  return {
    text_position: normalizeTextPosition(layout.text_position, fallback.text_position),
    logo_position: normalizeLogoPosition(layout.logo_position, fallback.logo_position),
    cta_position: normalizeCtaPosition(layout.cta_position, fallback.cta_position),
    safe_area:
      String(layout.safe_area ?? fallback.safe_area)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240) || fallback.safe_area,
  };
}

function visualStyleForTemplate(template: CreativeTemplate): CreativeVisualStyle {
  switch (template) {
    case 'bold_sales':
      return 'bold';
    case 'elegant_beauty':
      return 'elegant';
    case 'food_promo':
      return 'dramatic';
    case 'minimal_luxury':
      return 'luxury';
    default:
      return 'premium';
  }
}

function fallbackPosterTypeForGoal(postGoal: PostGoal): PosterType {
  switch (postGoal) {
    case 'sale':
    case 'promotion':
      return 'offer';
    case 'booking':
      return 'booking';
    case 'holiday':
      return 'seasonal';
    case 'new_product':
      return 'product_spotlight';
    case 'reminder':
      return 'reminder';
    case 'awareness':
      return 'brand';
    default:
      return 'promotion';
  }
}

function fallbackStructureForGoal(postGoal: PostGoal): PosterStructure {
  switch (postGoal) {
    case 'sale':
    case 'promotion':
      return 'offer_sale';
    case 'booking':
      return 'booking_focused';
    case 'holiday':
      return 'seasonal_mood';
    case 'new_product':
      return 'product_spotlight';
    case 'reminder':
      return 'question_hook';
    default:
      return 'soft_branding';
  }
}

function normalizePosterStructure(value: unknown, fallback: PosterStructure): PosterStructure {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: PosterStructure[] = [
    'bold_promo',
    'soft_branding',
    'product_spotlight',
    'question_hook',
    'booking_focused',
    'seasonal_mood',
    'offer_sale',
  ];
  return allowed.includes(normalized as PosterStructure)
    ? (normalized as PosterStructure)
    : fallback;
}

function resolvePosterLanguageMode(): PosterLanguageMode {
  // Default to Hebrew — this is the test mode product has asked to roll out.
  // English is still fully supported and acts as the fallback when Hebrew
  // generation fails. Override by setting OPENAI_POSTER_LANGUAGE_MODE=english.
  const raw = process.env.OPENAI_POSTER_LANGUAGE_MODE?.toLowerCase().trim();
  if (raw === 'english') return 'english';
  if (raw === 'hebrew') return 'hebrew';
  return 'hebrew';
}

function buildFallbackTextElements({
  profile,
  postGoal,
  template,
  languageMode,
  hebrewFallback,
}: {
  profile: NonNullable<BusinessProfile>;
  postGoal: PostGoal;
  template: PosterTemplate;
  languageMode: PosterLanguageMode;
  hebrewFallback: PosterText;
}): TextElement[] {
  if (languageMode === 'hebrew') {
    const elements: TextElement[] = [
      { role: 'headline', text: hebrewFallback.headline, importance: 'primary' },
    ];
    if (hebrewFallback.subtitle) {
      elements.push({
        role: 'subheadline',
        text: hebrewFallback.subtitle,
        importance: 'secondary',
      });
    }
    if (
      hebrewFallback.cta &&
      (postGoal === 'sale' || postGoal === 'promotion' || postGoal === 'booking')
    ) {
      elements.push({ role: 'cta', text: hebrewFallback.cta, importance: 'small' });
    }
    if (profile.businessName) {
      elements.push({ role: 'brand_name', text: profile.businessName, importance: 'small' });
    }
    return elements;
  }

  const headline = (() => {
    if (postGoal === 'sale' || postGoal === 'promotion') return 'Special Offer';
    if (postGoal === 'booking') return 'Book Your Spot';
    if (postGoal === 'new_product') return 'New Arrival';
    if (
      template === 'sushi_delivery' ||
      template === 'restaurant_promo' ||
      template === 'pizza_promo' ||
      template === 'cafe_bakery'
    ) {
      return 'Fresh Taste';
    }
    if (template === 'gym_campaign') return 'Start Strong';
    if (
      template === 'beauty_luxury' ||
      template === 'nails_manicure' ||
      template === 'hair_barber'
    ) {
      return 'Feel Your Best';
    }
    if (template === 'fashion_boutique') return 'New Season';
    if (template === 'real_estate') return 'Live Better';
    return 'Made For You';
  })();

  const subtitle = (() => {
    if (
      template === 'sushi_delivery' ||
      template === 'restaurant_promo' ||
      template === 'pizza_promo' ||
      template === 'cafe_bakery'
    ) {
      return 'Premium local flavor';
    }
    if (template === 'gym_campaign') return 'Energy that moves you';
    if (
      template === 'beauty_luxury' ||
      template === 'nails_manicure' ||
      template === 'hair_barber'
    ) {
      return 'A polished premium experience';
    }
    if (template === 'fashion_boutique') return 'Editorial style, everyday confidence';
    return 'Professional service with a premium touch';
  })();

  const cta = (() => {
    if (postGoal === 'booking') return 'Book Now';
    if (postGoal === 'sale' || postGoal === 'promotion') return 'Learn More';
    return '';
  })();

  const elements: TextElement[] = [
    { role: 'headline', text: headline, importance: 'primary' },
    { role: 'subheadline', text: subtitle, importance: 'secondary' },
  ];
  if (cta) elements.push({ role: 'cta', text: cta, importance: 'small' });

  const englishBrandName = englishOnlyOrEmpty(profile.businessName);
  if (englishBrandName) {
    elements.push({ role: 'brand_name', text: englishBrandName, importance: 'small' });
  }
  return elements;
}

async function generateCreativePlan(
  businessProfile: NonNullable<BusinessProfile>,
  postGoal: PostGoal,
  openai: OpenAI,
  context: CreativePlanContext,
  acc: CostAccumulator,
): Promise<PostCreativePlan> {
  const fallbackLayout = DEFAULT_CREATIVE_LAYOUTS[context.creativeTemplate];
  const languageMode = context.languageMode;
  const fallbackText = buildFallbackOnImageText(
    businessProfile,
    context.styleByType?.category ?? null,
    context.posterTemplate,
  );
  const fallbackTextElements = buildFallbackTextElements({
    profile: businessProfile,
    postGoal,
    template: context.posterTemplate,
    languageMode,
    hebrewFallback: fallbackText,
  });
  const fallbackPlan: PostCreativePlan = {
    poster_type: fallbackPosterTypeForGoal(postGoal),
    visual_style: visualStyleForTemplate(context.creativeTemplate),
    tone: businessProfile.tone ?? businessProfile.style ?? context.identity.mood,
    main_message: fallbackTextElements[0]?.text ?? fallbackText.headline,
    text_elements: fallbackTextElements,
    layout_direction: {
      density: fallbackTextElements.length <= 2 ? 'minimal' : 'medium',
      hierarchy: postGoal === 'sale' || postGoal === 'promotion' ? 'bold' : 'elegant',
    },
    style_notes: context.identity.mood,
    image_prompt_direction: context.sceneDescription || businessProfile.description || '',
    language_mode: languageMode,
    show_cta: fallbackTextElements.some((element) => element.role === 'cta'),
    poster_structure: fallbackStructureForGoal(postGoal),
    layout: fallbackLayout,
  };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are the creative strategy director for Easy-M, an Israeli AI marketing-post generator. ' +
            'Return JSON only. Act like a designer plus creative director, not a repetitive template. ' +
            'First decide what kind of post this should be, how many text elements it needs, whether it needs a CTA at all, and what style/layout fits the business and goal. ' +
            'OpenAI Image API will generate the complete final poster image, including text and design. ' +
            'Write short poster copy and a clear visual concept for a polished, agency-level final ad.',
        },
        {
          role: 'user',
          content:
            `Business profile:\n${context.businessContext}${context.websiteContext}\n\n` +
            `Business type: ${businessProfile.businessType ?? 'unknown'}\n` +
            `Business name: ${businessProfile.businessName ?? ''}\n` +
            `Target audience: ${businessProfile.audience ?? businessProfile.targetAudience ?? ''}\n` +
            `Services/products: ${dedupe([
              businessProfile.services ?? '',
              businessProfile.products ?? '',
              ...(businessProfile.websiteServices ?? []),
              ...context.servicesFromAllSources,
            ]).join(', ')}\n` +
            `Brand colors: ${businessProfile.brandColors ?? context.identity.colorPalette}\n` +
            `Tone: ${businessProfile.tone ?? businessProfile.style ?? businessProfile.websiteTone ?? context.identity.mood}\n` +
            `Logo available: ${Boolean(businessProfile.logoUrl)}\n` +
            `Uploaded images available: ${(businessProfile.images?.length ?? 0) + (businessProfile.uploadedImages?.length ?? 0)}\n` +
            (context.assetInsight?.visualSummary
              ? `Uploaded-photo intelligence: ${context.assetInsight.visualSummary}\n`
              : '') +
            (context.assetInsight?.visualStyleSummary
              ? `Extracted uploaded-photo visual style: ${context.assetInsight.visualStyleSummary}\n`
              : '') +
            (context.assetInsight?.productHints?.length
              ? `Real products/services seen in uploaded images: ${context.assetInsight.productHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.atmosphereHints?.length
              ? `Atmosphere cues from uploaded images: ${context.assetInsight.atmosphereHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.lightingHints?.length
              ? `Lighting cues from uploaded images: ${context.assetInsight.lightingHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.compositionHints?.length
              ? `Composition cues from uploaded images: ${context.assetInsight.compositionHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.colorHints?.length
              ? `Real brand color/material cues: ${context.assetInsight.colorHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.textureHints?.length
              ? `Realistic texture cues: ${context.assetInsight.textureHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.brandingHints?.length
              ? `Brand consistency cues from uploaded images: ${context.assetInsight.brandingHints.join(', ')}\n`
              : '') +
            (context.assetInsight?.avoidHints?.length
              ? `Avoid from uploaded images: ${context.assetInsight.avoidHints.join(', ')}\n`
              : '') +
            `Recent previous posts to avoid repeating:\n${context.recentPostSummaries.join('\n') || 'none'}\n` +
            `Post goal: ${postGoal}\n` +
            `User topic: ${context.cleanTopic || 'auto'}\n` +
            `Poster text language mode: ${languageMode}.\n` +
            (languageMode === 'hebrew'
              ? '────────────────────────────────────────────────────────\n' +
                'HEBREW MODE — text_elements MUST be in natural, short, professional Israeli Hebrew.\n' +
                'Vary the structure between posts. DO NOT always use headline + subheadline + CTA.\n' +
                'DO NOT always use "הזמינו עכשיו". Pick one of the structures below that fits this post:\n\n' +
                '  • OFFER (1-3 elements):\n' +
                '      "20% הנחה על כל התפריט" / "רק השבוע" / optional "בואו לטעום"\n' +
                '  • BRAND (1-2 elements):\n' +
                '      "חוויה יפנית שלא תשכחו" + small brand_name\n' +
                '  • PRODUCT SPOTLIGHT (1-2 elements):\n' +
                '      "סושי טרי. מדויק. ממכר." + small brand_name\n' +
                '  • QUESTION HOOK (2 elements):\n' +
                '      "מוכנים לביס המושלם?" + "הסושי של [שם] מחכה לכם"\n' +
                '  • MINIMAL PREMIUM (1-2 elements):\n' +
                '      "טעם של יפן" + small brand_name\n\n' +
                'Hebrew rules:\n' +
                '  • Use 1–4 text elements total. Many of the best posters use just 1 or 2.\n' +
                '  • Keep each line short and poster-friendly (a few words to ~7 words max).\n' +
                '  • Adapt the examples to THIS business (replace Japanese/sushi nouns with whatever the profile sells).\n' +
                '  • Hebrew must sound like native Israeli social-media copy. No literal translations from English, no robotic grammar, no generic AI slogans.\n' +
                '  • Prefer concrete, human phrases over abstract claims. Good Hebrew is short, confident, and emotionally clear.\n' +
                '  • If Hebrew rendering may be risky, prefer fewer and shorter words. Avoid quotes, slashes, long punctuation runs, and complex mixed RTL/LTR phrasing.\n' +
                '  • Do not include English in text_elements except for the brand name when it is genuinely the business\'s English name.\n' +
                '  • Avoid repeating the same structure or wording across posts (see recent posts list).\n' +
                '────────────────────────────────────────────────────────\n'
              : 'ENGLISH MODE — text_elements MUST be in short, polished English. ' +
                'Do not include Hebrew in text_elements. Same variation rules: do not always use headline + sub + CTA, vary the structure.\n') +
            `Caption context:\n${context.captionText}\n\n` +
            `Selected visual family: ${context.creativeTemplate}\n` +
            `Preferred layout defaults: ${JSON.stringify(DEFAULT_CREATIVE_LAYOUTS[context.creativeTemplate])}\n` +
            `Commercial scene seed:\n${context.sceneDescription}\n\n` +
            'Possible poster types: promotion, brand, product_spotlight, booking, seasonal, question_hook, announcement, reminder, offer.\n' +
            'Rules for variation:\n' +
            '- Do not always use a CTA. Only include a cta text element when it genuinely helps this post goal.\n' +
            '- Do not always use the same CTA. If used, make it context-specific.\n' +
            '- Do not always use headline + subheadline + CTA. A soft branding post can use one elegant sentence and no CTA.\n' +
            '- Keep all text short, natural, poster-friendly, and readable.\n' +
            '- Avoid awkward Hebrew, literal translations, stiff phrases, and robotic wording. The final copy must feel written by a real Israeli social media manager.\n' +
            '- Use at most 4 text elements, including brand_name. Do not invent prices, phone numbers, URLs, addresses, QR codes, hashtags, or fake contact details.\n\n' +
            'Art-direction rules:\n' +
            '- Make a distinct layout choice for THIS post; do not default to a centered generic template.\n' +
            '- Use uploaded-image cues when available so the ad feels like this real business, not stock content. Treat them as visual inspiration for color, mood, products, lighting, atmosphere, and composition — do not ask to paste the exact uploaded photo.\n' +
            '- Plan typography placement with safe margins, clear hierarchy, and clean RTL reading order when Hebrew is used.\n' +
            '- Keep the poster premium and uncluttered; fewer stronger elements are better than a busy flyer.\n\n' +
            'Return JSON only with exactly this structure:\n' +
            '{\n' +
            '  "poster_type": "promotion | brand | product_spotlight | booking | seasonal | question_hook | announcement | reminder | offer",\n' +
            '  "visual_style": "premium | bold | elegant | dramatic | minimal | luxury | friendly | energetic",\n' +
            '  "tone": "short tone description",\n' +
            '  "main_message": "one-sentence strategic message",\n' +
            '  "text_elements": [\n' +
            '    { "role": "headline | subheadline | offer | cta | brand_name", "text": "short poster text", "importance": "primary | secondary | small" }\n' +
            '  ],\n' +
            '  "layout_direction": {\n' +
            '    "density": "minimal | medium | rich",\n' +
            '    "hierarchy": "strong | elegant | soft | bold"\n' +
            '  },\n' +
            '  "style_notes": "English design direction: typography mood, spacing, palette, composition",\n' +
            '  "image_prompt_direction": "English visual direction for OpenAI Image API: hero subject, mood, lighting, palette, layout feeling, composition"\n' +
            '}\n\n' +
            'Important: style_notes and image_prompt_direction must be English only.',
        },
      ],
      max_tokens: 950,
    });

    trackTextCost(acc, 'creative_plan', 'gpt-4o-mini', response.usage);

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) return fallbackPlan;

    const layout = normalizeLayout(parsed.layout, context.creativeTemplate);
    const textElements = normalizeTextElements(parsed.text_elements, fallbackTextElements);
    const layoutDirectionSource =
      parsed.layout_direction && typeof parsed.layout_direction === 'object'
        ? (parsed.layout_direction as Record<string, unknown>)
        : {};
    const plan: PostCreativePlan = {
      poster_type: normalizePosterType(parsed.poster_type, fallbackPlan.poster_type),
      visual_style: normalizeVisualStyle(parsed.visual_style, fallbackPlan.visual_style),
      tone: cleanPosterText(parsed.tone, 120) || fallbackPlan.tone,
      main_message: cleanPosterText(parsed.main_message, 160) || fallbackPlan.main_message,
      text_elements: textElements,
      layout_direction: {
        density: normalizeLayoutDensity(layoutDirectionSource.density, fallbackPlan.layout_direction.density),
        hierarchy: normalizeLayoutHierarchy(
          layoutDirectionSource.hierarchy,
          fallbackPlan.layout_direction.hierarchy,
        ),
      },
      style_notes:
        stripHebrewForImagePrompt(String(parsed.style_notes ?? '')).slice(0, 700) ||
        fallbackPlan.style_notes,
      image_prompt_direction:
        stripHebrewForImagePrompt(String(parsed.image_prompt_direction ?? '')).slice(0, 900) ||
        fallbackPlan.image_prompt_direction,
      language_mode: languageMode,
      show_cta: textElements.some((element) => element.role === 'cta'),
      poster_structure: normalizePosterStructure(
        parsed.poster_structure ?? parsed.poster_type,
        fallbackPlan.poster_structure,
      ),
      layout,
    };

    devInfo('🧠 [generateCreativePlan] OpenAI creative plan', {
      creativeTemplate: context.creativeTemplate,
      postGoal,
      posterType: plan.poster_type,
      visualStyle: plan.visual_style,
      languageMode: plan.language_mode,
      textElementCount: plan.text_elements.length,
      layoutDirection: plan.layout_direction,
      layoutPosition: plan.layout.text_position,
    });

    return plan;
  } catch (error) {
    devError('🧠 [generateCreativePlan] failed, using fallback plan', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackPlan;
  }
}

// ─── Hebrew → English fallback wrapper ───────────────────────────────────────
// Hebrew mode is a safe test mode. If Hebrew text_elements come back empty,
// suspiciously short, or contain no Hebrew characters at all, we retry the
// whole creative plan in English mode. This guarantees the user never sees
// a stuck loading state because of a bad Hebrew generation.
//
// Returns { plan, languageUsed, fallbackHappened, fallbackReason }.
async function generateCreativePlanWithLanguageFallback(
  businessProfile: NonNullable<BusinessProfile>,
  postGoal: PostGoal,
  openai: OpenAI,
  context: CreativePlanContext,
  acc: CostAccumulator,
): Promise<{
  plan: PostCreativePlan;
  languageUsed: PosterLanguageMode;
  fallbackHappened: boolean;
  fallbackReason: string | null;
}> {
  const requested = context.languageMode;

  // English-mode requests go straight through.
  if (requested === 'english') {
    const plan = await generateCreativePlan(businessProfile, postGoal, openai, context, acc);
    return { plan, languageUsed: 'english', fallbackHappened: false, fallbackReason: null };
  }

  // Hebrew mode: try Hebrew first.
  let hebrewPlan: PostCreativePlan | null = null;
  let hebrewFailureReason: string | null = null;
  try {
    hebrewPlan = await generateCreativePlan(businessProfile, postGoal, openai, context, acc);
  } catch (error) {
    hebrewFailureReason = `hebrew_threw:${error instanceof Error ? error.message : String(error)}`;
  }

  // Defensive validation. Only fall back when we have a strong signal that
  // the Hebrew plan is unusable — empty list, or zero Hebrew characters in
  // any element. Anything else (including odd structure) is fine.
  if (hebrewPlan) {
    const hebrewChars = /[֐-׿]/;
    const hasAnyHebrew = hebrewPlan.text_elements.some((el) => hebrewChars.test(el.text));
    if (hebrewPlan.text_elements.length === 0) {
      hebrewFailureReason = 'no_text_elements_returned';
    } else if (!hasAnyHebrew) {
      hebrewFailureReason = 'no_hebrew_characters_in_text_elements';
    } else {
      devInfo('🧠 [creativePlanWithFallback] Hebrew plan accepted', {
        elementCount: hebrewPlan.text_elements.length,
      });
      return {
        plan: hebrewPlan,
        languageUsed: 'hebrew',
        fallbackHappened: false,
        fallbackReason: null,
      };
    }
  }

  devWarn('🧠 [creativePlanWithFallback] Hebrew failed, retrying in English', {
    reason: hebrewFailureReason,
  });

  const englishContext: CreativePlanContext = { ...context, languageMode: 'english' };
  const englishPlan = await generateCreativePlan(
    businessProfile,
    postGoal,
    openai,
    englishContext,
    acc,
  );

  return {
    plan: englishPlan,
    languageUsed: 'english',
    fallbackHappened: true,
    fallbackReason: hebrewFailureReason ?? 'hebrew_validation_failed',
  };
}

function posterTextFromCreativePlan(
  creativePlan: PostCreativePlan,
  p: BusinessProfile,
  industryCategory?: string | null,
  template?: PosterTemplate,
): PosterText {
  const fallback = buildFallbackOnImageText(p, industryCategory, template);
  const headline = creativePlan.text_elements.find((element) => element.role === 'headline');
  const offer = creativePlan.text_elements.find((element) => element.role === 'offer');
  const subheadline = creativePlan.text_elements.find((element) => element.role === 'subheadline');
  const cta = creativePlan.text_elements.find((element) => element.role === 'cta');
  return {
    headline: headline?.text || offer?.text || creativePlan.main_message || fallback.headline,
    subtitle: subheadline?.text || undefined,
    body: subheadline ? undefined : creativePlan.main_message || undefined,
    cta: creativePlan.show_cta ? cta?.text || fallback.cta : undefined,
    offer: offer?.text,
    footer: fallback.footer,
  };
}

function buildOpenAICompletePosterPrompt({
  profile,
  posterText,
  creativePlan,
  posterTemplate,
  postGoal,
  identity,
  sceneDescription,
  servicesFromAllSources,
  assetInsight,
}: {
  profile: NonNullable<BusinessProfile>;
  posterText: PosterText;
  creativePlan: PostCreativePlan | null;
  posterTemplate: PosterTemplate;
  postGoal: PostGoal;
  identity: VisualIdentity;
  sceneDescription: string;
  servicesFromAllSources: string[];
  assetInsight?: BrandAssetInsight | null;
}): string {
  const industryCategory = resolveBusinessStyle(profile)?.category ?? null;
  const brief = buildIndustryBackgroundTemplate(profile, posterTemplate);
  const mandate = buildBusinessVisualMandate(profile, industryCategory);
  const businessType = englishOnlyOrEmpty(profile.businessType) || mandate.categoryLabel;
  const businessName = profile.businessName?.trim() ?? '';
  const brandMood = profile.tone ?? profile.websiteTone ?? profile.style ?? identity.mood;
  const brandColors = profile.brandColors ?? identity.colorPalette;
  const services = dedupe([
    profile.services ?? '',
    profile.products ?? '',
    ...(profile.websiteServices ?? []),
    ...servicesFromAllSources,
  ]).slice(0, 6);
  const supportLine = posterText.subtitle?.trim() || posterText.body?.trim() || '';
  const cta = posterText.cta?.trim() ?? '';
  const posterType = creativePlan?.poster_type ?? fallbackPosterTypeForGoal(postGoal);
  const visualStyle = creativePlan?.visual_style ?? visualStyleForTemplate(
    selectCreativeTemplate(profile, postGoal, posterTemplate),
  );
  const languageMode = creativePlan?.language_mode ?? resolvePosterLanguageMode();
  const textElements = creativePlan?.text_elements?.length
    ? creativePlan.text_elements
    : [
        { role: 'headline', text: posterText.headline, importance: 'primary' },
        ...(supportLine
          ? [{ role: 'subheadline' as const, text: supportLine, importance: 'secondary' as const }]
          : []),
        ...(cta ? [{ role: 'cta' as const, text: cta, importance: 'small' as const }] : []),
      ];
  const textElementLines = textElements
    .map((element, index) =>
      `${index + 1}. ${element.role} (${element.importance}): "${element.text}"`,
    )
    .join('\n');
  const creativeDirection = creativePlan?.image_prompt_direction?.trim();
  const styleNotes = creativePlan?.style_notes?.trim();
  const languageInstruction =
    languageMode === 'hebrew'
      ? 'Text language mode: Hebrew. Render ONLY the listed Hebrew words with careful RTL direction, readable bold Hebrew typography, correct letter order, no mirrored letters, and no Hebrew-like gibberish. If unsure, make the typography simpler, larger, and cleaner.'
      : 'Text language mode: English. Render the listed English words only. Do not include Hebrew characters in the poster image.';
  const density = creativePlan?.layout_direction.density ?? 'medium';
  const hierarchy = creativePlan?.layout_direction.hierarchy ?? 'strong';
  const uploadedAssetDirection =
    assetInsight && (
      assetInsight.visualSummary ||
      assetInsight.visualStyleSummary ||
      assetInsight.productHints.length ||
      assetInsight.atmosphereHints?.length ||
      assetInsight.lightingHints?.length ||
      assetInsight.compositionHints?.length ||
      assetInsight.colorHints?.length ||
      assetInsight.textureHints?.length ||
      assetInsight.brandingHints?.length
    )
      ? (
          'Uploaded business photo intelligence to use as real-world inspiration, NOT as pasted source images:\n' +
          `- Image context used: ${assetInsight.imageContextUsed ? 'yes' : 'no'}; analyzed assets: ${assetInsight.analyzedImageCount}.\n` +
          (assetInsight.visualSummary ? `- Visual summary: ${assetInsight.visualSummary}\n` : '') +
          (assetInsight.visualStyleSummary
            ? `- Extracted visual style: ${assetInsight.visualStyleSummary}.\n`
            : '') +
          (assetInsight.productHints.length
            ? `- Actual visible products/services: ${assetInsight.productHints.join(', ')}.\n`
            : '') +
          (assetInsight.atmosphereHints?.length
            ? `- Atmosphere/vibe cues: ${assetInsight.atmosphereHints.join(', ')}.\n`
            : '') +
          (assetInsight.lightingHints?.length
            ? `- Lighting cues: ${assetInsight.lightingHints.join(', ')}.\n`
            : '') +
          (assetInsight.compositionHints?.length
            ? `- Composition/crop cues: ${assetInsight.compositionHints.join(', ')}.\n`
            : '') +
          (assetInsight.colorHints?.length
            ? `- Real brand colors/materials: ${assetInsight.colorHints.join(', ')}.\n`
            : '') +
          (assetInsight.textureHints?.length
            ? `- Realistic texture cues: ${assetInsight.textureHints.join(', ')}.\n`
            : '') +
          (assetInsight.brandingHints?.length
            ? `- Brand consistency cues: ${assetInsight.brandingHints.join(', ')}.\n`
            : '') +
          (assetInsight.avoidHints?.length
            ? `- Avoid these weak/off-brand cues: ${assetInsight.avoidHints.join(', ')}.\n`
            : '') +
          'Translate these cues into a new original premium campaign visual. Do not copy the uploaded images exactly, do not collage them, and do not paste them into the poster. Use them to avoid generic stock imagery and preserve brand consistency.\n\n'
        )
      : '';

  // Derive luxury tier from combined cues: profile, visual style, audience.
  const audienceLower = (profile.audience ?? profile.targetAudience ?? '').toLowerCase();
  const descLower = (profile.description ?? profile.websiteSummary ?? '').toLowerCase();
  const isLuxury = ['luxury', 'premium', 'high-end', 'exclusive', 'boutique', 'vip', 'elite'].some(
    (kw) => audienceLower.includes(kw) || descLower.includes(kw) || visualStyle.includes(kw),
  );
  const luxuryTier = isLuxury ? 'luxury/premium brand' : 'professional quality brand';

  // Uniqueness & differentiator copy from profile
  const uniqueness = [profile.uniqueness, profile.description]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' — ')
    .slice(0, 200);

  // Target audience description
  const targetAudience = (profile.audience ?? profile.targetAudience ?? '').trim();

  // Website keywords — high-signal terms for visual context
  const websiteKeywords = (profile.websiteKeywords ?? []).slice(0, 8).join(', ');

  return (
    `Create ONE single premium professional square (1:1) social media advertisement poster for a ${businessType} business.\n` +
    `Design tier: ${luxuryTier}. This is a polished final ad — the quality of a top advertising agency output.\n` +
    'This is the ONLY image being generated — invest everything into making it as good as possible.\n' +
    'No templates, no stock-photo look, no Canva aesthetic. Original, campaign-quality design.\n\n' +

    '═══ BUSINESS PROFILE ═══\n' +
    `Business name: ${businessName || 'no readable brand name available'}.\n` +
    `Business category: ${businessType}.\n` +
    `Brand mood/tone: ${creativePlan?.tone ?? brandMood}.\n` +
    `Brand color palette: ${brandColors}.\n` +
    (targetAudience ? `Target audience: ${targetAudience}.\n` : '') +
    (uniqueness ? `Unique positioning/description: ${uniqueness}.\n` : '') +
    (websiteKeywords ? `Brand keywords: ${websiteKeywords}.\n` : '') +
    (services.length ? `Products/services to feature: ${services.join(', ')}.\n` : '') +
    `Marketing goal: ${postGoal}.\n` +
    `Main message: ${creativePlan?.main_message ?? posterText.headline}.\n\n` +

    '═══ CREATIVE DIRECTION ═══\n' +
    `Poster type: ${posterType}.\n` +
    `Visual style: ${visualStyle}.\n` +
    `Layout direction: ${density} density, ${hierarchy} hierarchy.\n` +
    (creativeDirection ? `Creative visual direction: ${creativeDirection}\n` : '') +
    (styleNotes ? `Style notes: ${styleNotes}\n` : '') +
    `Scene direction: ${stripHebrewForImagePrompt(sceneDescription) || brief.opening}\n` +
    `Industry-specific campaign direction: ${brief.mood} ${brief.palette} ${brief.composition}.\n\n` +

    uploadedAssetDirection +

    '═══ LOGO INTEGRATION ═══\n' +
    (profile.logoUrl
      ? 'A PNG of the real brand logo is attached as a reference image. ' +
        'Place the actual logo into the poster as a designed-in element — NOT as a pasted sticker. ' +
        'PRESERVE the logo PNG\'s native transparency exactly — do NOT add a white card, white rounded square, white pill, white box, white shape, drop shadow card, or any solid background behind it. ' +
        'Transparent pixels stay transparent so the logo sits directly on the poster background. ' +
        'Placement: top corner, bottom corner, elegant signature mark, embossed watermark, or refined brand mark — whatever fits this poster style. ' +
        'Size: small enough to read as branding, never the dominant element. ' +
        'Subtle realistic glow or soft shadow is fine ONLY when it reads as natural lighting — never a flat card. ' +
        'The logo should feel designed-in from the start, not added afterwards.\n'
      : 'No real logo uploaded. If marking the brand at all, render only the business name in compact on-brand typography — no fake logo shapes, no invented mark.\n') +
    '\n' +

    '═══ TYPOGRAPHY ═══\n' +
    `${languageInstruction}\n` +
    'Use ONLY these text elements inside the poster — render nothing else:\n' +
    `${textElementLines}\n` +
    (!textElements.some((element) => element.role === 'cta')
      ? 'No CTA button is needed for this poster.\n'
      : '') +
    'Typography rules: maximum 1–2 primary text lines, generous margins, strong contrast, no more than two font styles. ' +
    'No tiny unreadable text, no text over busy areas, no accidental extra labels. ' +
    'For Hebrew: preserve RTL order, use simple bold readable letterforms, never mirror letters.\n\n' +

    '═══ COMPOSITION & QUALITY ═══\n' +
    'Square 1:1 poster, clear safe margins, no clipping, no text outside margins.\n' +
    'Build a deliberate graphic design system: clean grid, controlled negative space, realistic shadows, elegant gradients only where they improve readability, one dominant focal subject.\n' +
    'Integrate typography with photography using hierarchy and spacing. Avoid default centered layouts unless minimal luxury is explicitly called for.\n' +
    'No duplicated text, no repeated headline, no random words, no overcrowding.\n\n' +

    '═══ AVOID (hard rules) ═══\n' +
    'messy layout, cluttered poster, cheap design, basic Canva look, generic template, generic AI ad, generic stock-photo look, ' +
    'plain photo with text, simple overlay, amateur flyer, duplicated text, random words, bad typography, ' +
    'mirrored Hebrew, broken Hebrew letter order, Hebrew-like glyphs, fake phone number, fake website, fake address, ' +
    'fake QR code, fake hashtags, fake price, blurry, low quality, text outside margins, too many text elements, ' +
    'plastic AI look, flat illustration, distorted hands, distorted letters, gibberish, ' +
    'logo on a white card, logo on a white rounded square, logo on a white pill, logo inside a white box, ' +
    'logo with a solid colored card behind it, logo as a pasted sticker, logo with a heavy drop-shadow card, ' +
    'opaque rectangle behind the logo, fake background behind the logo, white halo around the logo.'
  );
}

// ─── Simple, visual-focused image prompt ─────────────────────────────────────
// Replaces the large buildOpenAICompletePosterPrompt. This prompt is short and
// focuses the image model on visuals + branding. The locked Hebrew text override
// (headline + subtitle) is appended separately via buildHebrewTextOverride.
// ─────────────────────────────────────────────────────────────────────────────
function buildSimpleImagePrompt({
  profile,
  brief,
  assetInsight,
  identity,
  focus,
  shot,
  styleByType,
  servicesFromAllSources,
  postImageType,
}: {
  profile: NonNullable<BusinessProfile>;
  brief: MarketingBrief;
  assetInsight: BrandAssetInsight | null;
  identity: VisualIdentity;
  focus: ReturnType<typeof pickVisualFocus>;
  shot: ReturnType<typeof pickShotType>;
  styleByType: ReturnType<typeof resolveBusinessStyle>;
  servicesFromAllSources: string[];
  postImageType: PostImageType;
}): string {
  const businessType = englishOnlyOrEmpty(profile.businessType) || (profile.businessType ?? 'business');
  const businessName = profile.businessName?.trim() ?? '';
  const brandColors = (profile.brandColors ?? identity.colorPalette).trim();
  const services = dedupe([
    profile.services ?? '',
    ...(profile.websiteServices ?? []),
    ...servicesFromAllSources,
  ])
    .filter(Boolean)
    .slice(0, 5)
    .join(', ');

  const assetBlock =
    assetInsight &&
    (assetInsight.visualStyleSummary ||
      assetInsight.productHints.length ||
      assetInsight.atmosphereHints?.length ||
      assetInsight.colorHints?.length)
      ? 'Visual reference from uploaded business photos (style only — do not copy or paste):\n' +
        (assetInsight.visualStyleSummary ? `Style: ${assetInsight.visualStyleSummary}.\n` : '') +
        (assetInsight.productHints.length
          ? `Subjects: ${assetInsight.productHints.join(', ')}.\n`
          : '') +
        (assetInsight.atmosphereHints?.length
          ? `Atmosphere: ${assetInsight.atmosphereHints.join(', ')}.\n`
          : '') +
        (assetInsight.lightingHints?.length
          ? `Lighting: ${assetInsight.lightingHints.join(', ')}.\n`
          : '') +
        (assetInsight.colorHints?.length
          ? `Colors/materials: ${assetInsight.colorHints.join(', ')}.\n`
          : '') +
        (assetInsight.avoidHints?.length
          ? `Avoid: ${assetInsight.avoidHints.join(', ')}.\n`
          : '')
      : '';

  if (postImageType === 'photo') {
    return (
      `Commercial photograph for a ${businessType} business.\n` +
      `Scene: ${brief.visualDirection}\n` +
      `Visual identity: ${brandColors}, ${identity.lightingStyle}, ${identity.mood}.\n` +
      (styleByType ? `Industry style: ${styleByType.direction}\n` : '') +
      (services ? `Subject focus: ${services}.\n` : '') +
      assetBlock +
      `Focus: ${focus.direction}\nComposition: ${shot.direction}\n` +
      'Ultra-realistic commercial photography. No text, no logos, no overlays. ' +
      ANTI_AI_GUARD
    );
  }

  const languageInstruction =
    brief.languageMode === 'hebrew'
      ? 'Text language: Hebrew (RTL). Render ONLY the listed Hebrew words. ' +
        'CRITICAL HEBREW TEXT RULES: ' +
        '(a) Every character must be a genuine Hebrew letter — ZERO Latin/English characters allowed inside Hebrew words. ' +
        'Do NOT substitute any Hebrew letter with a visually similar Latin character (e.g., never use "Y", "X", "O", "I", "1", "l" for any Hebrew letter). ' +
        '(b) Word order: right-to-left. First letter on the right, last letter on the left. ' +
        '(c) If a word has only 2–4 letters, keep it on one line — never break it. ' +
        '(d) If you cannot render a Hebrew glyph accurately, use a simpler font with larger letterforms and more spacing rather than substituting characters. ' +
        '(e) No decorative swashes, diacritics, or punctuation unless it was in the approved text.'
      : 'Text language: English. Render the listed English words only.';

  return (
    `Create ONE complete professional square (1:1) social media advertisement poster for a ${businessType} business.\n` +
    'Target quality: premium ChatGPT-style generated image quality, polished final Israeli Instagram/Facebook ad, high-end creative agency finish.\n' +
    'This must look like a finished designed marketing post, not a random photo with text and not a generic AI image.\n' +
    'Design quality: luxury commercial layout, strong visual hierarchy, realistic premium photography, clean typography system, refined spacing, CTA-style design language when the approved text calls for it.\n\n' +
    `BRAND\n` +
    `Business: ${businessName || businessType}.\n` +
    `Colors: ${brandColors}.\n` +
    `Mood/tone: ${brief.visualStyle}, ${identity.mood}.\n` +
    (services ? `Products/services: ${services}.\n` : '') +
    (profile.logoUrl
      ? 'Logo: PNG attached. Integrate as a designed-in element. Preserve native transparency — NO white card, box, or background behind it. Place as a small refined brand mark.\n'
      : businessName
        ? `Brand name: render "${businessName}" as compact on-brand typography.\n`
        : '') +
    '\nVISUAL DIRECTION\n' +
    `${brief.visualDirection}\n` +
    `Visual style: ${brief.visualStyle}.\n` +
    (styleByType ? `Industry: ${styleByType.direction}\n` : '') +
    `Focus: ${focus.direction}\nComposition: ${shot.direction}\n` +
    assetBlock +
    '\nTYPOGRAPHY\n' +
    `${languageInstruction}\n` +
    'Render ONLY the text elements listed in the APPROVED TEXT section below.\n' +
    'Use professional poster typography: large bold headline, clean secondary line, strong contrast, generous safe margins, clean hierarchy, no duplicated text, no random words.\n' +
    'For Hebrew: prefer fewer, larger words over small crowded copy. Give each word enough space so every letter is legible. ' +
    'Hebrew words must not overlap the main visual subject — place text in a clear zone (bottom band, top area, or a contrasting overlay strip).\n' +
    'Use a clean CTA button/pill only if an approved CTA text element is provided; otherwise do not invent a CTA.\n' +
    '\nAVOID\n' +
    'cluttered layout, cheap Canva look, generic AI ad, plain stock photo, random photo with text overlay, logo on white card, logo sticker, ' +
    'fake phone/price/URL/QR code, duplicated text, distorted letters, broken Hebrew, mirrored RTL text, blurry, low quality, ' +
    'Latin/English letters mixed into Hebrew words, random stray letters (e.g., a lone "Y" or "X") near Hebrew text, ' +
    'substituted characters that resemble Hebrew but are not Hebrew, any non-Hebrew character inside a Hebrew word.'
  );
}

// ─── Logo input for OpenAI images.edit ───────────────────────────────────────
// Downloads the brand logo (from Convex storage URL or any public URL) and
// hands it to the OpenAI SDK as an Uploadable. The PNG buffer is passed
// untouched so the model receives the original transparency. Returns null
// on any failure — the caller falls back to images.generate without a logo
// reference, so a flaky logo download never blocks generation.
async function fetchLogoAsUploadable(
  logoUrl: string | undefined,
): Promise<{ file: Uploadable; bytes: number; contentType: string } | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      devWarn('Logo fetch returned non-2xx; skipping logo reference', {
        status: response.status,
      });
      return null;
    }
    const contentType = response.headers.get('content-type') ?? 'image/png';
    // OpenAI images.edit accepts PNG / JPG / WEBP. Anything else gets skipped.
    if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
      devWarn('Logo content-type not supported by images.edit; skipping', {
        contentType,
      });
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 25 * 1024 * 1024) {
      devWarn('Logo larger than 25MB; skipping logo reference', {
        bytes: arrayBuffer.byteLength,
      });
      return null;
    }
    const ext =
      contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
      : contentType.includes('webp') ? 'webp'
      : 'png';
    const file = await toFile(Buffer.from(arrayBuffer), `logo.${ext}`, {
      type: contentType,
    });
    return { file, bytes: arrayBuffer.byteLength, contentType };
  } catch (error) {
    devWarn('Logo fetch threw; skipping logo reference', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function generateImageWithOpenAI({
  openai,
  prompt,
  role,
  languageMode,
  logoFile,
  acc,
}: {
  openai: OpenAI;
  prompt: string;
  role: 'photo' | 'complete_poster';
  languageMode: PosterLanguageMode;
  logoFile?: Uploadable | null;
  acc: CostAccumulator;
}): Promise<string | null> {
  const configuredModel = process.env.OPENAI_IMAGE_MODEL?.trim();
  const model = BEST_OPENAI_IMAGE_MODEL;
  const usesLogoReference = Boolean(logoFile);
  const apiSurface = usesLogoReference ? 'images.edit' : 'images.generate';

    devInfo('🟢 OPENAI IMAGE REQUEST START', {
      model,
      configuredModel: configuredModel || null,
      ignoredConfiguredModel: configuredModel && configuredModel !== BEST_OPENAI_IMAGE_MODEL ? configuredModel : null,
    apiSurface,
    role,
    languageMode,
    size: '1024x1024',
      quality: 'high',
      usesLogoReference,
      promptLength: prompt.length,
    });

  try {
    const imageResponse = usesLogoReference && logoFile
      ? await openai.images.edit({
          model,
          image: logoFile,
          prompt,
          size: '1024x1024',
          quality: 'high',
          n: 1,
        })
      : await openai.images.generate({
          model,
          prompt,
          size: '1024x1024',
          quality: 'high',
          n: 1,
        });

    const imageBase64 = imageResponse.data?.[0]?.b64_json ?? '';
    if (!imageBase64) {
      throw new Error('OpenAI Image API returned no image data');
    }

    devInfo('🟢 OPENAI IMAGE RESPONSE', {
      model,
      apiSurface,
      role,
      languageMode,
      bytesReturned: imageBase64.length,
    });

    trackImageCost(acc, role, model, usesLogoReference ? 'edit' : 'generate');
    return imageBase64;
  } catch (error) {
    // Extract full OpenAI error details before any re-throw
    const isApiError = error != null && typeof error === 'object' && 'status' in error;
    const status    = isApiError ? (error as { status?: number }).status    : undefined;
    const errType   = isApiError ? (error as { type?: string }).type        : undefined;
    const errCode   = isApiError ? (error as { code?: string }).code        : undefined;
    const errParam  = isApiError ? (error as { param?: string }).param      : undefined;
    const rawMsg    = error instanceof Error ? error.message : String(error);
    const innerMsg  = isApiError
      ? ((error as { error?: { message?: string } }).error?.message ?? null)
      : null;

    // Classify the failure so logs are actionable
    let failureClass = 'UNKNOWN';
    if (status === 401 || errCode === 'invalid_api_key') {
      failureClass = 'MISSING_OR_INVALID_API_KEY';
    } else if (status === 429 || errType === 'insufficient_quota' || errCode === 'insufficient_quota') {
      failureClass = 'QUOTA_OR_BILLING_EXCEEDED';
    } else if (errCode === 'model_not_found' || (rawMsg.includes('model') && status === 404)) {
      failureClass = 'MODEL_NOT_FOUND';
    } else if (status === 400 && (rawMsg.toLowerCase().includes('content') || rawMsg.toLowerCase().includes('policy') || rawMsg.toLowerCase().includes('safety'))) {
      failureClass = 'PROMPT_CONTENT_POLICY';
    } else if (status === 400) {
      failureClass = 'BAD_REQUEST';
    } else if (status != null && status >= 500) {
      failureClass = 'OPENAI_SERVER_ERROR';
    } else if (!status && rawMsg.toLowerCase().includes('network')) {
      failureClass = 'NETWORK_ERROR';
    }

    devError('🔴 OPENAI_IMAGE_GENERATION_FAILED_FULL_ERROR', error);
    devError('🔴 OPENAI_IMAGE_GENERATION_FAILED', {
      failureClass,
      model,
      role,
      languageMode,
      httpStatus:   status   ?? null,
      errorType:    errType  ?? null,
      errorCode:    errCode  ?? null,
      errorParam:   errParam ?? null,
      errorMessage: rawMsg,
      innerMessage: innerMsg,
      apiKeyPresent: Boolean(openai.apiKey),
      apiKeyPrefix:  openai.apiKey ? openai.apiKey.slice(0, 7) + '...' : null,
    });

    // Return null so the caller can still deliver the text post
    return null;
  }
}

// ─── Unified marketing brief (replaces caption + scene + creative plan calls) ──
// One gpt-4o-mini call that returns caption, headline, optional subtitle, visual
// style, poster type, and a short English visual direction for the image model.
// All previous separate calls (caption, scene, creative plan, hebrew polish step 1)
// are collapsed into this single call.
// ─────────────────────────────────────────────────────────────────────────────

type ImageTextMode = 'none' | 'headline_only' | 'headline_and_subtitle';

type MarketingBrief = {
  caption: string;
  headline: string;
  subtitle: string | null;
  visualStyle: CreativeVisualStyle;
  posterType: PosterType;
  visualDirection: string;
  languageMode: PosterLanguageMode;
  hashtags: string[];
  imageTextMode: ImageTextMode;
};

async function generateMarketingBrief(
  openai: OpenAI,
  profile: NonNullable<BusinessProfile>,
  topic: string,
  postGoal: PostGoal,
  assetInsight: BrandAssetInsight | null,
  recentPostSummaries: string[],
  languageMode: PosterLanguageMode,
  acc: CostAccumulator,
): Promise<MarketingBrief> {
  const businessName = profile.businessName?.trim() ?? '';
  const businessType = englishOnlyOrEmpty(profile.businessType) || (profile.businessType ?? '');
  const description = [profile.description, profile.websiteSummary]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 250);
  const audience = (profile.audience ?? profile.targetAudience ?? '').trim();
  const tone = (profile.tone ?? profile.websiteTone ?? profile.style ?? '').trim();
  const services = dedupe([
    profile.services ?? '',
    ...(profile.websiteServices ?? []),
    ...(assetInsight?.productHints ?? []),
  ])
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');

  const assetCues = assetInsight
    ? [
        assetInsight.visualStyleSummary,
        assetInsight.productHints.length ? `products seen: ${assetInsight.productHints.join(', ')}` : '',
        assetInsight.atmosphereHints?.length ? `atmosphere: ${assetInsight.atmosphereHints.join(', ')}` : '',
        assetInsight.lightingHints?.length ? `lighting: ${assetInsight.lightingHints.join(', ')}` : '',
        assetInsight.colorHints?.length ? `colors: ${assetInsight.colorHints.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ')
        .slice(0, 300)
    : '';

  const hebrewRules =
    languageMode === 'hebrew'
      ? '\n\nHEBREW copy rules:\n' +
        '• Caption: natural Israeli Hebrew, 2–4 short sentences, Instagram/Facebook style\n' +
        '• Headline: 2–4 Hebrew words, short and punchy (e.g., "מתחילים חזק", "תוצאה שרואים", "טעם של יפן")\n' +
        '• Subtitle: null unless it genuinely adds a second beat; if used, 2–4 Hebrew words max\n' +
        '• NO robotic phrasing, NO literal English translations, NO generic AI slogans\n' +
        '• Brand name stays in English if it is an English name'
      : '';

  const fallback: MarketingBrief = {
    caption: `${businessName} — ${services || businessType}`.trim(),
    headline: businessName || businessType || 'הזמינו עכשיו',
    subtitle: null,
    visualStyle: 'premium',
    posterType: 'brand',
    visualDirection: `A premium professional ${businessType} marketing photo. Clean composition, high-end photography, brand-focused.`,
    languageMode,
    hashtags: [],
    imageTextMode: 'headline_only',
  };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content:
            'You are an Israeli social media marketing expert and creative director. ' +
            'Generate concise, high-quality marketing copy and a visual scene for a social media poster. ' +
            'Return JSON only.',
        },
        {
          role: 'user',
          content:
            // ── USER CREATIVE REQUEST: placed first so GPT treats it as the primary driver ──
            (topic
              ? `USER CREATIVE REQUEST (highest priority — follow this exactly, do NOT replace it with a generic angle):\n"${topic}"\n\n`
              : '') +
            // ── BUSINESS CONTEXT: supporting information only ──
            `Business: ${businessName || 'unnamed'}\n` +
            `Type: ${businessType || 'general'}\n` +
            (description ? `Description: ${description}\n` : '') +
            (audience ? `Audience: ${audience}\n` : '') +
            (services ? `Services/products: ${services}\n` : '') +
            (tone ? `Brand tone: ${tone}\n` : '') +
            (!topic ? 'Topic: choose the best angle for this business\n' : '') +
            `Goal: ${postGoal}\n` +
            (assetCues ? `Visual cues from uploaded images: ${assetCues}\n` : '') +
            (recentPostSummaries.length
              ? `Avoid repeating these recent posts: ${recentPostSummaries.slice(0, 3).join(' | ')}\n`
              : '') +
            hebrewRules +
            '\n\nReturn JSON with exactly this structure:\n' +
            '{\n' +
            `  "caption": "social media caption in ${languageMode === 'hebrew' ? 'Hebrew' : 'English'}. Write 3-5 lines of authentic marketing text. Do NOT include hashtags here.",\n` +
            `  "headline": "poster headline in ${languageMode === 'hebrew' ? 'Hebrew' : 'English'}, 2–4 words",\n` +
            '  "subtitle": "short second line or null",\n' +
            '  "visual_style": "premium|bold|minimal|elegant|dramatic|luxury|friendly|energetic",\n' +
            '  "poster_type": "brand|promotion|product_spotlight|booking|seasonal|offer|announcement",\n' +
            (topic
              ? '  "visual_direction": "English only: 2-3 sentences. The scene MUST visually depict the USER CREATIVE REQUEST above — translate it literally into the described image scene. Then add lighting and mood to match the business brand. No text or logos.",\n'
              : '  "visual_direction": "English only: 2-3 sentences describing the hero subject, setting, lighting, and mood for an AI image generator. No text or logos.",\n') +
            '  "image_text_mode": "Choose one: none | headline_only | headline_and_subtitle. ' +
            'Use none ~30% of the time (clean image, no text overlay — best for luxury, elegant, minimal styles or when the visual tells the whole story). ' +
            'Use headline_only ~40% of the time (one short punchy headline on the image). ' +
            'Use headline_and_subtitle ~30% of the time (headline + subtitle — best for promotions, offers, bold styles). ' +
            'Never use headline_and_subtitle for minimal/luxury visual styles unless it is a clear promotion.",\n' +
            '  "hashtags": ["5 to 10 relevant hashtags as strings, each starting with #. Mix Hebrew and English. Specific to this business type and topic. Examples for a nail salon: #ציפורניים, #מניקור, #לקג\'ל, #nails, #nailart, #פדיקור, #סלון. Do NOT use overly generic tags like #business or #marketing."]\n' +
            '}',
        },
      ],
    });

    trackTextCost(acc, 'marketing_brief', 'gpt-4o-mini', response.usage);

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      devWarn('[MarketingBrief] non-JSON response, using fallback');
      return fallback;
    }

    const headline = cleanPosterText(parsed.headline, 80) || fallback.headline;
    const subtitleRaw = parsed.subtitle;
    const subtitle =
      subtitleRaw &&
      String(subtitleRaw).trim() &&
      String(subtitleRaw).toLowerCase() !== 'null'
        ? cleanPosterText(subtitleRaw, 80) || null
        : null;

    const rawImageTextMode = String(parsed.image_text_mode ?? '').trim().toLowerCase();
    const imageTextMode: ImageTextMode =
      rawImageTextMode === 'none' ? 'none' :
      rawImageTextMode === 'headline_and_subtitle' ? 'headline_and_subtitle' :
      'headline_only';

    const rawHashtags = parsed.hashtags;
    const hashtags: string[] = Array.isArray(rawHashtags)
      ? rawHashtags
          .map((h: unknown) => String(h ?? '').trim())
          .filter((h) => h.startsWith('#') && h.length > 1)
          .slice(0, 12)
      : [];

    const brief: MarketingBrief = {
      caption: cleanCaptionText(parsed.caption, 950) || fallback.caption,
      headline,
      subtitle,
      visualStyle: normalizeVisualStyle(parsed.visual_style, 'premium'),
      posterType: normalizePosterType(parsed.poster_type, 'brand'),
      visualDirection:
        stripHebrewForImagePrompt(String(parsed.visual_direction ?? '')).slice(0, 500) ||
        fallback.visualDirection,
      languageMode,
      hashtags,
      imageTextMode,
    };

    devInfo('[MarketingBrief] generated', {
      postGoal,
      languageMode,
      visualStyle: brief.visualStyle,
      posterType: brief.posterType,
      captionLength: brief.caption.length,
      imageTextMode: brief.imageTextMode,
      hashtagCount: brief.hashtags.length,
    });

    return brief;
  } catch (error) {
    const isApiError = error != null && typeof error === 'object' && 'status' in error;
    const status  = isApiError ? (error as { status?: number }).status : undefined;
    const errCode = isApiError ? (error as { code?: string }).code : undefined;
    const rawMsg  = error instanceof Error ? error.message : String(error);
    const innerMsg = isApiError
      ? ((error as { error?: { message?: string } }).error?.message ?? null)
      : null;
    devError('🔴 [MarketingBrief] OpenAI call FAILED — using fallback', {
      httpStatus: status ?? null,
      errorCode: errCode ?? null,
      errorMessage: rawMsg,
      innerMessage: innerMsg,
      fullError: String(error),
    });
    return fallback;
  }
}

// ─── Hebrew copy refinement ───────────────────────────────────────────────────
// Takes the raw headline + subtitle from the brief, runs a dedicated
// editor pass, returns validated elements and a quality score.
// If quality is low or the call fails, returns the originals unchanged.
// ─────────────────────────────────────────────────────────────────────────────

type HebrewRefinementResult = {
  refinedElements: TextElement[];
  qualityScore: number; // 0–10; <6 triggers a warning but still uses refined
};

type HebrewMarketingPolishResult = {
  captionText: string;
  textElements: TextElement[];
  qualityScore: number;
  notes: string;
};

function cleanCaptionText(value: unknown, maxLength = 950): string {
  return String(value ?? '')
    .replace(/^```(?:\w+)?/g, '')
    .replace(/```$/g, '')
    .replace(/^\s*(?:כיתוב|caption|final caption)\s*[:：-]\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

async function polishHebrewMarketingCopy(
  openai: OpenAI,
  {
    profile,
    postGoal,
    captionText,
    textElements,
  }: {
    profile: NonNullable<BusinessProfile>;
    postGoal: PostGoal;
    captionText: string;
    textElements: TextElement[];
  },
  acc: CostAccumulator,
): Promise<HebrewMarketingPolishResult> {
  const hasHebrew = /[֐-׿]/.test(
    `${captionText} ${textElements.map((element) => element.text).join(' ')}`,
  );
  const fallback: HebrewMarketingPolishResult = {
    captionText: cleanCaptionText(captionText) || captionText,
    textElements,
    qualityScore: hasHebrew ? 7 : 10,
    notes: hasHebrew ? 'fallback_original_copy' : 'no_hebrew_to_polish',
  };

  if (!hasHebrew) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 850,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'אתה קופירייטר ישראלי בכיר לסושיאל מדיה, מומחה בשיווק עברי לעסקים קטנים. ' +
            'אתה יוצר עברית שיווקית קצרה, טבעית, ישראלית — כמו שמנהל/ת סושיאל מנוסה היה כותב/ת. ' +
            'אתה לא מתרגם מאנגלית. אתה לא כותב פואטיקה. אתה כותב ישיר, ברור, ואנושי. ' +
            'החזר JSON בלבד.',
        },
        {
          role: 'user',
          content:
            'כתוב/י קופי שיווקי עברי לפוסטר ולכיתוב על בסיס הטיוטה הבאה.\n\n' +
            `שם העסק: ${profile.businessName ?? ''}\n` +
            `סוג העסק: ${profile.businessType ?? ''}\n` +
            `קהל יעד: ${profile.audience ?? profile.targetAudience ?? ''}\n` +
            `טון/סגנון: ${profile.tone ?? profile.style ?? profile.websiteTone ?? ''}\n` +
            `מטרה: ${postGoal}\n\n` +
            `כיתוב נוכחי:\n${captionText}\n\n` +
            `טקסטים לפוסטר:\n${JSON.stringify(textElements)}\n\n` +
            '━━━ כללים לטקסטים של הפוסטר (חשוב מאוד) ━━━\n' +
            '• מקסימום 3 אלמנטים בסך הכל (כולל brand_name)\n' +
            '• כל אלמנט: 2 עד 5 מילים בלבד. לא יותר.\n' +
            '• עברית ישראלית טבעית — לא תרגום מאנגלית, לא ניסוחים פורמליים\n' +
            '• בלי משפטים ארוכים, בלי כתיבה פואטית, בלי שאלות מרגישות\n' +
            '• דוגמאות טובות: "מתחילים חזק", "תוצאה שרואים", "אימון שמתאים בדיוק אליך"\n' +
            '• דוגמאות גרועות: "גלה את הדרך לאורח חיים בריא ומאוזן", "הצטרפו למהפכה התזונתית שלנו"\n' +
            '• CTA רק אם מתאים. אפשרויות טבעיות: "קבעו תור", "דברו איתנו", "לפרטים", "בואו לטעום"\n' +
            '• אל תמציא מחירים, הנחות, פרטים שלא הופיעו\n' +
            '• שמות מותג באנגלית — השאר בדיוק כפי שהם\n\n' +
            '━━━ כללים לכיתוב הסושיאל ━━━\n' +
            '• 2-5 שורות קצרות, מתאים לאינסטגרם/פייסבוק\n' +
            '• אפשר אימוג׳ים במידה, לא להגזים בהאשטגים\n\n' +
            'החזר JSON במבנה הזה בלבד:\n' +
            '{ "caption_he": "כיתוב מלוטש", "text_elements": [{"role":"headline|subheadline|offer|cta|brand_name","text":"...","importance":"primary|secondary|small"}], "quality_score": 0-10, "notes": "קצר" }',
        },
      ],
    });

    trackTextCost(acc, 'hebrew_polish', 'gpt-4o-mini', response.usage);

    const parsed = parseJsonObject(response.choices[0]?.message?.content?.trim() ?? '');
    if (!parsed) {
      devWarn('[HebrewPolish] non-JSON response, using original copy');
      return fallback;
    }

    const polishedCaption = cleanCaptionText(parsed.caption_he, 950) || fallback.captionText;
    const polishedElements = textElements.length
      ? normalizeTextElements(parsed.text_elements, textElements).slice(0, 3)
      : [];
    const qualityScore =
      typeof parsed.quality_score === 'number'
        ? Math.max(0, Math.min(10, Math.round(parsed.quality_score)))
        : 8;
    const notes = String(parsed.notes ?? '').trim().slice(0, 180) || 'polished';

    devInfo('[HebrewPolish] copy polished', {
      postGoal,
      originalCaptionLength: captionText.length,
      polishedCaptionLength: polishedCaption.length,
      originalElementCount: textElements.length,
      polishedElementCount: polishedElements.length,
      qualityScore,
      notes,
    });

    return {
      captionText: polishedCaption,
      textElements: polishedElements,
      qualityScore,
      notes,
    };
  } catch (error) {
    devWarn('[HebrewPolish] threw, using original copy', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

// Step 2 of the Hebrew copy pipeline — critical editor pass.
// Runs inside Quality Boost after polishHebrewMarketingCopy (Step 1).
// Conservative temperature (0.2) so edits are surgical, not creative.
async function refineAndValidateHebrewCopy(
  openai: OpenAI,
  textElements: TextElement[],
  acc: CostAccumulator,
): Promise<HebrewRefinementResult> {
  const hebrewCharPattern = /[֐-׿]/;
  const fallback: HebrewRefinementResult = { refinedElements: textElements, qualityScore: 7 };

  const hebrewElements = textElements.filter((el) => hebrewCharPattern.test(el.text));
  if (hebrewElements.length === 0) return fallback;

  const elementsJson = JSON.stringify(
    textElements.map((el) => ({ role: el.role, text: el.text, importance: el.importance })),
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'אתה עורך עברית בכיר לשיווק ישראלי. ' +
            'תפקידך: לסקור טקסטים לפוסטר ולתקן כל מה שנשמע לא טבעי, מתורגם, ארוך, רובוטי או לא ישראלי. ' +
            'אם טקסט טוב — אל תשנה אותו. ' +
            'החזר JSON בלבד.',
        },
        {
          role: 'user',
          content:
            'סקור את הטקסטים הבאים לפוסטר שיווקי. תקן רק מה שצריך תיקון.\n\n' +
            `טקסטים: ${elementsJson}\n\n` +
            'תקן אם קיים:\n' +
            '✗ שגיאות כתיב בעברית\n' +
            '✗ שגיאות דקדוק\n' +
            '✗ ניסוחים מוזרים או שנשמעים מתורגמים מאנגלית\n' +
            '✗ שפה רובוטית ופורמלית מדי (כמו "גלה את הפתרון המושלם שלך")\n' +
            '✗ CTA לא טבעי (כמו "הזמינו עכשיו" — אלא אם זה ממש מתאים)\n' +
            '✗ שורות ארוכות מ-5 מילים — קצר אותן\n' +
            '✗ יותר מ-3 אלמנטים — מחק עודפים\n\n' +
            'דוגמאות לעברית טובה בפוסטר: "מתחילים חזק", "תוצאה שרואים", "הגיע הזמן להשקיע בעצמך", "קבעו אימון ניסיון", "תזונה. כוח. תוצאות."\n' +
            'דוגמאות לעברית גרועה: "גלה את הדרך לאורח חיים בריא", "הצטרפו למהפכה שלנו", "חוו חוויה מדהימה"\n\n' +
            'שמות מותג באנגלית — השאר בדיוק כפי שהם.\n\n' +
            'החזר JSON:\n' +
            '{ "refined_elements": [{"role":"...","text":"...","importance":"..."}], ' +
            '"quality_score": <0-10>, "issues_found": "תיאור קצר או ריק" }',
        },
      ],
    });

    trackTextCost(acc, 'hebrew_editor', 'gpt-4o-mini', response.usage);

    const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      devWarn('[HebrewEditor] non-JSON response, using step-1 elements');
      return fallback;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      refined_elements?: unknown[];
      quality_score?: number;
      issues_found?: string;
    };

    const qualityScore =
      typeof parsed.quality_score === 'number'
        ? Math.max(0, Math.min(10, Math.round(parsed.quality_score)))
        : 7;

    const refinedElements =
      Array.isArray(parsed.refined_elements) && parsed.refined_elements.length > 0
        ? normalizeTextElements(parsed.refined_elements, textElements)
        : textElements;

    const capped = refinedElements.slice(0, 3);

    devInfo('[HebrewEditor] ✅ Step 2 complete', {
      originalCount: textElements.length,
      approvedCount: capped.length,
      qualityScore,
      issuesFixed: parsed.issues_found || 'none',
    });

    if (qualityScore < 5) {
      devWarn('[HebrewEditor] low quality score after edit — check logs', { qualityScore });
    }

    return { refinedElements: capped, qualityScore };
  } catch (error) {
    devWarn('[HebrewEditor] threw, using step-1 elements', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

// Builds the final Hebrew text instruction appended to each candidate's prompt.
// These words were written by a copywriter (Step 1) and reviewed by an editor
// (Step 2). The image model must use ONLY these words — no invention allowed.
function buildHebrewTextOverride(approvedElements: TextElement[]): string {
  if (approvedElements.length === 0) return '';
  const lines = approvedElements
    .map((el, i) => `  ${i + 1}. ${el.role} (${el.importance}): "${el.text}"`)
    .join('\n');
  return (
    '\n\n' +
    '══════════ FINAL APPROVED HEBREW TEXT — DO NOT DEVIATE ══════════\n' +
    'Professional Israeli copywriters reviewed and approved these exact words.\n' +
    'Render ONLY the following Hebrew text inside the poster — nothing else:\n\n' +
    lines + '\n\n' +
    'ABSOLUTE RULES for Hebrew text in this poster:\n' +
    '1. Use ONLY the Hebrew words listed above — these are the final, approved words.\n' +
    '2. Do NOT invent, add, or improvise any Hebrew text of your own.\n' +
    '3. Do NOT render any Hebrew characters that are not in the approved list above.\n' +
    '4. Do NOT translate these words or add English alongside them.\n' +
    '5. If a word looks short — that is intentional. Keep it exactly as written.\n' +
    '6. CRITICAL — PURE HEBREW ONLY: Every character in every Hebrew word must be a real Hebrew letter (Unicode block U+05D0–U+05EA). ' +
    'ZERO Latin or English letters are allowed inside or attached to Hebrew words. ' +
    'Do NOT replace any Hebrew letter with a visually similar Latin character — for example: ' +
    'never use "Y" instead of "י" or "ל", never use "O" instead of "ו" or "ס", never use "1" instead of "ו", ' +
    'never use "X" instead of any Hebrew letter. Each word must be rendered using only authentic Hebrew glyphs.\n' +
    '7. Do NOT split a Hebrew word across two lines unless the word itself is long. Short 2–4 letter words must stay on one line.\n' +
    '8. If your text renderer cannot reproduce a specific Hebrew glyph cleanly, simplify the typography (larger font, fewer words, more spacing) ' +
    'but keep every letter exactly as specified — do not substitute, skip, or add characters.\n' +
    '9. Render the text RIGHT-TO-LEFT. The first letter of each word must appear on the right side, the last letter on the left.\n' +
    '══════════════════════════════════════════════════════════════════'
  );
}



const ANTI_AI_GUARD =
  'AVOID the typical AI-generated look: no smiling person holding product to camera, ' +
  'no generic happy customer cliché, no over-saturated unrealistic colors, ' +
  'no plastic flawless CGI skin, no sterile empty backgrounds, no impossible perfection. ' +
  'Embrace asymmetry, natural imperfections, lived-in environments, documentary realness for photographic parts. ';

// Deployment sentinel. If this string is NOT in your Convex logs when you
// generate a post, your Convex deployment is running an older build of this
// file and you must redeploy (`npx convex deploy` or restart `npx convex dev`).
const IMAGE_PIPELINE_VERSION = 'openai-gpt-image-2-single-2026-06-02';

// Module-load log: fires once per cold start.
devInfo('[generatePost] module loaded', {
  IMAGE_PIPELINE_VERSION,
  imageModel: 'gpt-image-2',
  convexCloudUrl: process.env.CONVEX_CLOUD_URL ?? null,
  convexSiteUrl: process.env.CONVEX_SITE_URL ?? null,
  hasOpenAiApiKeyAtBoot: Boolean(process.env.OPENAI_API_KEY),
});

export const generateMarketingPost = action({
  args: { topic: v.string() },
  handler: async (
    ctx,
    { topic }
  ): Promise<{
    captionText: string;
    imageBase64: string;
    postImageType: PostImageType;
    posterText: PosterText | null;
    posterTemplate: PosterTemplate | null;
    posterLayout: PosterLayout | null;
    creativeTemplate: CreativeTemplate | null;
    visualStyle: CreativeVisualStyle | null;
    imageProvider: 'openai';
    generatedImageUrl: string | null;
    compositionStrategy: CompositionStrategy;
  }> => {
    const handlerStartedAt = Date.now();
    const costAcc: CostAccumulator = { textCalls: [], imageCalls: [] };
    devInfo('🟢 [generateMarketingPost] handler invoked', {
      IMAGE_PIPELINE_VERSION,
      hasTopic: topic.trim().length > 0,
      topicLength: topic.length,
    });

    // Weekly limit gate
    const weekly = await ctx.runQuery(api.users.getWeeklyPostStatus);
    devInfo('🔒 [generateMarketingPost] quota gate', {
      weeklyUsed: weekly.used,
      weeklyRemaining: weekly.remaining,
      weeklyLimit: weekly.limit,
      resetAt: weekly.resetAt,
      isBlocked: weekly.remaining <= 0,
    });
    if (weekly.remaining <= 0) {
      devWarn('🚫 [generateMarketingPost] BLOCKED — quota exhausted');
      throw new Error('WEEKLY_LIMIT_REACHED');
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const openai = new OpenAI({ apiKey });

    // Pull business profile + recent posts in parallel
    const tProfile = Date.now();
    const [profileResult, recentPosts] = await Promise.all([
      ctx.runQuery(api.businessProfiles.getMyBusinessProfile),
      ctx.runQuery(api.posts.getUserPosts),
    ]);
    const profile = profileResult as BusinessProfile;
    devInfo('⏱ [timing] profile+posts loaded', { ms: Date.now() - tProfile });
    if (!profile || !profile.businessName) {
      throw new Error('NO_BUSINESS_PROFILE');
    }
    const recentPostSummaries = recentPosts
      .slice(0, 5)
      .map((post) => String(post.captionText ?? post.content ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((caption, index) => `${index + 1}. ${caption.slice(0, 140)}`);

    const businessContext = buildBusinessContext(profile);
    const visualContext   = buildEnglishVisualContext(profile);
    const businessIdentity = buildBusinessIdentitySummary(profile);
    // Industry detection — falls back to website-scan corpus if businessType
    // is unset, so a sushi shop with no businessType but a scanned site still
    // gets the sushi visual mandate.
    const styleByType     = resolveBusinessStyle(profile);
    const cleanTopic      = topic.trim();
    const hasUserTopic    = cleanTopic.length > 0;

    devInfo('📝 [generateMarketingPost] user input summary', {
      hasUserTopic,
      topicLength: cleanTopic.length,
    });
    // Start logo fetch in background — will be awaited later, parallel with text generation
    const logoPromise = fetchLogoAsUploadable(profile.logoUrl);

    const uploadedBusinessImageUrls = collectUploadedBusinessImageUrls(profile);
    const brandAssetUrls = collectBrandAssetUrls(profile);
    const tAssets = Date.now();
    const assetInsight    = await analyzeBrandAssets(openai, profile, costAcc);
    devInfo('⏱ [timing] brand asset analysis', { ms: Date.now() - tAssets });
    const rawPostImageType = profile.postImageType;
    const postImageType: PostImageType = rawPostImageType ?? 'premium_ad';
    const posterLanguageMode = resolvePosterLanguageMode();
    // ── PROFILE / ROUTING DIAGNOSTIC ─────────────────────────────────────────
    // Convex actions read environment variables from the Convex deployment env.
    // Local .env files do NOT propagate to the Convex cloud — they only feed
    // Expo at build time.
    devInfo('🔎 [generateMarketingPost] routing decision', {
      IMAGE_PIPELINE_VERSION,
      rawProfilePostImageType: rawPostImageType ?? null,
      effectivePostImageType: postImageType,
      willUseProvider: 'openai',
      posterLanguageMode,
      primaryImageModel: BEST_OPENAI_IMAGE_MODEL,
      configuredImageModel: process.env.OPENAI_IMAGE_MODEL?.trim() || null,
      imageModelPolicy: 'use_best_openai_image_model_only',
      hasOpenAiApiKey: Boolean(apiKey),
      readFrom: 'process.env (Convex deployment env)',
    });

    // ── BUSINESS FACTS FEEDING THE PROMPT ────────────────────────────────────
    // These are the exact profile fields the OpenAI image prompt is built from.
    // If the generated image is "unrelated," one of these is probably empty
    // or wrong — check the values here before tuning the prompt.
    devInfo('📋 [generateMarketingPost] business context summary', {
      hasBusinessType: Boolean(profile.businessType),
      hasCity: Boolean(profile.city),
      hasPhone: Boolean(profile.phone),
      hasDescription: Boolean(profile.description),
      hasServices: Boolean(profile.services),
      websiteServiceCount: profile.websiteServices?.length ?? 0,
      hasWebsiteSummary: Boolean(profile.websiteSummary),
      hasUniqueness: Boolean(profile.uniqueness),
      hasAudience: Boolean(profile.audience),
      hasLogo: Boolean(profile.logoUrl),
      uploadedImageCount: (profile.images?.length ?? 0) + (profile.uploadedImages?.length ?? 0),
      uploadedImagesIncludedAsContext: uploadedBusinessImageUrls.length,
      totalBrandAssetsIncludedAsContext: brandAssetUrls.length,
      imageContextUsed: Boolean(assetInsight?.imageContextUsed),
      productHintCount: assetInsight?.productHints?.length ?? 0,
      atmosphereHintCount: assetInsight?.atmosphereHints?.length ?? 0,
      lightingHintCount: assetInsight?.lightingHints?.length ?? 0,
      compositionHintCount: assetInsight?.compositionHints?.length ?? 0,
      colorHintCount: assetInsight?.colorHints?.length ?? 0,
      textureHintCount: assetInsight?.textureHints?.length ?? 0,
      brandingHintCount: assetInsight?.brandingHints?.length ?? 0,
      avoidHintCount: assetInsight?.avoidHints?.length ?? 0,
    });

    // ── WEBSITE SCAN INPUTS FEEDING THE OPENAI IMAGE PROMPT ──────────────────
    // These scanned-from-the-business-website fields anchor premium_ad /
    // designed generation. If a generated poster feels generic or unrelated,
    // check whether these are populated.
    devInfo('📡 [generateMarketingPost] website scan input summary', {
      IMAGE_PIPELINE_VERSION,
      hasWebsite: Boolean(profile.websiteUrl ?? profile.website),
      hasWebsiteScan: Boolean(profile.websiteSummary),
      websiteServiceCount: profile.websiteServices?.length ?? 0,
      websiteKeywordCount: profile.websiteKeywords?.length ?? 0,
      hasWebsiteTone: Boolean(profile.websiteTone),
      resolvedIndustryCategory: styleByType?.category ?? null,
    });

    const servicesFromAllSources = dedupe([
      profile.services ?? '',
      ...(profile.websiteServices ?? []),
      ...(assetInsight?.productHints ?? []),
    ]).filter(Boolean);

    // ── 1. Marketing brief (single call: caption + headline + subtitle + visual direction)
    const postGoal = inferPostGoal(profile, cleanTopic, cleanTopic || profile.businessName || '');
    const identity = getVisualIdentityForBusiness(profile);
    const focus    = pickVisualFocus(styleByType?.category ?? null);
    const shot     = pickShotType();

    devInfo('🎲 [generateMarketingPost] visual randomization', {
      category:    styleByType?.category ?? null,
      visualFocus: focus.name,
      shotType:    shot.name,
    });

    const tBrief = Date.now();
    const brief = await generateMarketingBrief(
      openai,
      profile,
      cleanTopic,
      postGoal,
      assetInsight,
      recentPostSummaries,
      posterLanguageMode,
      costAcc,
    );
    devInfo('⏱ [timing] marketing brief', { ms: Date.now() - tBrief });

    // ── DEV LOG: brief returned by GPT ────────────────────────────────────────
    devInfo('📋 [generateMarketingPost] marketing brief summary', {
      hasUserInput: Boolean(cleanTopic),
      captionLength: brief.caption.length,
      headlineLength: brief.headline.length,
      subtitleLength: brief.subtitle?.length ?? 0,
      visualDirectionLength: brief.visualDirection.length,
      visualStyle: brief.visualStyle,
      posterType: brief.posterType,
      imageTextMode: brief.imageTextMode,
    });

    // Append hashtags to caption (after a blank line, space-separated)
    const hashtagSuffix =
      brief.hashtags.length > 0 ? '\n\n' + brief.hashtags.join(' ') : '';
    let captionText = brief.caption + hashtagSuffix;

    // Build posterText respecting image_text_mode
    const posterText: PosterText | null =
      brief.imageTextMode === 'none'
        ? null
        : {
            headline: brief.headline,
            ...(brief.imageTextMode === 'headline_and_subtitle' && brief.subtitle
              ? { subtitle: brief.subtitle }
              : {}),
          };

    // ── 2. Hebrew editor pass + logo fetch in parallel ───────────────────────
    let hebrewOverride = '';
    if (brief.languageMode === 'hebrew') {
      // Only pass elements that will actually appear on the image
      const hebrewElements: TextElement[] =
        brief.imageTextMode === 'none'
          ? []
          : [
              { role: 'headline', text: brief.headline, importance: 'primary' },
              ...(brief.imageTextMode === 'headline_and_subtitle' && brief.subtitle
                ? [{ role: 'subheadline' as const, text: brief.subtitle, importance: 'secondary' as const }]
                : []),
            ];
      devInfo('[HebrewCopy] editor reviewing copy…', {
        elementCount: hebrewElements.length,
      });
      const tHebrew = Date.now();
      // Run Hebrew refinement and logo fetch in parallel (logo was started earlier)
      const [refinement] = await Promise.all([
        refineAndValidateHebrewCopy(openai, hebrewElements, costAcc),
        logoPromise,
      ]);
      devInfo('⏱ [timing] hebrew edit + logo fetch (parallel)', { ms: Date.now() - tHebrew });
      hebrewOverride = buildHebrewTextOverride(refinement.refinedElements);
      devInfo('[HebrewCopy] ✅ copy locked', {
        qualityScore: refinement.qualityScore,
        finalElementCount: refinement.refinedElements.length,
      });
    }

    // ── 3. Build image prompt + generate ────────────────────────────────────
    // logoPromise was started early; awaiting here is instant if already resolved
    const logoReference = await logoPromise;
    devInfo('🔖 Logo reference', {
      present: Boolean(profile.logoUrl),
      fetched: Boolean(logoReference),
    });

    const imagePrompt = buildSimpleImagePrompt({
      profile,
      brief,
      assetInsight,
      identity,
      focus,
      shot,
      styleByType,
      servicesFromAllSources,
      postImageType,
    });

    const configuredImageModel = process.env.OPENAI_IMAGE_MODEL?.trim();
    const activeImageModel = BEST_OPENAI_IMAGE_MODEL;
    devInfo('🖼 [generateMarketingPost] image request summary', {
      IMAGE_PIPELINE_VERSION,
      postImageType,
      postGoal,
      languageMode: brief.languageMode,
      visualStyle: brief.visualStyle,
      posterType: brief.posterType,
      headlineLength: brief.headline.length,
      subtitleLength: brief.subtitle?.length ?? 0,
      imageModel: activeImageModel,
      configuredImageModel: configuredImageModel || null,
      ignoredConfiguredImageModel:
        configuredImageModel && configuredImageModel !== BEST_OPENAI_IMAGE_MODEL
          ? configuredImageModel
          : null,
      hasLogo: Boolean(logoReference),
      promptLength: (imagePrompt + hebrewOverride).length,
    });

    const tImage = Date.now();
    devInfo('⏱ [timing] image generation started');
    const imageBase64OrNull = await generateImageWithOpenAI({
      openai,
      prompt: imagePrompt + hebrewOverride,
      role: postImageType === 'photo' ? 'photo' : 'complete_poster',
      languageMode: brief.languageMode,
      logoFile: logoReference?.file ?? null,
      acc: costAcc,
    });
    devInfo('⏱ [timing] image generation finished', { ms: Date.now() - tImage });

    const compositionStrategy: CompositionStrategy =
      postImageType === 'photo' ? 'background_with_overlay' : 'complete_image';

    const totalGenerationMs = Date.now() - handlerStartedAt;

    if (imageBase64OrNull === null) {
      // Image generation failed — still deliver the text post so the user
      // sees their caption rather than a hard error screen.
      devWarn('⚠️ [generateMarketingPost] image failed — returning text-only post', {
        IMAGE_PIPELINE_VERSION,
        postImageType,
        postGoal,
        totalGenerationMs,
      });
      await ctx.runMutation(api.users.incrementPostsGenerated);
      return {
        captionText,
        imageBase64: '',
        postImageType,
        posterText: postImageType === 'photo' ? null : posterText,
        posterTemplate: null,
        posterLayout: null,
        creativeTemplate: null,
        visualStyle: postImageType === 'photo' ? null : brief.visualStyle,
        imageProvider: 'openai' as const,
        generatedImageUrl: null,
        compositionStrategy,
      };
    }

    const imageBase64 = imageBase64OrNull;
    devInfo('✅ [generateMarketingPost] done', {
      IMAGE_PIPELINE_VERSION,
      postImageType,
      postGoal,
      languageMode: brief.languageMode,
      visualStyle: brief.visualStyle,
      imageModel: activeImageModel,
      base64Bytes: imageBase64.length,
      totalGenerationMs,
    });

    // ── 4. Cost logging (server-side only — never surfaced to users) ─────────
    const costSummary = summarizeCosts(costAcc);
    devInfo('💰 [Cost] post generation cost breakdown', {
      textModels: costSummary.textModels,
      imageModels: costSummary.imageModels,
      textInputTokens: costSummary.totalTextInputTokens,
      textOutputTokens: costSummary.totalTextOutputTokens,
      estimatedTextUsd: costSummary.totalTextUsd.toFixed(6),
      estimatedImageUsd: costSummary.totalImageUsd.toFixed(6),
      estimatedTotalUsd: costSummary.totalUsd.toFixed(6),
      qualityBoostEnabled: false,
      postImageType,
      totalGenerationMs,
      perCallBreakdown: [
        ...costSummary.textCalls.map((c) => `${c.step}(${c.model}): in=${c.inputTokens} out=${c.outputTokens} $${c.estimatedUsd.toFixed(6)}`),
        ...costSummary.imageCalls.map((c) => `${c.step}(${c.model},${c.operation}): $${c.estimatedUsd.toFixed(6)}`),
      ],
    });

    // Persist cost record and log rolling 3-post summary
    const authIdentity = await ctx.auth.getUserIdentity();
    const costUserId = authIdentity?.subject ?? 'unknown';
    await ctx.runMutation(internal.generationCosts.saveGenerationCost, {
      userId: costUserId,
      estimatedTotalUsd: costSummary.totalUsd,
      estimatedTextUsd: costSummary.totalTextUsd,
      estimatedImageUsd: costSummary.totalImageUsd,
      textInputTokens: costSummary.totalTextInputTokens,
      textOutputTokens: costSummary.totalTextOutputTokens,
      textModels: costSummary.textModels,
      imageModels: costSummary.imageModels,
      qualityBoostEnabled: false,
      postImageType,
      totalGenerationMs,
    });

    const recentCosts = await ctx.runQuery(internal.generationCosts.getRecentGenerationCosts, {
      userId: costUserId,
      limit: 3,
    });
    if (recentCosts.length === 3) {
      const [c1, c2, c3] = recentCosts; // desc order: c1 is most recent
      const rollingTotal = c1.estimatedTotalUsd + c2.estimatedTotalUsd + c3.estimatedTotalUsd;
      devInfo('💰 [Cost] rolling 3-post summary', {
        post1_usd: c3.estimatedTotalUsd.toFixed(6),  // oldest first for readability
        post2_usd: c2.estimatedTotalUsd.toFixed(6),
        post3_usd: c1.estimatedTotalUsd.toFixed(6),
        total3posts_usd: rollingTotal.toFixed(6),
        post1_ms: c3.totalGenerationMs,
        post2_ms: c2.totalGenerationMs,
        post3_ms: c1.totalGenerationMs,
      });
    }

    // ── 5. Increment counter only after successful generation ─────────────────
    await ctx.runMutation(api.users.incrementPostsGenerated);

    devInfo('✅✅ [generateMarketingPost] SUCCESS — returning result', {
      hasImage: Boolean(imageBase64),
      captionLength: captionText.length,
      totalGenerationMs: Date.now() - handlerStartedAt,
    });

    return {
      captionText,
      imageBase64,
      postImageType,
      posterText: postImageType === 'photo' ? null : posterText,
      posterTemplate: null,
      posterLayout: null,
      creativeTemplate: null,
      visualStyle: postImageType === 'photo' ? null : brief.visualStyle,
      imageProvider: 'openai' as const,
      generatedImageUrl: null,
      compositionStrategy,
    };
  },
});

// Helper to extract OpenAI error details for top-level logging in the handler.
// Used below — defined after the closing brace so it doesn't pollute module scope.
function _extractOpenAIErrorDetails(error: unknown) {
  const isApiError = error != null && typeof error === 'object' && 'status' in error;
  return {
    httpStatus: isApiError ? (error as { status?: number }).status ?? null : null,
    errorCode:  isApiError ? (error as { code?: string }).code ?? null : null,
    errorMessage: error instanceof Error ? error.message : String(error),
    innerMessage: isApiError
      ? ((error as { error?: { message?: string } }).error?.message ?? null)
      : null,
  };
}
