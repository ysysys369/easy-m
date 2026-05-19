"use node";
import { v } from 'convex/values';
import OpenAI from 'openai';
import { action } from './_generated/server';
import { api } from './_generated/api';

type BusinessProfile = {
  businessName?: string;
  businessType?: string;
  description?: string;
  audience?: string;
  style?: string;
  city?: string;
  website?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  goal?: string;
  services?: string;
  uniqueness?: string;
  logoUrl?: string;
  images?: string[];
} | null;

function buildBusinessContext(p: BusinessProfile): string {
  if (!p) return '';
  const lines: string[] = [];
  if (p.businessName)    lines.push(`שם העסק: ${p.businessName}`);
  if (p.businessType)    lines.push(`סוג העסק: ${p.businessType}`);
  if (p.description)     lines.push(`תיאור: ${p.description}`);
  if (p.audience)        lines.push(`קהל יעד: ${p.audience}`);
  if (p.style)           lines.push(`סגנון מועדף: ${p.style}`);
  if (p.city)            lines.push(`אזור: ${p.city}`);
  if (p.services)        lines.push(`שירותים/מוצרים: ${p.services}`);
  if (p.uniqueness)      lines.push(`מה מיוחד: ${p.uniqueness}`);
  if (p.goal)            lines.push(`מטרת הפוסט: ${p.goal}`);
  if (p.website)         lines.push(`אתר: ${p.website}`);
  if (p.socialInstagram) lines.push(`אינסטגרם: ${p.socialInstagram}`);
  if (p.socialFacebook)  lines.push(`פייסבוק: ${p.socialFacebook}`);
  return lines.join('\n');
}

function buildEnglishVisualContext(p: BusinessProfile): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.businessName) parts.push(`Business name: "${p.businessName}" — this is a personalized ad for THIS specific business`);
  if (p.businessType) parts.push(`Business type: ${p.businessType}`);
  if (p.services)     parts.push(`Services/products offered (MUST be visible in the scene): ${p.services}`);
  if (p.uniqueness)   parts.push(`What makes this business unique (highlight visually): ${p.uniqueness}`);
  if (p.audience)     parts.push(`Target audience (the people in the scene should look like them): ${p.audience}`);
  if (p.style)        parts.push(`Brand tone (drives the entire mood): ${p.style}`);
  if (p.city)         parts.push(`Location: ${p.city}, Israel — incorporate authentic local environment`);
  if (p.description)  parts.push(`Business description: ${p.description}`);
  return parts.join('\n• ');
}

// ─── Visual style per business type ─────────────────────────────────────────
// Maps Hebrew business-type labels to industry-specific photography direction.
// Matching is substring-based to tolerate emojis and minor wording variants.
type BusinessStyle = { category: string; direction: string };

