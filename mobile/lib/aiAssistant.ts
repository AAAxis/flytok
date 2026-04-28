export type AiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const SYSTEM_PROMPT =
  "You are Roamrez's in-app travel assistant. Keep replies short (under 80 words), " +
  "concrete, and friendly. Suggest places, captions, hashtags, or filming tips.";

const ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

/**
 * Sends the running conversation to the AI endpoint and returns the assistant's
 * reply. Configure the endpoint by setting EXPO_PUBLIC_AI_ENDPOINT in .env to a
 * URL that accepts POST { messages: [{role, content}], system: string } and
 * returns { reply: string }.
 *
 * Until that endpoint is configured, this falls back to a built-in canned
 * response so the UI is testable end-to-end.
 */
export async function askAssistant(messages: AiMessage[]): Promise<string> {
  if (!ENDPOINT) {
    return localFallback(messages[messages.length - 1]?.content ?? '');
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

function localFallback(prompt: string): string {
  const p = prompt.toLowerCase();
  if (!p.trim()) return "Tell me where you're going or what you're filming and I can help.";
  if (p.includes('caption')) {
    return 'Try something short and place-anchored: a sensory detail + the location. Example: "Wind, salt, and the loudest gulls in Lisbon."';
  }
  if (p.includes('hashtag') || p.includes('tag')) {
    return 'Mix one broad tag (e.g. #travel), one place tag (e.g. #lisbon), and one specific tag (e.g. #miradouro). Three is the sweet spot.';
  }
  if (p.includes('where') || p.includes('go') || p.includes('trip')) {
    return 'For a 3-day window, pick one city + one nature day-trip. Tell me your continent and budget and I can be specific.';
  }
  return "I'd help with this once the AI endpoint is wired (set EXPO_PUBLIC_AI_ENDPOINT). For now, ask me about captions, hashtags, or trip ideas and I’ll give a stock answer.";
}
