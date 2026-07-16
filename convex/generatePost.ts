"use node";
import { v } from 'convex/values';
import type { Uploadable } from 'openai';
import OpenAI, { toFile } from 'openai';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction, type ActionCtx } from './_generated/server';

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
type TextElementRole =
  | 'headline'
  | 'subheadline'
  | 'body'
  | 'offer'
  | 'badge'
  | 'cta'
  | 'footer'
  | 'brand_name';
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

type RemoteImageReference = {
  file: Uploadable;
  bytes: number;
  contentType: string;
};

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
const OPENAI_POSTER_IMAGE_SIZE = '1024x1024';
const OPENAI_PHOTO_IMAGE_SIZE = '1024x1024';
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
  badge?: string;
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

function normalizeTextElementRole(value: unknown): TextElementRole | null {
  const normalized = String(value ?? '').toLowerCase().trim();
  const allowed: TextElementRole[] = [
    'headline',
    'subheadline',
    'body',
    'offer',
    'badge',
    'cta',
    'footer',
    'brand_name',
  ];
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

function normalizeTextElements(
  value: unknown,
  fallback: TextElement[],
  maxElements = 9,
): TextElement[] {
  if (!Array.isArray(value)) return fallback.slice(0, maxElements);
  const maxTextLengthByRole: Record<TextElementRole, number> = {
    headline: 44,
    subheadline: 52,
    body: 72,
    offer: 44,
    badge: 28,
    cta: 34,
    footer: 52,
    brand_name: 44,
  };
  const elements = value
    .map((item): TextElement | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const role = normalizeTextElementRole(raw.role);
      const text = cleanPosterText(raw.text, role ? maxTextLengthByRole[role] : 44);
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
    .slice(0, maxElements);

  return limited.length ? limited : fallback.slice(0, maxElements);
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



// ─── Simple, visual-focused image prompt ─────────────────────────────────────
// Replaces the large buildOpenAICompletePosterPrompt. This prompt is short and
// focuses the image model on visuals + branding. Premium ads use an open
// creative-director prompt; designed mode can still append a locked Hebrew
// text override via buildHebrewTextOverride.
// ─────────────────────────────────────────────────────────────────────────────
function buildSimpleImagePrompt({
  profile,
  brief,
  approvedTextElements,
  assetInsight,
  identity,
  focus,
  shot,
  styleByType,
  servicesFromAllSources,
  postImageType,
  topic,
  postGoal,
}: {
  profile: NonNullable<BusinessProfile>;
  brief: MarketingBrief;
  approvedTextElements: TextElement[];
  assetInsight: BrandAssetInsight | null;
  identity: VisualIdentity;
  focus: ReturnType<typeof pickVisualFocus>;
  shot: ReturnType<typeof pickShotType>;
  styleByType: ReturnType<typeof resolveBusinessStyle>;
  servicesFromAllSources: string[];
  postImageType: PostImageType;
  topic: string;
  postGoal: PostGoal;
}): string {
  const businessType = englishOnlyOrEmpty(profile.businessType) || (profile.businessType ?? 'business');
  const businessName = profile.businessName?.trim() ?? '';
  const brandColors = (profile.brandColors ?? identity.colorPalette).trim();
  const website = (profile.websiteUrl ?? profile.website)?.trim();
  const targetAudience = (profile.audience ?? profile.targetAudience ?? '').trim();
  const tone = (profile.tone ?? profile.style ?? profile.websiteTone ?? identity.mood).trim();
  const description = [profile.description, profile.uniqueness, profile.websiteSummary]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 520);
  const websiteKeywords = (profile.websiteKeywords ?? []).slice(0, 8).join(', ');
  const services = dedupe([
    profile.services ?? '',
    profile.products ?? '',
    ...(profile.websiteServices ?? []),
    ...servicesFromAllSources,
  ])
    .filter(Boolean)
    .slice(0, 8)
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

  const approvedTextBlock = approvedTextElements.length
    ? approvedTextElements
        .map((element, index) =>
          `${index + 1}. ${element.role} (${element.importance}): "${element.text}"`,
        )
        .join('\n')
    : 'No on-image text. Clean commercial photography only.';

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
      ? 'Text language: Hebrew (RTL). Use the approved Hebrew copy plan as the main poster text, arranged as multiple natural designed text areas when appropriate. ' +
        'CRITICAL HEBREW TEXT RULES: ' +
        '(a) Every character must be a genuine Hebrew letter — ZERO Latin/English characters allowed inside Hebrew words. ' +
        'Do NOT substitute any Hebrew letter with a visually similar Latin character (e.g., never use "Y", "X", "O", "I", "1", "l" for any Hebrew letter). ' +
        '(b) Word order: right-to-left. First letter on the right, last letter on the left. ' +
        '(c) If a word has only 2–4 letters, keep it on one line — never break it. ' +
        '(d) If you cannot render a Hebrew glyph accurately, use a simpler font with larger letterforms and more spacing rather than substituting characters. ' +
        '(e) No decorative swashes, diacritics, or punctuation unless it was in the approved text.'
      : 'Text language: English. Use the approved English copy plan as the main poster text.';

  return (
    `Create ONE complete professional SQUARE 1:1 social media advertisement poster for a ${businessType} business.\n` +
    'The image must be designed for Instagram feed and Facebook feed: 1080x1080-style square composition, centered safe-area layout, and all important logo/text/CTA elements well inside the margins.\n' +
    'Output should feel like premium ChatGPT image generation: a finished Israeli Instagram/Facebook sponsored ad, high-end creative agency finish, not a rough concept.\n' +
    'This must be a COMPLETE designed marketing poster, not just a nice photo with one headline. Combine cinematic commercial photography, branded graphic design, Hebrew typography, offer/badge treatment, CTA button, and polished social ad layout.\n' +
    'The final image should feel like a real designer built a complete campaign creative: visual hero, brand area, main message, supporting copy, offer/badge, CTA, and small footer/business line where appropriate.\n' +
    'Do NOT create a simple product photo with one text line. Do NOT create a plain photo with basic overlay text. Do NOT leave the poster feeling empty or unfinished.\n' +
    'Design quality: luxury commercial layout, strong visual hierarchy, realistic premium photography, depth, premium lighting, clean typography system, refined spacing, CTA-style design language, polished social media ad composition.\n\n' +
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
    'Format/layout: square 1:1 feed post composition. Think 1080x1080 premium social ad. Use a balanced safe-area grid with a strong hero visual, brand/logo area, main Hebrew headline block, short subtitle, offer/badge, CTA button/pill, and a small footer/business line when approved text allows it.\n' +
    'Keep every important element centered within generous safe margins. Nothing important may touch or sit close to the edges. Leave comfortable breathing room around Hebrew letters, logo, CTA, and badge.\n' +
    'Use layered graphic design: soft gradients, premium panels, subtle glow/border/shadow, depth, realistic textures, and clean separation between photography and text. The poster should look finished and intentional, not like text dropped on a photo.\n' +
    assetBlock +
    '\nTYPOGRAPHY\n' +
    `${languageInstruction}\n` +
    'APPROVED TEXT ELEMENTS — use these as the complete poster copy plan. Render them naturally as separate designed text areas; do not collapse everything into one headline:\n' +
    `${approvedTextBlock}\n\n` +
    'Use these approved text elements as a full ad system, not as one isolated headline. Create a clear hierarchy:\n' +
    '1. Brand/logo area: small and refined near the top safe area.\n' +
    '2. Main Hebrew headline: large, bold, dominant, readable at phone size.\n' +
    '3. Short subtitle/support line: smaller but still clear.\n' +
    '4. Offer/badge: circular badge, sticker, ribbon, or highlighted pill if offer/badge text exists.\n' +
    '5. CTA: real button/pill with glow/shadow/high contrast if cta text exists.\n' +
    '6. Small footer/business line: very small brand/detail line only if an approved footer/brand/business text element exists; never invent contact details.\n' +
    'You may use multiple short text zones when approved text elements exist. The poster should feel like a complete finished advertisement, not a photo with one large headline.\n' +
    'Use professional Hebrew poster typography: oversized bold headline, clear secondary line, visible body/support line, offer/badge treatment, strong CTA button/pill, strong contrast, generous safe margins, clean hierarchy, no duplicated text, no random words.\n' +
    'For Hebrew: use multiple readable zones when the copy plan contains them. Keep every text area short and spacious, but do not simplify the whole ad into one large headline. Keep RTL order natural and readable.\n' +
    'Hebrew words must not overlap the main visual subject — place text in a deliberate clear zone, premium panel, contrast band, or dark/light overlay area.\n' +
    '\nAVOID\n' +
    'cluttered layout, cheap Canva look, generic AI ad, plain stock photo, random photo with text overlay, very tall 2:3 poster composition, logo on white card, logo sticker, ' +
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
async function fetchRemoteImageAsUploadable(
  imageUrl: string | undefined | null,
  {
    label,
    filePrefix,
    maxBytes = 25 * 1024 * 1024,
  }: {
    label: string;
    filePrefix: string;
    maxBytes?: number;
  },
): Promise<RemoteImageReference | null> {
  if (!imageUrl) return null;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      devWarn(`${label} fetch returned non-2xx; skipping image reference`, {
        status: response.status,
      });
      return null;
    }
    const contentType = response.headers.get('content-type') ?? 'image/png';
    // OpenAI images.edit accepts PNG / JPG / WEBP. Anything else gets skipped.
    if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
      devWarn(`${label} content-type not supported by images.edit; skipping`, {
        contentType,
      });
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      devWarn(`${label} larger than max bytes; skipping image reference`, {
        bytes: arrayBuffer.byteLength,
        maxBytes,
      });
      return null;
    }
    const ext =
      contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
      : contentType.includes('webp') ? 'webp'
      : 'png';
    const file = await toFile(Buffer.from(arrayBuffer), `${filePrefix}.${ext}`, {
      type: contentType,
    });
    return { file, bytes: arrayBuffer.byteLength, contentType };
  } catch (error) {
    devWarn(`${label} fetch threw; skipping image reference`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function fetchLogoAsUploadable(
  logoUrl: string | undefined,
): Promise<RemoteImageReference | null> {
  return await fetchRemoteImageAsUploadable(logoUrl, {
    label: 'Logo',
    filePrefix: 'logo',
  });
}

async function generateImageWithOpenAI({
  openai,
  prompt,
  role,
  languageMode,
  logoFile,
  styleReferenceFile,
  acc,
}: {
  openai: OpenAI;
  prompt: string;
  role: 'photo' | 'complete_poster';
  languageMode: PosterLanguageMode;
  logoFile?: Uploadable | null;
  styleReferenceFile?: Uploadable | null;
  acc: CostAccumulator;
}): Promise<string | null> {
  // Dev/staging A/B switch: when OPENAI_IMAGE_MODEL is set in the Convex
  // deployment env, use that model instead of the default. Production keeps
  // running on BEST_OPENAI_IMAGE_MODEL whenever the env var is unset. An
  // invalid model name will surface as MODEL_NOT_FOUND in the existing error
  // classifier below — the action still returns a text-only post on failure.
  const configuredModel = process.env.OPENAI_IMAGE_MODEL?.trim();
  const model = configuredModel || BEST_OPENAI_IMAGE_MODEL;
  const usingModelOverride = Boolean(configuredModel) && configuredModel !== BEST_OPENAI_IMAGE_MODEL;
  const imageInputs = [logoFile, styleReferenceFile].filter(
    (file): file is Uploadable => Boolean(file),
  );
  const usesLogoReference = Boolean(logoFile);
  const usesStyleReference = Boolean(styleReferenceFile);
  const usesImageReferences = imageInputs.length > 0;
  const apiSurface = usesImageReferences ? 'images.edit' : 'images.generate';
  const imageSize = role === 'photo' ? OPENAI_PHOTO_IMAGE_SIZE : OPENAI_POSTER_IMAGE_SIZE;

    // UNCONDITIONAL ENDPOINT SENTINEL — proves which OpenAI endpoint was
    // actually invoked. images.edit is biased toward image-conditioning;
    // images.generate is pure text-to-image (preferred for clean premium_ad).
    console.info('[generatePost] 🟢 OPENAI IMAGE REQUEST START', {
      activeImageModel: model,
      defaultImageModel: BEST_OPENAI_IMAGE_MODEL,
      usingModelOverride,
      endpointInvoked: apiSurface,
      role,
      languageMode,
      size: imageSize,
      quality: 'high',
      logoFilePresent: usesLogoReference,
      styleReferenceFilePresent: usesStyleReference,
      imageInputCount: imageInputs.length,
      promptLength: prompt.length,
    });

    devInfo('🟢 OPENAI IMAGE REQUEST START', {
      model,
      defaultModel: BEST_OPENAI_IMAGE_MODEL,
      usingModelOverride,
    apiSurface,
    role,
    languageMode,
    size: imageSize,
      quality: 'high',
      usesLogoReference,
      usesStyleReference,
      imageReferenceCount: imageInputs.length,
      promptLength: prompt.length,
    });

  try {
    const imageResponse = usesImageReferences
      ? await openai.images.edit({
          model,
          image: imageInputs.length === 1 ? imageInputs[0] : imageInputs,
          prompt,
          size: imageSize,
          quality: 'high',
          n: 1,
        })
      : await openai.images.generate({
          model,
          prompt,
          size: imageSize,
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

    trackImageCost(acc, role, model, usesImageReferences ? 'edit' : 'generate');
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
    });

    // Return null so the caller can still deliver the text post
    return null;
  }
}

async function saveGeneratedPostForClientRecovery(
  ctx: ActionCtx,
  {
    captionText,
    imageBase64,
    businessName,
    businessType,
    userId,
  }: {
    captionText: string;
    imageBase64: string;
    businessName?: string;
    businessType?: string;
    userId?: string;
  },
): Promise<{ postId: Id<'posts'> | null; imageUrl: string | null }> {
  if (!imageBase64.trim()) {
    return { postId: null, imageUrl: null };
  }

  try {
    const imageBytes = Buffer.from(imageBase64, 'base64');
    const storageId = await ctx.storage.store(
      new Blob([imageBytes], { type: 'image/png' }),
    );
    const imageUrl = await ctx.storage.getUrl(storageId);
    if (!imageUrl) {
      devWarn('[generatePost] generated image stored but URL resolution failed');
      return { postId: null, imageUrl: null };
    }

    const postId = userId
      ? await ctx.runMutation(internal.posts.createPostForUser, {
          userId,
          content: captionText,
          captionText,
          imageUri: imageUrl,
          businessName,
          businessType,
          generationMode: 'auto',
        })
      : await ctx.runMutation(api.posts.createPost, {
          content: captionText,
          captionText,
          imageUri: imageUrl,
          businessName,
          businessType,
          generationMode: 'auto',
        });

    return { postId, imageUrl };
  } catch (error) {
    devWarn('[generatePost] failed to persist generated post for recovery', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { postId: null, imageUrl: null };
  }
}

export const processGenerationJob = internalAction({
  args: { jobId: v.id('generationJobs') },
  handler: async (ctx, { jobId }) => {
    const handlerStartedAt = Date.now();
    const costAcc: CostAccumulator = { textCalls: [], imageCalls: [] };

    const job = await ctx.runQuery(internal.generationJobs.getGenerationJobForProcessing, {
      jobId,
    });
    if (!job || job.status !== 'processing') return;

    await ctx.runMutation(internal.generationJobs.markGenerationJobStarted, {
      jobId,
    });

    try {
      const profile = job.businessProfileSnapshot as BusinessProfile;
      if (!profile?.businessName) {
        throw new Error('NO_BUSINESS_PROFILE');
      }

      const postImageType: PostImageType = profile.postImageType ?? 'premium_ad';
      if (postImageType !== 'premium_ad') {
        throw new Error('BACKGROUND_GENERATION_ONLY_SUPPORTS_PREMIUM_AD');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
      const openai = new OpenAI({ apiKey });

      const recentPosts = await ctx.runQuery(internal.posts.listRecentPostsForUser, {
        userId: job.userId,
        limit: 5,
      });
      const recentPostSummaries = recentPosts
        .map((post) =>
          String(post.captionText ?? post.content ?? '').replace(/\s+/g, ' ').trim(),
        )
        .filter(Boolean)
        .map((caption, index) => `${index + 1}. ${caption.slice(0, 140)}`);

      const [assetInsightClean, logoReferenceClean] = await Promise.all([
        analyzeBrandAssets(openai, profile, costAcc),
        fetchLogoAsUploadable(profile.logoUrl),
      ]);

      const cleanBrief = await generateCleanPremiumAdBrief(
        openai,
        profile,
        job.topic.trim(),
        assetInsightClean,
        recentPostSummaries,
        costAcc,
      );

      let cleanCaptionText = cleanBrief.caption;
      if (cleanBrief.hashtags.length) {
        cleanCaptionText += '\n\n' + cleanBrief.hashtags.join(' ');
      }

      const cleanImageBase64 = await generateImageWithOpenAI({
        openai,
        prompt: cleanBrief.imagePrompt,
        role: 'complete_poster',
        languageMode: 'hebrew',
        logoFile: logoReferenceClean?.file ?? null,
        styleReferenceFile: null,
        acc: costAcc,
      });

      const cleanTotalMs = Date.now() - handlerStartedAt;
      const cleanImageProduced = Boolean(cleanImageBase64 && cleanImageBase64.length > 0);
      if (!cleanImageProduced) {
        throw new Error('IMAGE_GENERATION_FAILED_USER_FRIENDLY');
      }

      const savedPost = await saveGeneratedPostForClientRecovery(ctx, {
        captionText: cleanCaptionText,
        imageBase64: cleanImageBase64 ?? '',
        businessName: profile.businessName,
        businessType: profile.businessType,
        userId: job.userId,
      });
      if (!savedPost.postId || !savedPost.imageUrl) {
        throw new Error('POST_SAVE_FAILED_AFTER_GENERATION');
      }

      const cleanCostSummary = summarizeCosts(costAcc);
      await ctx.runMutation(internal.generationCosts.saveGenerationCost, {
        userId: job.userId,
        estimatedTotalUsd: cleanCostSummary.totalUsd,
        estimatedTextUsd: cleanCostSummary.totalTextUsd,
        estimatedImageUsd: cleanCostSummary.totalImageUsd,
        textInputTokens: cleanCostSummary.totalTextInputTokens,
        textOutputTokens: cleanCostSummary.totalTextOutputTokens,
        textModels: cleanCostSummary.textModels,
        imageModels: cleanCostSummary.imageModels,
        qualityBoostEnabled: false,
        postImageType,
        totalGenerationMs: cleanTotalMs,
      });

      await ctx.runMutation(internal.users.incrementPostsGeneratedForUser, {
        userId: job.userId,
        email: job.userEmail,
      });

      await ctx.runMutation(internal.generationJobs.completeGenerationJob, {
        jobId,
        postId: savedPost.postId,
        imageUri: savedPost.imageUrl,
        captionText: cleanCaptionText,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'GENERATION_JOB_FAILED';
      await ctx.runMutation(internal.generationJobs.failGenerationJob, {
        jobId,
        errorMessage: message,
      });
    }
  },
});

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
  bodyText: string | null;
  offerText: string | null;
  ctaText: string | null;
  badgeText: string | null;
  footerText: string | null;
  visualStyle: CreativeVisualStyle;
  posterType: PosterType;
  visualDirection: string;
  languageMode: PosterLanguageMode;
  hashtags: string[];
  imageTextMode: ImageTextMode;
};

function textElementsFromMarketingBrief(
  brief: MarketingBrief,
  profile: NonNullable<BusinessProfile>,
  mode: ImageTextMode,
  maxElements = 9,
): TextElement[] {
  if (mode === 'none') return [];

  const elements: TextElement[] = [
    { role: 'headline', text: brief.headline, importance: 'primary' },
  ];

  if (mode === 'headline_and_subtitle' && brief.subtitle) {
    elements.push({
      role: 'subheadline',
      text: brief.subtitle,
      importance: 'secondary',
    });
  }

  if (brief.bodyText) {
    elements.push({
      role: 'body',
      text: brief.bodyText,
      importance: 'secondary',
    });
  }

  if (brief.offerText) {
    elements.push({
      role: 'offer',
      text: brief.offerText,
      importance: brief.posterType === 'offer' ? 'primary' : 'secondary',
    });
  }

  if (brief.badgeText) {
    elements.push({
      role: 'badge',
      text: brief.badgeText,
      importance: 'small',
    });
  }

  const ctaText =
    brief.ctaText ??
    (maxElements >= 6
      ? (brief.languageMode === 'hebrew' ? 'לפרטים' : 'Learn more')
      : null);

  if (ctaText) {
    elements.push({
      role: 'cta',
      text: ctaText,
      importance: 'small',
    });
  }

  if (brief.footerText) {
    elements.push({
      role: 'footer',
      text: brief.footerText,
      importance: 'small',
    });
  }

  const businessName = profile.businessName?.trim();
  if (businessName && businessName.length <= 28) {
    elements.push({
      role: 'brand_name',
      text: businessName,
      importance: 'small',
    });
  }

  return elements
    .filter((element) => element.text.trim().length > 0)
    .filter((element, index, arr) =>
      arr.findIndex((candidate) => candidate.text === element.text) === index,
    )
    .slice(0, maxElements);
}

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
        '• Premium poster copy should feel complete: headline, subtitle/support line, offer/badge, CTA, and footer/brand line when useful\n' +
        '• Each text area should be short and readable, but do not reduce the whole poster to only one headline\n' +
        '• NO robotic phrasing, NO literal English translations, NO generic AI slogans\n' +
        '• Brand name stays in English if it is an English name'
      : '';

  const fallback: MarketingBrief = {
    caption: `${businessName} — ${services || businessType}`.trim(),
    headline: businessName || businessType || 'הזמינו עכשיו',
    subtitle: languageMode === 'hebrew' ? 'בסטייל שמרגישים' : 'Designed to stand out',
    bodyText: languageMode === 'hebrew' ? 'חוויה שמרגישים מהרגע הראשון' : 'A polished experience from the first moment',
    offerText: postGoal === 'sale' || postGoal === 'promotion'
      ? (languageMode === 'hebrew' ? 'מבצע מיוחד' : 'Special offer')
      : null,
    ctaText: postGoal === 'booking'
      ? (languageMode === 'hebrew' ? 'קבעו תור' : 'Book now')
      : postGoal === 'sale' || postGoal === 'promotion'
        ? (languageMode === 'hebrew' ? 'לפרטים' : 'Learn more')
        : null,
    badgeText: languageMode === 'hebrew' ? 'חדש' : 'New',
    footerText: businessName || businessType || null,
    visualStyle: 'premium',
    posterType: 'brand',
    visualDirection: `A premium professional ${businessType} marketing photo. Clean composition, high-end photography, brand-focused.`,
    languageMode,
    hashtags: [],
    imageTextMode: 'headline_and_subtitle',
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
            'Generate concise, high-quality marketing copy and a visual scene for a COMPLETE designed social media advertisement poster. ' +
            'The image itself will include the poster copy, branding, CTA/badge when appropriate, and a polished agency-level layout. ' +
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
            '\n\nPoster copy planning rule:\n' +
            'For a premium social ad, do NOT return only a headline. When the business context allows it, provide a complete short copy plan with headline, subtitle, body_text, badge_text or offer_text, cta_text, and footer_text. Each field must stay short and readable.\n' +
            '\n\nReturn JSON with exactly this structure:\n' +
            '{\n' +
            `  "caption": "social media caption in ${languageMode === 'hebrew' ? 'Hebrew' : 'English'}. Write 3-5 lines of authentic marketing text. Do NOT include hashtags here.",\n` +
            `  "headline": "main poster headline in ${languageMode === 'hebrew' ? 'Hebrew' : 'English'}, 2–5 words, large and bold",\n` +
            '  "subtitle": "short supporting line, 2–6 words, or null",\n' +
            '  "body_text": "short body/support line, 3–8 words, or null only if it would make the poster worse. No paragraphs.",\n' +
            '  "offer_text": "short offer/badge copy, 1–4 words, or null. Do not invent prices, percentages, phone numbers, websites, addresses, QR codes, or exact discounts unless the user explicitly provided them.",\n' +
            '  "cta_text": "short CTA button text, 1–3 words, or null. Use only if it fits the post goal. Examples in Hebrew: קבעו תור, דברו איתנו, לגלות עוד, לפרטים, בואו לטעום.",\n' +
            '  "badge_text": "tiny badge/label text, 1–2 words, or null. Examples: חדש, מומלץ, השבוע, פרימיום. Do not use if it makes the poster crowded.",\n' +
            '  "footer_text": "short footer/business line, 1–6 words, preferably real business name/category/city; null only if no real footer is available. Do not invent phone, website, address, QR code, price, or legal text.",\n' +
            '  "visual_style": "premium|bold|minimal|elegant|dramatic|luxury|friendly|energetic",\n' +
            '  "poster_type": "brand|promotion|product_spotlight|booking|seasonal|offer|announcement",\n' +
            (topic
              ? '  "visual_direction": "English only: 2-4 sentences. The scene MUST visually depict the USER CREATIVE REQUEST above as a premium square 1:1 Instagram/Facebook ad. Include hero subject, setting, lighting, depth, layout, branded graphic composition, and where text/CTA/badge should sit inside safe margins.",\n'
              : '  "visual_direction": "English only: 2-4 sentences describing a premium square 1:1 Instagram/Facebook ad: hero subject, setting, lighting, depth, layout, branded graphic composition, and where text/CTA/badge should sit inside safe margins.",\n') +
            '  "image_text_mode": "Choose one: none | headline_only | headline_and_subtitle. ' +
            'For premium designed posts, strongly prefer headline_and_subtitle so the final image feels like a complete ad. ' +
            'Use headline_only only for very minimal luxury branding. Use none only for photo mode or if text would harm readability.",\n' +
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
    const bodyText =
      parsed.body_text &&
      String(parsed.body_text).trim() &&
      String(parsed.body_text).toLowerCase() !== 'null'
        ? cleanPosterText(parsed.body_text, 72) || null
        : fallback.bodyText;
    const offerText =
      parsed.offer_text &&
      String(parsed.offer_text).trim() &&
      String(parsed.offer_text).toLowerCase() !== 'null'
        ? cleanPosterText(parsed.offer_text, 44) || null
        : fallback.offerText;
    const ctaText =
      parsed.cta_text &&
      String(parsed.cta_text).trim() &&
      String(parsed.cta_text).toLowerCase() !== 'null'
        ? cleanPosterText(parsed.cta_text, 34) || null
        : fallback.ctaText;
    const badgeText =
      parsed.badge_text &&
      String(parsed.badge_text).trim() &&
      String(parsed.badge_text).toLowerCase() !== 'null'
        ? cleanPosterText(parsed.badge_text, 24) || null
        : fallback.badgeText;
    const footerText =
      parsed.footer_text &&
      String(parsed.footer_text).trim() &&
      String(parsed.footer_text).toLowerCase() !== 'null'
        ? cleanPosterText(parsed.footer_text, 48) || null
        : fallback.footerText;

    const rawImageTextMode = String(parsed.image_text_mode ?? '').trim().toLowerCase();
    const imageTextMode: ImageTextMode =
      rawImageTextMode === 'none' ? 'none' :
      rawImageTextMode === 'headline_and_subtitle' ? 'headline_and_subtitle' :
      'headline_and_subtitle';

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
      bodyText,
      offerText,
      ctaText,
      badgeText,
      footerText,
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

function getMaxPosterTextElements(postImageType: PostImageType): number {
  if (postImageType === 'premium_ad') return 9;
  if (postImageType === 'designed') return 5;
  return 0;
}

function preserveOriginalPosterElements(
  refinedElements: TextElement[],
  originalElements: TextElement[],
  maxElements: number,
): TextElement[] {
  if (maxElements <= 0) return [];

  const merged: TextElement[] = [];
  const addIfNew = (element: TextElement) => {
    const exists = merged.some(
      (candidate) =>
        candidate.role === element.role &&
        candidate.text.trim() === element.text.trim(),
    );
    if (!exists && element.text.trim() && merged.length < maxElements) {
      merged.push(element);
    }
  };

  refinedElements.forEach(addIfNew);
  originalElements.forEach(addIfNew);
  return merged.slice(0, maxElements);
}

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


// Step 2 of the Hebrew copy pipeline — critical editor pass.
// Runs inside Quality Boost after polishHebrewMarketingCopy (Step 1).
// Conservative temperature (0.2) so edits are surgical, not creative.
async function refineAndValidateHebrewCopy(
  openai: OpenAI,
  textElements: TextElement[],
  maxTextElements: number,
  acc: CostAccumulator,
): Promise<HebrewRefinementResult> {
  const hebrewCharPattern = /[֐-׿]/;
  const fallback: HebrewRefinementResult = {
    refinedElements: textElements.slice(0, maxTextElements),
    qualityScore: 7,
  };

  const hebrewElements = textElements.filter((el) => hebrewCharPattern.test(el.text));
  if (hebrewElements.length === 0) return fallback;

  const elementsJson = JSON.stringify(
    textElements.map((el) => ({ role: el.role, text: el.text, importance: el.importance })),
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: maxTextElements >= 9 ? 750 : 450,
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
            (maxTextElements >= 9
              ? '✗ שורות ארוכות מדי — קצר אותן, אבל אל תמחק אזורי טקסט שימושיים כמו תת-כותרת, תגית, CTA או פוטר\n'
              : '✗ שורות ארוכות מ-5 מילים — קצר אותן\n') +
            (maxTextElements >= 9
              ? 'לפוסטר פרימיום: אל תמחק אלמנטים שימושיים רק כדי לצמצם. שמור על מבנה פוסטר מלא וטבעי: כותרת, תת-כותרת, שורת תמיכה, הצעה/תגית, CTA, שם עסק ושורת פוטר — כל אחד קצר מאוד. מחק רק כפילויות, שורות ארוכות מדי או ניסוחים חלשים.\n'
              : 'למצב מעוצב קל שמור רק את האלמנטים הכי חשובים, בלי עומס.\n') +
            '\n' +
            'דוגמאות לעברית טובה בפוסטר: "מתחילים חזק", "תוצאה שרואים", "הגיע הזמן להשקיע בעצמך", "קבעו אימון ניסיון", "תזונה. כוח. תוצאות."\n' +
            'דוגמאות לעברית גרועה: "גלה את הדרך לאורח חיים בריא", "הצטרפו למהפכה שלנו", "חוו חוויה מדהימה"\n\n' +
            'שמות מותג באנגלית — השאר בדיוק כפי שהם.\n\n' +
            'החזר JSON:\n' +
            '{ "refined_elements": [{"role":"headline|subheadline|body|offer|badge|cta|footer|brand_name","text":"...","importance":"primary|secondary|small"}], ' +
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
        ? normalizeTextElements(parsed.refined_elements, textElements, maxTextElements)
        : textElements;

    const capped =
      maxTextElements >= 9
        ? preserveOriginalPosterElements(refinedElements, textElements, maxTextElements)
        : refinedElements.slice(0, maxTextElements);

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
// (Step 2). The image model should use them as the primary poster copy plan.
function buildHebrewTextOverride(approvedElements: TextElement[]): string {
  if (approvedElements.length === 0) return '';
  const lines = approvedElements
    .map((el, i) => `  ${i + 1}. ${el.role} (${el.importance}): "${el.text}"`)
    .join('\n');
  return (
    '\n\n' +
    '══════════ APPROVED HEBREW POSTER COPY PLAN ══════════\n' +
    'Professional Israeli copywriters reviewed and approved these exact words.\n' +
    'Use the following approved poster text as the complete source copy plan. Render these elements as separate designed areas when the layout calls for it — do not collapse them into one headline and do not omit most of them:\n\n' +
    lines + '\n\n' +
    'ABSOLUTE RULES for Hebrew text in this poster:\n' +
    '1. Use the approved text elements above as the primary poster copy plan — these are the final, approved marketing messages.\n' +
    '2. Do NOT invent factual details: no fake phone number, website, address, price, discount, QR code, legal text, or contact details.\n' +
    '3. If you add tiny generic design labels for visual balance, they must be very short, natural Hebrew, and secondary to the approved text.\n' +
    '4. Do NOT translate these words. English is allowed ONLY for an approved brand_name that is already written in English in the list above.\n' +
    '5. If a word looks short — that is intentional. Keep it exactly as written.\n' +
    '6. CRITICAL — PURE HEBREW WORDS: Every character in every Hebrew word must be a real Hebrew letter (Unicode block U+05D0–U+05EA). ' +
    'ZERO Latin or English letters are allowed inside or attached to Hebrew words. English letters are allowed only in an approved English brand_name element. ' +
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

// Deployment sentinel. If this exact string is NOT in your Convex logs when
// you generate a post, your Convex deployment is running an older build of
// this file. Redeploy via `npx convex deploy` (or restart `npx convex dev`).
const IMAGE_PIPELINE_VERSION = 'clean-premium-ad-rebuild-2026-06-22';

// Module-load sentinel — UNCONDITIONAL (uses console.info directly, NOT gated
// by ENABLE_DEV_GENERATION_LOGS). Fires once per Convex action cold start.
// If this line is missing from Convex logs the deployment is stale.
console.info('[generatePost] MODULE LOADED', {
  IMAGE_PIPELINE_VERSION,
  defaultImageModel: 'gpt-image-2',
  cleanPremiumAdPipelineActive: true,
  convexCloudUrl: process.env.CONVEX_CLOUD_URL ?? null,
  convexSiteUrl: process.env.CONVEX_SITE_URL ?? null,
  hasOpenAiApiKeyAtBoot: Boolean(process.env.OPENAI_API_KEY),
  // Snapshot of env overrides at boot (names + present/absent only — no values)
  envOverrides: {
    OPENAI_IMAGE_MODEL_set: Boolean(process.env.OPENAI_IMAGE_MODEL?.trim()),
    OPENAI_IMAGE_MODEL_value: process.env.OPENAI_IMAGE_MODEL?.trim() || null,
    OPENAI_POSTER_LANGUAGE_MODE_set: Boolean(process.env.OPENAI_POSTER_LANGUAGE_MODE?.trim()),
    OPENAI_POSTER_LANGUAGE_MODE_value: process.env.OPENAI_POSTER_LANGUAGE_MODE?.trim() || null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    EASY_M_RUNTIME_ENV: process.env.EASY_M_RUNTIME_ENV ?? null,
    EASY_M_DEV_GENERATION_LOGS: process.env.EASY_M_DEV_GENERATION_LOGS ?? null,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN PREMIUM_AD PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
// Fresh, minimal rewrite that REPLACES the entire premium_ad path. Replaces
// (does not chain onto) the previous multi-stage flow that combined: marketing
// brief → Hebrew polish pass → Hebrew editor pass → approved text elements list
// → buildSimpleImagePrompt → hebrewOverride block → images.edit with logo +
// style-reference PNGs. All of that machinery is bypassed here.
//
// Two API calls only:
//   1. gpt-4o-mini → returns { caption_hebrew, hashtags, image_prompt }.
//      The image_prompt is ONE focused English paragraph that already inlines
//      every Hebrew text string the poster should show. No second polish step.
//   2. openai.images.generate → renders the final poster from that prompt.
//      No logo PNG or style PNG is attached, so the model is not image-
//      conditioning-biased and follows the layout instructions directly.
// The image returned from step 2 is the final poster (compositionStrategy =
// 'complete_image'); the app does not draw any overlay on top.
// ─────────────────────────────────────────────────────────────────────────────

type CleanPremiumAdBrief = {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
};

// Picks a sensible default palette direction when the business profile
// does not provide one. Used by the fallback prompt only; the GPT-4o-mini
// brief picks its own palette based on brandColors + business type + photo
// cues from the user's uploaded images.
function defaultPaletteForBusinessType(businessType: string): string {
  const t = businessType.toLowerCase();
  if (/(מסעדה|בית קפה|אוכל|קפה|מאפיה|סושי|פיצה|restaurant|cafe|sushi|pizza|food)/.test(t)) {
    return 'warm appetizing tones: rich amber, deep terracotta, golden glow, soft cream, dark wood accents';
  }
  if (/(כושר|ספורט|אימון|fitness|gym|mma|crossfit)/.test(t)) {
    return 'bold high-contrast tones: charcoal black, concrete grey, one electric accent (orange/red/blue), hard rim light';
  }
  if (/(קוסמטיקה|יופי|איפור|טיפוח|ביוטי|beauty|cosmetics|spa|nails|salon)/.test(t)) {
    return 'luxury soft tones: blush, cream, ivory, brushed gold, marble white, soft pastels';
  }
  if (/(מספרה|תספורת|barber|hair)/.test(t)) {
    return 'editorial salon tones: warm leather brown, amber tungsten, deep navy, vintage cream';
  }
  if (/(אופנה|בגדים|בוטיק|fashion|boutique|apparel)/.test(t)) {
    return 'editorial fashion neutrals: soft tan, cream, charcoal, with one bold accent (terracotta, deep red, or olive)';
  }
  if (/(נדל|דירה|בית|real estate|property)/.test(t)) {
    return 'architectural warm tones: cream, beige, deep terracotta, warm golden-hour interior light';
  }
  if (/(עורך דין|משפט|רואה חשבון|יועץ|lawyer|attorney|consultant|advisor|professional)/.test(t)) {
    return 'corporate refined tones: deep navy, ivory, charcoal, brass and warm wood accents';
  }
  return 'modern premium neutral tones aligned with the business brand identity';
}

function buildFallbackCleanImagePrompt(profile: NonNullable<BusinessProfile>): string {
  const name = profile.businessName?.trim() || 'בית עסק';
  const type = profile.businessType?.trim() || 'עסק מקומי';
  const brandColors = profile.brandColors?.trim();
  const palette = brandColors || defaultPaletteForBusinessType(type);
  const logoLine = profile.logoUrl
    ? 'A real business logo PNG is attached as image input — integrate it naturally as the brand mark wherever the composition allows, preserving its native transparency exactly (no white card, no rounded box, no opaque background behind it); keep it small and refined; never duplicated.'
    : `Include a small on-brand brand mark "${name}" placed where the composition allows.`;
  return (
    'Premium Israeli Instagram sponsored advertisement, square 1:1, professional agency-quality design. ' +
    `Create a polished marketing poster for a ${type} business. Let the composition emerge naturally from the subject and brand — choose whatever agency-appropriate layout serves this specific business best (for example: full-bleed hero with integrated typography, editorial layered layout, magazine-cover style, product-centric with breathing space, atmospheric lifestyle scene, or a considered graphic arrangement). Do NOT default to a rigid split of photo on one side and a solid text panel on the other. ` +
    `${logoLine} ` +
    'Include a short bold Hebrew headline of 2–5 words that fits this business. A short subheadline, tagline, offer badge or CTA are all optional — add them only when they genuinely strengthen the design; do not stuff every element into every poster. ' +
    `Palette MUST be: ${palette}. Use it cohesively across background, typography and any accents. ` +
    'Real Hebrew letters, strict right-to-left order. ' +
    'No duplicated text, no fake prices, no fake phone numbers, no QR codes. ' +
    'Square 1:1, premium agency quality, photorealistic hero, polished typography, brand-driven palette.'
  );
}

async function generateCleanPremiumAdBrief(
  openai: OpenAI,
  profile: NonNullable<BusinessProfile>,
  topic: string,
  assetInsight: BrandAssetInsight | null,
  recentPostSummaries: string[],
  acc: CostAccumulator,
): Promise<CleanPremiumAdBrief> {
  const businessName = profile.businessName?.trim() ?? '';
  const businessType = profile.businessType ?? '';
  const services = dedupe([
    profile.services ?? '',
    ...(profile.websiteServices ?? []),
    ...(assetInsight?.productHints ?? []),
  ])
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');
  const audience = (profile.audience ?? profile.targetAudience ?? '').trim();
  const tone = (profile.tone ?? profile.style ?? profile.websiteTone ?? '').trim();
  const brandColors = (profile.brandColors ?? '').trim();
  const description = [profile.description, profile.websiteSummary]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 260);
  const assetCues = assetInsight
    ? [
        assetInsight.visualStyleSummary,
        assetInsight.productHints.length
          ? `seen in photos: ${assetInsight.productHints.join(', ')}`
          : '',
        assetInsight.atmosphereHints?.length
          ? `atmosphere: ${assetInsight.atmosphereHints.join(', ')}`
          : '',
        assetInsight.lightingHints?.length
          ? `lighting: ${assetInsight.lightingHints.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('. ')
        .slice(0, 280)
    : '';
  const recentLine = recentPostSummaries.length
    ? recentPostSummaries.slice(0, 3).join(' | ')
    : '';

  const fallback: CleanPremiumAdBrief = {
    caption: `${businessName} — ${services || businessType}`.trim(),
    hashtags: [],
    imagePrompt: buildFallbackCleanImagePrompt(profile),
  };

  const hasLogo = Boolean(profile.logoUrl);
  const defaultPaletteHint = defaultPaletteForBusinessType(businessType);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 950,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior Israeli creative director composing ONE focused image-generation prompt for a complete designed social media advertisement. The prompt is sent to OpenAI\'s image model and must produce a finished agency-grade poster. The design MUST feel authentic to THIS specific business: its real brand colors, its category, its tone, the look of its uploaded photos. Let the composition be chosen by the design brief — do NOT default to a rigid template such as photo-on-one-side + text-panel-on-the-other, and do NOT default to a generic dark/purple palette. Return JSON only.',
        },
        {
          role: 'user',
          content:
            'BUSINESS\n' +
            `Name: ${businessName || 'unnamed business'}\n` +
            `Type: ${businessType || 'local business'}\n` +
            (description ? `About: ${description}\n` : '') +
            (services ? `Services/products: ${services}\n` : '') +
            (audience ? `Audience: ${audience}\n` : '') +
            (tone ? `Mood/tone: ${tone}\n` : '') +
            (brandColors
              ? `Brand colors (USE THESE — they define the poster palette): ${brandColors}\n`
              : `Brand colors: not provided — derive a palette that genuinely fits this business type (suggested direction: ${defaultPaletteHint})\n`) +
            (profile.city ? `City: ${profile.city}\n` : '') +
            `Topic for this post: ${topic.trim() || 'choose the strongest angle for this business'}\n` +
            (assetCues ? `Cues from uploaded business photos (use these for atmosphere, colors, materials): ${assetCues}\n` : '') +
            `Logo: ${hasLogo
              ? 'YES — the real business logo PNG is attached as an image input to the image model. Tell the image model to integrate the attached logo PNG as the brand mark at the top of the text panel, preserving its native transparency exactly (no white card, no rounded box, no opaque background behind it), small and refined, never duplicated.'
              : 'NO logo uploaded — the brand mark must be the business NAME rendered as small uppercase on-brand typography at the top of the panel.'}\n` +
            (recentLine ? `Avoid repeating recent posts: ${recentLine}\n` : '') +
            '\n' +
            'RETURN JSON ONLY with this exact shape:\n' +
            '{\n' +
            '  "caption_hebrew": "2-5 short lines of authentic Israeli Hebrew Instagram/Facebook caption. No hashtags inside this field.",\n' +
            '  "hashtags": ["5-10 specific hashtags starting with #, mix Hebrew and English, no generic tags like #business"],\n' +
            '  "image_prompt": "ONE English paragraph (900-1500 chars) describing a complete premium Israeli Instagram sponsored ad, square 1:1, with multiple text zones inside the image."\n' +
            '}\n' +
            '\n' +
            'IMAGE_PROMPT REQUIREMENTS — your image_prompt MUST include ALL of the following:\n' +
            '1. Composition is up to the image model — pick whatever agency-appropriate layout genuinely serves this business and topic (examples of directions you can suggest include: full-bleed hero with integrated typography, editorial layered layout, magazine-cover style, product-centric with breathing space, atmospheric lifestyle scene, considered graphic arrangement). Do NOT lock the model into a fixed structure such as photo-on-one-side + text-panel-on-the-other, and do not prescribe rigid percentages, zones or grids. Vary compositions across different businesses and topics.\n' +
            '2. A vivid description of the hero content specific to this business type — what is actually being sold or experienced. Real materials, textures, lighting, atmosphere.\n' +
            '3. Hebrew text: include a bold short HEADLINE (2-5 Hebrew words). A short subheadline, tagline, offer badge or CTA are OPTIONAL — include them only when they genuinely strengthen the design. Do not stuff every element into every poster. Write the EXACT Hebrew words inside double quotes — not placeholders.\n' +
            (hasLogo
              ? '   a. The attached business LOGO PNG must be integrated naturally as the brand mark wherever the composition allows — preserve its transparency exactly; no white card, no opaque box behind it; small and refined; never duplicated.\n'
              : `   a. Include a small on-brand brand mark reading "${businessName}" placed where the composition allows.\n`) +
            `4. COLOR PALETTE — derive directly from "Brand colors" above. If the user provided brand colors, USE THEM literally as the poster palette. If not provided, use a palette that fits the business type (suggested direction: ${defaultPaletteHint}). Do NOT default to deep black + purple unless the brand actually calls for it. The whole ad must visually feel like this specific brand.\n` +
            '5. Hebrew text rules: real Hebrew letters (Unicode U+05D0–U+05EA), strict right-to-left order, no broken letters, no Latin substitutions inside Hebrew words.\n' +
            '6. Forbid clause: duplicated text, ghost text, fake prices, fake percentages, fake phone numbers, fake URLs, fake addresses, QR codes.\n' +
            (hasLogo
              ? '7. Explicitly instruct the image model: "A real business logo PNG is attached as image input — integrate the actual attached logo as the brand mark; preserve its native transparency; never wrap it in a white card or opaque box; never invent a second fake logo."\n'
              : '') +
            `${hasLogo ? '8' : '7'}. End the paragraph with the literal sentence: "Square 1:1, premium agency quality, photorealistic hero, polished typography, brand-driven palette."\n` +
            '\n' +
            'NEVER invent fake prices, percentages, phone numbers, URLs, addresses, or contact details. Choose short natural Israeli Hebrew copy that fits this business. The caption_hebrew should match the same campaign idea as the poster.',
        },
      ],
    });

    trackTextCost(acc, 'clean_premium_brief', 'gpt-4o-mini', response.usage);

    const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      devWarn('[CleanBrief] non-JSON response, using fallback');
      return fallback;
    }

    const caption = cleanCaptionText(parsed.caption_hebrew, 950) || fallback.caption;
    const hashtagsRaw = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    const hashtags = hashtagsRaw
      .map((h: unknown) => String(h ?? '').trim())
      .filter((h: string) => h.startsWith('#') && h.length > 1)
      .slice(0, 12);
    const imagePrompt =
      String(parsed.image_prompt ?? '').trim().slice(0, 2400) || fallback.imagePrompt;

    devInfo('[CleanBrief] generated', {
      captionLength: caption.length,
      hashtagCount: hashtags.length,
      imagePromptLength: imagePrompt.length,
    });

    return { caption, hashtags, imagePrompt };
  } catch (error) {
    devError('🔴 [CleanBrief] gpt-4o-mini call FAILED — using fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

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
    savedPostId: string | null;
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

    // Industry detection — used by the legacy designed/photo `buildSimpleImagePrompt`
    // to pick industry-specific lens/composition. Falls back to website-scan
    // corpus if businessType is unset.
    const styleByType = resolveBusinessStyle(profile);
    const cleanTopic      = topic.trim();
    const hasUserTopic    = cleanTopic.length > 0;

    devInfo('📝 [generateMarketingPost] user input summary', {
      hasUserTopic,
      topicLength: cleanTopic.length,
    });

    const rawPostImageType = profile.postImageType;
    const postImageType: PostImageType = rawPostImageType ?? 'premium_ad';

    // UNCONDITIONAL ROUTING SENTINEL — proves which path is running, what
    // postImageType is active, and whether any env override is in effect.
    // Always uses console.info so it survives without dev-log env vars.
    const _authIdentityVerify = await ctx.auth.getUserIdentity();
    console.info('[generatePost] 🛣 ROUTING DECISION', {
      IMAGE_PIPELINE_VERSION,
      rawProfilePostImageType: rawPostImageType ?? null,
      effectivePostImageType: postImageType,
      willUseCleanPremiumAdPipeline: postImageType === 'premium_ad',
      hasBusinessProfile: Boolean(profile),
      businessNamePresent: Boolean(profile?.businessName),
      businessType: profile?.businessType ?? null,
      hasLogoUrl: Boolean(profile?.logoUrl),
      userIdSubjectPrefix: (_authIdentityVerify?.subject ?? '').slice(0, 8) || null,
      topicLength: cleanTopic.length,
      activeEnvOverrides: {
        OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL?.trim() || null,
        OPENAI_POSTER_LANGUAGE_MODE: process.env.OPENAI_POSTER_LANGUAGE_MODE?.trim() || null,
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CLEAN PREMIUM_AD PIPELINE — early return.
    // Bypasses the legacy machinery (marketing brief → Hebrew polish → Hebrew
    // editor → approved-text-elements list → buildSimpleImagePrompt → hebrew
    // override block → images.edit with logo + style PNGs). Two API calls only:
    // one gpt-4o-mini for the brief, one openai.images.generate for the poster.
    // ─────────────────────────────────────────────────────────────────────────
    if (postImageType === 'premium_ad') {
      console.info('[generatePost] 🧼 ENTERING CLEAN premium_ad PIPELINE', {
        IMAGE_PIPELINE_VERSION,
      });
      devInfo('🧼 [generateMarketingPost] CLEAN premium_ad pipeline');

      // Fetch the real business logo PNG in parallel with asset analysis + brief
      // generation. When present, it is attached to the image API call so the
      // model integrates the ACTUAL logo as the brand mark (instead of inventing
      // one or omitting it entirely). When absent, the brief tells the model to
      // render the business name as compact on-brand typography instead.
      const tAssetsClean = Date.now();
      const [assetInsightClean, logoReferenceClean] = await Promise.all([
        analyzeBrandAssets(openai, profile, costAcc),
        fetchLogoAsUploadable(profile.logoUrl),
      ]);
      devInfo('⏱ [timing] brand asset analysis + logo fetch', {
        ms: Date.now() - tAssetsClean,
        logoUrlPresent: Boolean(profile.logoUrl),
        logoFetched: Boolean(logoReferenceClean),
      });

      const tBriefClean = Date.now();
      const cleanBrief = await generateCleanPremiumAdBrief(
        openai,
        profile,
        cleanTopic,
        assetInsightClean,
        recentPostSummaries,
        costAcc,
      );
      devInfo('⏱ [timing] clean brief', { ms: Date.now() - tBriefClean });

      let cleanCaptionText = cleanBrief.caption;
      if (cleanBrief.hashtags.length) {
        cleanCaptionText += '\n\n' + cleanBrief.hashtags.join(' ');
      }

      // UNCONDITIONAL PRE-IMAGE-CALL SENTINEL — confirms which model & endpoint
      // will actually be hit, whether the logo PNG is attached, and what prompt
      // was built. First 300 chars of the prompt only; no secrets.
      const _configuredModelClean = process.env.OPENAI_IMAGE_MODEL?.trim();
      const _activeModelClean = _configuredModelClean || BEST_OPENAI_IMAGE_MODEL;
      const _logoFileForCall = logoReferenceClean?.file ?? null;
      const _willAttachLogo = Boolean(_logoFileForCall);
      console.info('[generatePost] 🖼 PRE-IMAGE-CALL (clean premium_ad)', {
        IMAGE_PIPELINE_VERSION,
        activeImageModel: _activeModelClean,
        defaultImageModel: BEST_OPENAI_IMAGE_MODEL,
        usingModelOverride:
          Boolean(_configuredModelClean) && _configuredModelClean !== BEST_OPENAI_IMAGE_MODEL,
        endpointWillBe: _willAttachLogo ? 'images.edit' : 'images.generate',
        logoUrlPresent: Boolean(profile.logoUrl),
        logoPngAttached: _willAttachLogo,
        brandColorsProvided: Boolean(profile.brandColors?.trim()),
        brandColors: profile.brandColors?.trim() || null,
        styleReferenceFileIsNull: true,
        imagePromptLength: cleanBrief.imagePrompt.length,
        imagePromptPreviewFirst300: cleanBrief.imagePrompt.slice(0, 300),
        captionLength: cleanCaptionText.length,
        hashtagCount: cleanBrief.hashtags.length,
      });

      devInfo('🖼 [CLEAN premium_ad] image request', {
        promptLength: cleanBrief.imagePrompt.length,
        defaultModel: BEST_OPENAI_IMAGE_MODEL,
        configuredModel: process.env.OPENAI_IMAGE_MODEL?.trim() || null,
      });

      const tImageClean = Date.now();
      const cleanImageBase64 = await generateImageWithOpenAI({
        openai,
        prompt: cleanBrief.imagePrompt,
        role: 'complete_poster',
        languageMode: 'hebrew',
        logoFile: _logoFileForCall,
        styleReferenceFile: null,
        acc: costAcc,
      });
      devInfo('⏱ [timing] image generation', { ms: Date.now() - tImageClean });

      const cleanTotalMs = Date.now() - handlerStartedAt;

      // Cost summary + persist + counter increment (same shape as legacy path)
      const cleanCostSummary = summarizeCosts(costAcc);
      devInfo('💰 [CLEAN premium_ad] cost breakdown', {
        textModels: cleanCostSummary.textModels,
        imageModels: cleanCostSummary.imageModels,
        textInputTokens: cleanCostSummary.totalTextInputTokens,
        textOutputTokens: cleanCostSummary.totalTextOutputTokens,
        estimatedTextUsd: cleanCostSummary.totalTextUsd.toFixed(6),
        estimatedImageUsd: cleanCostSummary.totalImageUsd.toFixed(6),
        estimatedTotalUsd: cleanCostSummary.totalUsd.toFixed(6),
        totalGenerationMs: cleanTotalMs,
      });

      const cleanAuthIdentity = await ctx.auth.getUserIdentity();
      const cleanCostUserId = cleanAuthIdentity?.subject ?? 'unknown';
      await ctx.runMutation(internal.generationCosts.saveGenerationCost, {
        userId: cleanCostUserId,
        estimatedTotalUsd: cleanCostSummary.totalUsd,
        estimatedTextUsd: cleanCostSummary.totalTextUsd,
        estimatedImageUsd: cleanCostSummary.totalImageUsd,
        textInputTokens: cleanCostSummary.totalTextInputTokens,
        textOutputTokens: cleanCostSummary.totalTextOutputTokens,
        textModels: cleanCostSummary.textModels,
        imageModels: cleanCostSummary.imageModels,
        qualityBoostEnabled: false,
        postImageType,
        totalGenerationMs: cleanTotalMs,
      });
      // Quota is consumed ONLY when a real image was produced. If the image
      // call returned null/empty (OpenAI outage, content policy, etc.) we
      // still surface the caption in the return shape but the user keeps
      // their free post / weekly slot so they can retry.
      const cleanImageProduced = Boolean(cleanImageBase64 && cleanImageBase64.length > 0);
      const cleanSavedPost = cleanImageProduced
        ? await saveGeneratedPostForClientRecovery(ctx, {
            captionText: cleanCaptionText,
            imageBase64: cleanImageBase64 ?? '',
            businessName: profile.businessName,
            businessType: profile.businessType,
          })
        : { postId: null, imageUrl: null };
      if (cleanImageProduced) {
        await ctx.runMutation(api.users.incrementPostsGenerated);
      } else {
        devWarn('⚠️ [CLEAN premium_ad] image missing — NOT incrementing quota', {
          IMAGE_PIPELINE_VERSION,
          postImageType,
          totalGenerationMs: cleanTotalMs,
        });
      }

      devInfo('✅ [CLEAN premium_ad] SUCCESS', {
        hasImage: Boolean(cleanImageBase64),
        captionLength: cleanCaptionText.length,
        totalGenerationMs: cleanTotalMs,
      });

      // UNCONDITIONAL RETURN-SHAPE SENTINEL — confirms what the client receives.
      console.info('[generatePost] ✅ CLEAN premium_ad RETURNING', {
        IMAGE_PIPELINE_VERSION,
        postImageType,
        compositionStrategy: 'complete_image',
        hasImage: Boolean(cleanImageBase64),
        imageBase64Length: cleanImageBase64 ? cleanImageBase64.length : 0,
        captionLength: cleanCaptionText.length,
        totalGenerationMs: cleanTotalMs,
        posterTextIsNull: true,
        savedPostId: cleanSavedPost.postId,
      });

      return {
        captionText: cleanCaptionText,
        imageBase64: cleanImageBase64 ?? '',
        postImageType,
        posterText: null,
        posterTemplate: null,
        posterLayout: null,
        creativeTemplate: null,
        visualStyle: null,
        imageProvider: 'openai' as const,
        generatedImageUrl: cleanSavedPost.imageUrl,
        savedPostId: cleanSavedPost.postId,
        compositionStrategy: 'complete_image' as const,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEGACY PATH — designed / photo only. Kept verbatim for backward
    // compatibility with saved posts and the small set of users on
    // non-default postImageType. Not exercised by premium_ad anymore.
    // ─────────────────────────────────────────────────────────────────────────
    // Start logo fetch in background — will be awaited later, parallel with text generation
    const logoPromise = fetchLogoAsUploadable(profile.logoUrl);

    const uploadedBusinessImageUrls = collectUploadedBusinessImageUrls(profile);
    const brandAssetUrls = collectBrandAssetUrls(profile);
    const tAssets = Date.now();
    const assetInsight    = await analyzeBrandAssets(openai, profile, costAcc);
    devInfo('⏱ [timing] brand asset analysis', { ms: Date.now() - tAssets });
    const posterLanguageMode = resolvePosterLanguageMode();
    // ── PROFILE / ROUTING DIAGNOSTIC ─────────────────────────────────────────
    // Convex actions read environment variables from the Convex deployment env.
    // Local .env files do NOT propagate to the Convex cloud — they only feed
    // Expo at build time.
    const _configuredImageModelDiag = process.env.OPENAI_IMAGE_MODEL?.trim();
    devInfo('🔎 [generateMarketingPost] routing decision', {
      IMAGE_PIPELINE_VERSION,
      rawProfilePostImageType: rawPostImageType ?? null,
      effectivePostImageType: postImageType,
      willUseProvider: 'openai',
      posterLanguageMode,
      defaultImageModel: BEST_OPENAI_IMAGE_MODEL,
      configuredImageModel: _configuredImageModelDiag || null,
      activeImageModel: _configuredImageModelDiag || BEST_OPENAI_IMAGE_MODEL,
      imageModelPolicy: _configuredImageModelDiag
        ? 'use_OPENAI_IMAGE_MODEL_override'
        : 'use_default_image_model',
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

    // Legacy designed/photo only — premium_ad short-circuits earlier.
    const effectiveImageTextMode: ImageTextMode =
      postImageType === 'photo'
        ? 'none'
        : brief.imageTextMode === 'none'
          ? 'headline_and_subtitle'
          : brief.imageTextMode;
    const maxPosterTextElements = getMaxPosterTextElements(postImageType);
    const approvedPosterTextElements = textElementsFromMarketingBrief(
      brief,
      profile,
      effectiveImageTextMode,
      maxPosterTextElements,
    );

    // Build posterText with ALL approved copy slots from the marketing brief.
    // Returned to the client as preview/metadata. Photo mode is null.
    const posterText: PosterText | null =
      effectiveImageTextMode === 'none'
        ? null
        : {
            headline: brief.headline,
            ...(brief.subtitle ? { subtitle: brief.subtitle } : {}),
            ...(brief.bodyText ? { body: brief.bodyText } : {}),
            ...(brief.ctaText ? { cta: brief.ctaText } : {}),
            ...(brief.offerText ? { offer: brief.offerText } : {}),
            ...(brief.badgeText ? { badge: brief.badgeText } : {}),
            ...(brief.footerText ? { footer: brief.footerText } : {}),
          };

    // ── 2. Hebrew editor pass + logo fetch in parallel ───────────────────────
    // OpenAI Image renders the full poster including the Hebrew text. The
    // editor pass polishes the approved copy and the override block locks
    // the exact Hebrew strings the model should render. Runs for both
    // premium_ad and designed (anything that puts Hebrew INTO the image).
    let hebrewOverride = '';
    if (brief.languageMode === 'hebrew' && postImageType !== 'photo') {
      const hebrewElements: TextElement[] = approvedPosterTextElements;
      devInfo('[HebrewCopy] editor reviewing copy…', {
        elementCount: hebrewElements.length,
        maxPosterTextElements,
      });
      const tHebrew = Date.now();
      const [refinement] = await Promise.all([
        refineAndValidateHebrewCopy(
          openai,
          hebrewElements,
          maxPosterTextElements,
          costAcc,
        ),
        logoPromise,
      ]);
      devInfo('⏱ [timing] hebrew edit + logo fetch (parallel)', { ms: Date.now() - tHebrew });
      hebrewOverride = buildHebrewTextOverride(refinement.refinedElements);
      devInfo('[HebrewCopy] ✅ copy locked', {
        qualityScore: refinement.qualityScore,
        finalElementCount: refinement.refinedElements.length,
        postImageType,
      });
    }

    // ── 3. Build image prompt + generate ────────────────────────────────────
    const logoReference = await logoPromise;
    devInfo('🔖 Image references (legacy designed/photo)', {
      present: Boolean(profile.logoUrl),
      logoFetched: Boolean(logoReference),
    });

    const imagePrompt = buildSimpleImagePrompt({
      profile,
      brief,
      approvedTextElements: approvedPosterTextElements,
      assetInsight,
      identity,
      focus,
      shot,
      styleByType,
      servicesFromAllSources,
      postImageType,
      topic: cleanTopic,
      postGoal,
    });

    const configuredImageModel = process.env.OPENAI_IMAGE_MODEL?.trim();
    const activeImageModel = configuredImageModel || BEST_OPENAI_IMAGE_MODEL;
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
      defaultImageModel: BEST_OPENAI_IMAGE_MODEL,
      usingModelOverride:
        Boolean(configuredImageModel) && configuredImageModel !== BEST_OPENAI_IMAGE_MODEL,
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
      styleReferenceFile: null,
      acc: costAcc,
    });
    devInfo('⏱ [timing] image generation finished', { ms: Date.now() - tImage });

    // premium_ad and designed return a FULLY designed ad poster from OpenAI
    // Image (the model renders text, badge, CTA, footer as part of the image).
    // photo mode returns a clean photograph with no overlay text — the app
    // adds only a small logo watermark for it.
    const compositionStrategy: CompositionStrategy =
      postImageType === 'photo' ? 'background_with_overlay' : 'complete_image';

    const totalGenerationMs = Date.now() - handlerStartedAt;

    if (imageBase64OrNull === null) {
      // Image generation failed — still deliver the caption so the user
      // sees their text rather than a hard error screen, but DO NOT consume
      // quota: a missing image is not a successful post, so the user keeps
      // their free post / weekly slot and can retry without losing it.
      devWarn('⚠️ [generateMarketingPost] image failed — returning text-only post, NOT incrementing quota', {
        IMAGE_PIPELINE_VERSION,
        postImageType,
        postGoal,
        totalGenerationMs,
      });
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
        savedPostId: null,
        compositionStrategy,
      };
    }

    const imageBase64 = imageBase64OrNull;
    const savedPost = await saveGeneratedPostForClientRecovery(ctx, {
      captionText,
      imageBase64,
      businessName: profile.businessName,
      businessType: profile.businessType,
    });
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
      savedPostId: savedPost.postId,
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
      generatedImageUrl: savedPost.imageUrl,
      savedPostId: savedPost.postId,
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