const BUSINESS_STYLE_MAP: { match: string[]; style: BusinessStyle }[] = [
  {
    match: ['מסעדה', 'בית קפה', 'אוכל', 'קפה', 'מאפיה', 'restaurant', 'cafe'],
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
  if (p.services)     bits.push(`offering: ${p.services}`);
  if (p.audience)     bits.push(`for ${p.audience}`);
  if (p.style)        bits.push(`${p.style} tone`);
  if (p.city)         bits.push(`in ${p.city}`);
  const summary = bits.join(', ');
  return p.businessName
    ? `This is a tailored marketing photo for "${p.businessName}" — a ${summary}.`
    : `This is a tailored marketing photo for a ${summary}.`;
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

// ─── Composition rotation: vary every generation ──────────────────────────
const SHOT_TYPES = [
  {
    name: 'close-up-product',
    direction:
      'TIGHT CLOSE-UP / MACRO product shot. Subject fills 70% of the frame. ' +
      'Hyper-detailed texture and intimate focus. Buttery bokeh background. ' +
      'f/1.8 aperture, extreme shallow depth of field.',
  },
  {
    name: 'lifestyle-scene',
    direction:
      'LIFESTYLE SCENE shot showing the product/service in its real-world context. ' +
      'Layered environment with believable everyday details, candid in-use moment. ' +
      '35mm lens, f/2.8.',
  },
  {
    name: 'emotional-moment',
    direction:
      'EMOTIONAL MOMENT close-up — frame a single human face or gesture at the exact peak of feeling ' +
      '(joy, awe, relief, satisfaction, confidence). Tight framing on emotion. ' +
      '85mm lens, f/2.0, eyes tack-sharp.',
  },
  {
    name: 'action-shot',
    direction:
      'ACTION SHOT — frozen mid-motion at the decisive moment. Visible motion blur on background or trailing elements, ' +
      'razor-sharp on the action point. Dynamic angle (low or tilted). ' +
      '50mm lens, f/2.8, fast shutter feel.',
  },
  {
    name: 'wide-environmental',
    direction:
      'WIDE ENVIRONMENTAL shot. Show the full scene with rich context. ' +
      'Subject placed using rule of thirds. Atmospheric depth from foreground to background. ' +
      '35mm lens, f/4 for layered focus.',
  },
  {
    name: 'over-shoulder-pov',
    direction:
      'OVER-THE-SHOULDER POV shot creating immersion and first-person intimacy. ' +
      'Viewer feels physically present in the scene. 35mm lens, f/2.8.',
  },
  {
    name: 'flat-lay-overhead',
    direction:
      'TOP-DOWN FLAT-LAY composition shot directly from above. ' +
      'Carefully styled arrangement with intentional negative space and color harmony. ' +
      '50mm lens at 90° angle.',
  },
  {
    name: 'editorial-bold',
    direction:
      'EDITORIAL FASHION-MAGAZINE composition. Bold framing with strong negative space. ' +
      'Single hero subject, dramatic lighting contrast. 85mm lens, f/1.4.',
  },
];

function pickShotType() {
  return SHOT_TYPES[Math.floor(Math.random() * SHOT_TYPES.length)];
}

// ─── Marketing angle: WHY this image sells ────────────────────────────────
// Every ad needs a hook. Rotate between proven marketing angles so each
// generation has a clear selling intent, not just "a nice picture".
const MARKETING_ANGLES = [
  {
    name: 'happy-customer',
    direction:
      'HAPPY CUSTOMER ENJOYING — capture the peak emotional moment of a real customer ' +
      'using or experiencing the product/service. Authentic joy or satisfaction visible on their face. ' +
      'The viewer should think: "I want to feel that too."',
  },
  {
    name: 'transformation',
    direction:
      'TRANSFORMATION / RESULT — show the visible outcome or "after" state. ' +
      'The viewer immediately sees what they could achieve, look like, or become. ' +
      'Confidence and pride radiate from the subject.',
  },
  {
    name: 'luxury-experience',
    direction:
      'PREMIUM LUXURY EXPERIENCE — pure indulgence and sensory pleasure. ' +
      'The feeling of being treated, pampered, elevated. High-end environment, refined details, ' +
      'a "you deserve this" energy.',
  },
  {
    name: 'problem-solved',
    direction:
      'PROBLEM → SOLUTION MOMENT — a relatable everyday pain point being resolved by the product/service. ' +
      'Frame the relief, the "finally" expression, the visible ease.',
  },
  {
    name: 'aspirational-lifestyle',
    direction:
      'ASPIRATIONAL LIFESTYLE — the better version of the customer\'s life that this brand enables. ' +
      'Confident, fulfilled, living a life the viewer wants. Subtle, not loud.',
  },
  {
    name: 'social-proof',
    direction:
      'SOCIAL PROOF energy — a scene that implies popularity and community. ' +
      'Multiple people enjoying together, a busy venue, the "everyone is here" feeling. ' +
      'The viewer feels FOMO.',
  },
  {
    name: 'craftsmanship',
    direction:
      'CRAFTSMANSHIP & EXPERTISE — show the skill, the process, the human craft behind the offering. ' +
      'Close-up of skilled hands at work, focused expression, materials/tools visible. ' +
      'Conveys quality and trust.',
  },
  {
    name: 'hero-product',
    direction:
      'HERO PRODUCT MOMENT — the product/dish/result as the unmistakable star. ' +
      'Beautifully styled, dramatically lit, the single focus that says "want this." ' +
      'Pure desirability, frame-worthy.',
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

export const generateMarketingPost = action({
  args: { topic: v.string() },
  handler: async (ctx, { topic }) => {
    // Weekly limit gate (3 posts per rolling 7-day window)
    const weekly = await ctx.runQuery(api.users.getWeeklyPostStatus);
    if (weekly.remaining <= 0) throw new Error('WEEKLY_LIMIT_REACHED');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const openai = new OpenAI({ apiKey });

    // Pull business profile — required for personalized generation
    const profile: BusinessProfile = await ctx.runQuery(
      api.businessProfiles.getMyBusinessProfile,
    );
    if (!profile || !profile.businessName) {
      throw new Error('NO_BUSINESS_PROFILE');
    }

    const businessContext = buildBusinessContext(profile);
    const visualContext   = buildEnglishVisualContext(profile);
    const businessIdentity = buildBusinessIdentitySummary(profile);
    const styleByType     = getStyleByBusinessType(profile.businessType);
    const cleanTopic      = topic.trim();
    const hasUserTopic    = cleanTopic.length > 0;

    // ── 1. Hebrew marketing caption ─────────────────────────────────────────
    const captionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'אתה מומחה שיווק דיגיטלי ברשתות חברתיות בישראל. ' +
            'כתוב כיתוב שיווקי מושך בעברית לאינסטגרם — מותאם בדיוק לעסק הספציפי. ' +
            "כלול: פתיח מושך, ערך ברור ללקוח, אימוג'ים מתאימים, קריאה לפעולה, ו-3-5 האשטגים. " +
            'הקפד להשתמש בשם העסק, להתאים לסגנון המועדף, לפנות לקהל היעד, ' +
            'ולהדגיש את הייחודיות של העסק. אל תכתוב כיתוב גנרי. ' +
            'כתוב רק את הכיתוב הסופי — ללא הסבר וללא כותרת.',
        },
        {
          role: 'user',
          content:
            `מידע על העסק:\n${businessContext}\n\n` +
            (hasUserTopic
              ? `הנושא שהמשתמש ביקש: ${cleanTopic}\n\n` +
                'כתוב כיתוב שיווקי המבוסס על הנושא שביקש המשתמש, מותאם בדיוק לעסק.'
              : 'המשתמש לא ביקש נושא ספציפי. הצע רעיון יצירתי לפוסט שמתאים לעסק הזה ' +
                'בהתבסס על השירותים, הייחודיות, וקהל היעד. כתוב את הפוסט המלא.'),
        },
      ],
      max_tokens: 700,
    });

    const captionText =
      captionResponse.choices[0]?.message?.content?.trim() ?? cleanTopic;

    // ── 2. Detailed English scene description for image ───────────────────────
    // LOCKED per business: visual identity (palette + lighting + mood) for brand consistency
    // ROTATED per post:   composition + marketing angle for freshness
    const identity = getVisualIdentityForBusiness(profile);
    const shot     = pickShotType();
    const angle    = pickMarketingAngle();

    const sceneResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an award-winning commercial photographer and creative director at a top Tel Aviv advertising agency. ' +
            'Your job: invent a SCROLL-STOPPING Instagram ad scene that SELLS — not just a pretty picture. ' +
            'CRITICAL: this scene must be PERSONALIZED to the specific business below — never write a generic scene. ' +
            'Think: if this were a sushi restaurant, show actual sushi in a real restaurant setting; ' +
            'if this were a fitness coach, show a real workout scene with genuine energy; ' +
            'if this were a beauty clinic, show clean luxury treatment with soft lighting. ' +
            'Every scene must represent (a) a clear selling point, (b) a real emotion, and (c) a believable real-life use case. ' +
            'Be hyper-specific about: ' +
            '(1) the hero subject — must literally show the actual services/products this business offers, ' +
            '(2) a REAL environment matching the business type (restaurant kitchen, gym floor, beauty room, store, office, etc.), ' +
            '(3) people who genuinely look like the stated target audience, ' +
            '(4) color palette and atmosphere matching the brand tone, ' +
            '(5) what the viewer should FEEL after seeing this image. ' +
            'Write in English. 3-4 sentences max. Vivid, cinematic, emotionally clear. No text, no logos, no overlays.',
        },
        {
          role: 'user',
          content:
            `Business context:\n${visualContext}\n\n` +
            (styleByType
              ? `Industry visual category (${styleByType.category}):\n${styleByType.direction}\n\n`
              : '') +
            `🎨 LOCKED BRAND VISUAL IDENTITY — this business always looks like this across all posts:\n` +
            `• Color palette: ${identity.colorPalette}\n` +
            `• Lighting style: ${identity.lightingStyle}\n` +
            `• Mood: ${identity.mood}\n\n` +
            `Marketing angle for THIS post (${angle.name}):\n${angle.direction}\n\n` +
            `Composition for THIS post: ${shot.name} — ${shot.direction}\n\n` +
            (hasUserTopic
              ? `Marketing topic to feature: ${cleanTopic}\n\nWrite the scene, strictly respecting the locked brand identity above (palette, lighting, mood) while delivering this post's marketing angle and composition.`
              : 'No specific topic provided — invent the most compelling scene possible that delivers the marketing angle in the locked brand identity (palette, lighting, mood) and uses the composition above.'),
        },
      ],
      max_tokens: 320,
    });

    const sceneDescription =
      sceneResponse.choices[0]?.message?.content?.trim() ?? cleanTopic;

    // ── 3. Generate the image ────────────────────────────────────────────────
    const imagePrompt: string =
      // Lead with WHO this image is for — anchors the model to the business
      `${businessIdentity}\n\n` +
      `Scene: ${sceneDescription}\n\n` +
      // 🎨 LOCKED brand identity — same across every post for this business
      `🎨 BRAND VISUAL IDENTITY (must stay consistent across all posts for this business):\n` +
      `• Color palette: ${identity.colorPalette}\n` +
      `• Lighting style: ${identity.lightingStyle}\n` +
      `• Mood: ${identity.mood}\n\n` +
      // Per-post variation
      `Marketing angle (${angle.name}): ${angle.direction}\n` +
      (styleByType ? `Industry style (${styleByType.category}): ${styleByType.direction}\n` : '') +
      `Composition: ${shot.direction}\n\n` +
      // Personalization reminder
      (profile.services ? `Must clearly depict: ${profile.services}.\n` : '') +
      (profile.audience ? `People in the scene must look like: ${profile.audience}.\n` : '') +
      '\n' +
      // Required premium directives
      'ultra realistic, professional photography, cinematic lighting, depth of field, high detail, 4k, ' +
      'commercial advertising, Instagram ad style, ' +
      // Emotion + brand keywords
      'aspirational, premium lifestyle, authentic moment, engaging, ' +
      'emotionally resonant, scroll-stopping, real-brand campaign feel, ' +
      // Technical quality
      'shot on Sony A7R V or Hasselblad, ' +
      'photorealistic skin texture and natural micro-details (pores, hair, fabric weave), ' +
      'tack-sharp focus on the hero subject with creamy bokeh elsewhere, ' +
      'rich color grading, gentle film grain, magazine-grade post-production, ' +
      'premium agency-quality production value. ' +
      // Anti-AI-look guard
      'AVOID the typical AI-generated look: no over-saturated unrealistic colors, ' +
      'no perfectly symmetric compositions, no plastic flawless CGI skin, ' +
      'no sterile empty backgrounds, no generic person smiling directly at camera, ' +
      'no impossible perfection. Embrace asymmetry, natural imperfections, ' +
      'lived-in environments, and the slightly imperfect realness of true documentary photography. ' +
      // Hard exclusions
      'STRICTLY NO text, no words, no letters, no numbers, no signage typography, ' +
      'no watermarks, no logos, no overlays, no UI elements, no captions, ' +
      'no illustrations, no cartoons, no anime, no drawings, no 3D-render look, ' +
      'no stock-photo cliché. Pure photorealistic photograph only — like a real Instagram ad from a real brand.';

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageBase64 = imageResponse.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error('Image generation returned no data');

    // ── 4. Increment counter only after successful generation ─────────────────
    await ctx.runMutation(api.users.incrementPostsGenerated);

    return { captionText, imageBase64 };
  },
});
