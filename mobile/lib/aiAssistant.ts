export type AiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const SYSTEM_PROMPT =
  "You are Roamerz's in-app travel assistant. Keep replies short (under 80 words), " +
  "concrete, and friendly. Suggest places, captions, hashtags, or filming tips.";

const ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

/**
 * Sends the running conversation to the AI endpoint and returns the assistant's
 * reply. Configure the endpoint by setting EXPO_PUBLIC_AI_ENDPOINT in .env to a
 * URL that accepts POST { messages: [{role, content}], system: string } and
 * returns { reply: string }.
 *
 * Until that endpoint is configured, this falls back to a rule-based canned
 * responder so the UI is testable end-to-end.
 */
export async function askAssistant(messages: AiMessage[]): Promise<string> {
  if (!ENDPOINT) {
    return canned(messages[messages.length - 1]?.content ?? '');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, messages }),
  });
  if (!res.ok) {
    throw new Error(`Assistant API ${res.status}`);
  }
  const data = (await res.json()) as { reply?: string };
  return data.reply?.trim() || "I'm not sure — could you ask another way?";
}

// Pretend-AI: matches a small set of common travel questions to canned
// answers. Pure pattern matching — no model, no network — just enough to
// feel useful in the demo.
type Rule = {
  match: (text: string) => boolean;
  answers: string[];
};

const RULES: Rule[] = [
  {
    // 1. caption ideas
    match: (t) => /(caption|description|describe|what.*write|words.*video)/.test(t),
    answers: [
      'Anchor the caption in one sense detail + the place. e.g. "Wind, salt, and the loudest gulls — Lisbon."',
      'Open with what surprised you, end with the location. Short beats long: under 10 words.',
      'Pair an emotion with a place name: "A quiet kind of joy. — Hallstatt."',
    ],
  },
  {
    // 2. hashtags
    match: (t) => /(hashtag|#tag|tags? (for|to)|trending tag)/.test(t),
    answers: [
      'Three works best: one broad (#travel), one place (#tokyo), one specific (#shibuyacrossing).',
      'Skip generic spam tags. Use 3 targeted tags > 30 random ones.',
      'Try #hiddengem, #slowtravel, plus the city name and one local landmark.',
    ],
  },
  {
    // 3. where to go / trip ideas
    match: (t) => /(where (to )?go|trip idea|destination|next trip|recommend.*place|vacation idea)/.test(t),
    answers: [
      'For a 3-day window: one city + one nature day-trip. Tell me your continent and budget and I can be specific.',
      'If you want underrated: Albania (May), Georgia the country (Sept), or Taiwan (March).',
      'For winter sun and short flights from Europe: Madeira, Lanzarote, or Marrakech.',
    ],
  },
  {
    // 4. sunset / golden hour
    match: (t) => /(sunset|golden hour|sunrise|magic hour)/.test(t),
    answers: [
      'Shoot 30 min before sunset and 15 after — the colour shift carries the clip.',
      'Face slightly off the sun (45°), expose for the sky, let foreground silhouette.',
      'Best sunsets in cities: Lisbon (Miradouro de Santa Catarina), Istanbul (Galata bridge), Bali (Tanah Lot).',
    ],
  },
  {
    // 5. beaches
    match: (t) => /(beach|coast|sea|island|surf)/.test(t),
    answers: [
      'Underrated beaches: Praia da Marinha (Portugal), Rabbit Beach (Lampedusa), Cala Goloritzé (Sardinia).',
      'Shoot beaches at low tide — more texture, fewer people in frame.',
      'For surf clips: a phone in a Glide grip + a polariser cuts glare and saturates blues.',
    ],
  },
  {
    // 6. food / restaurant
    match: (t) => /(food|restaurant|eat|meal|coffee|breakfast|dinner|cafe)/.test(t),
    answers: [
      'Film food top-down for hero shots, 45° for atmosphere. Keep clips ≤3s — viewers scroll fast.',
      'Order what locals eat at lunch. Ask one question: "what do you have today?"',
      'Best food cities for content: Mexico City, Bangkok, Naples, Lyon, Tokyo.',
    ],
  },
  {
    // 7. drone / aerial
    match: (t) => /(drone|aerial|fly.*camera|fpv)/.test(t),
    answers: [
      'Always check local rules. Most EU countries: ≤120m altitude, line-of-sight, register the drone.',
      'Forbidden in many old-town centres + national parks. Spain, Greece, France are strict.',
      'Three useful drone moves: reveal-pull-back, dronie, and a slow orbit. Keep speed gentle.',
    ],
  },
  {
    // 8. packing / what to bring
    match: (t) => /(pack|bring|what to take|gear|kit|luggage|suitcase|backpack)/.test(t),
    answers: [
      'For 7 days: 1 carry-on, 3 tops, 2 bottoms, layers. The right phone case + power bank beats a heavy camera.',
      'Skip the "just in case" pile. Pack for the trip you\'re actually going on.',
      'For filming: phone, mini tripod, ND filter, a 20k mAh power bank, USB-C card reader.',
    ],
  },
  {
    // 9. budget / cheap
    match: (t) => /(budget|cheap|affordable|low cost|backpack(ing)?|hostel)/.test(t),
    answers: [
      'Cheapest right now: Albania, Vietnam, Bolivia, Georgia, parts of Turkey. Plenty of beauty, low cost of living.',
      'Cap accommodation at 30% of daily budget; food and activity is where memories live.',
      'Buy long-distance bus/train tickets at counters in person — apps often add a 10-20% surcharge abroad.',
    ],
  },
  {
    // 10. when to go / season
    match: (t) => /(best time|when (to|should).*go|season|month|weather)/.test(t),
    answers: [
      'Off-season usually wins: same place, half the crowd, often half the price. Go a month before peak.',
      'Mediterranean: aim for May or late September. Hot enough, half-empty.',
      'Tropical Asia is best Nov–Feb. East Africa Jul–Oct for wildlife.',
    ],
  },
];

function pickAnswer(rule: Rule): string {
  return rule.answers[Math.floor(Math.random() * rule.answers.length)];
}

function canned(prompt: string): string {
  const p = prompt.toLowerCase().trim();
  if (!p) return "Tell me where you're going or what you're filming and I can help.";
  if (/(hi|hello|hey|sup|yo)\b/.test(p) && p.length < 12) {
    return "Hey — I'm your travel assistant. Ask me about a place, a caption, a hashtag, or a filming trick.";
  }
  if (/(thanks|thank you|cheers|ty)\b/.test(p)) return "You got it. Have fun out there.";
  for (const rule of RULES) {
    if (rule.match(p)) return pickAnswer(rule);
  }
  return "I can help with: trip ideas, captions, hashtags, sunset shots, beaches, food, drones, packing, budgets, and when to go. Try one of those.";
}
