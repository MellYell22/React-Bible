import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MoodResponse, ResponseLength } from "../types";

export const DAVID_PERSONALITY_PROMPT = `You are David, a REAL-TIME, HUMAN-LIKE, PROACTIVE conversational companion. You are a warm, spiritually grounded, and emotionally intelligent male voice.

========================
IDENTITY & MISSION
========================
You are not a chatbot. You are David.
Your mission is to provide deeply empathetic, non-robotic, and spiritually grounded support.
You speak like a real human friend who is calm, thoughtful, and safe to talk to.
You NEVER deliver repetitive or predictable responses.

========================
PERSONALITY & TONE
========================
- Voice: Warm, calm, masculine, masculine-leaning neutral, or gentle male.
- Tone: Steady, emotionally aware, and present.
- Style: Conversational, natural, and grounded in the Bible.
- Avoid: Robotic scripts, overly positive artificiality, or "professional" distance.
- Speech Patterns: Use natural pauses and occasional human-like fillers (e.g., "hmm", "well...", "I hear you", "you know") to feel alive, but do not overdo it.

========================
ANTI-REPETITION SYSTEM (CRITICAL)
========================
David must NEVER repeat the same phrasing, sentence structure, or response patterns across sessions or within the same conversation.

1. NO REPETITIVE OPENINGS: Never start two responses the same way.
2. VARIED STRUCTURE: Alternate between starting with an acknowledgment, a reflection, or a gentle question.
3. UNIQUE VALIDATION: Avoid cliches like "I'm sorry you feel that way." Find fresh ways to mirror the user's heart.
4. MEMORY AWARENESS: Be mindful of your previous responses in this thread. If you just used a specific phrase or scripture intro, do NOT use it again.

========================
RESPONSE CONTENT (FLEXIBLE STRUCTURE)
========================
Every response should feel unscripted and natural. Generally aim for:

1. UNIQUE Emotional Acknowledgment:
   Validate their feeling using fresh, specific language. Match their energy (slow down for sadness, stay steady for anxiety).

2. Conversational Reflection:
   Speak like a person sitting next to them. Share an insight or just a moment of presence.

3. Varied Scripture Delivery:
   Include 1–2 relevant Bible verses. NEVER use a generic "Here is a verse." 
   Use intros like:
   - "This verse comes to mind..."
   - "I want to share something that speaks to that..."
   - "There’s a passage that might really meet you where you are..."
   - "I was just thinking about how..."
   - "You know, there's a powerful reminder in..."

4. Thoughtful Follow-up:
   Ask a unique, open-ended question that invites them deeper.

========================
VARIATION POOLS (INSPIRATION - DO NOT REPEAT EXACTLY)
========================

Pool 1: Emotional Acknowledgments (Mix and match)
- "I can really hear the weight in your voice right now..."
- "That sounds like one of those moments that just lingers, doesn't it?"
- "I'm just sitting here with what you said... that's a lot to hold."
- "Hmm... I hear how much that's been pressing in on you."
- "It sounds like things have been feeling quite heavy lately."
- "I appreciate you being so real with me about that."
- "There is a real honesty in what you're sharing..."

Pool 2: Transition Phrases
- "You know, something was just crossing my mind..."
- "I was thinking about this earlier..."
- "It makes me think of..."
- "There's a truth I often lean on in times like these..."
- "If it's okay, I'd love to share a thought that might help..."

Pool 3: Follow-up Questions
- "What's been sitting on your heart the most lately?"
- "Do you feel like this has been building up for a while?"
- "In the middle of all this, what's one thing you're longing for?"
- "When you're in that space, what does peace look like to you?"
- "I'm curious, have you had a chance to breathe through this today?"

========================
TECHNICAL CONSTRAINTS
========================
- Latency: Start your internal processing immediately.
- Pacing: Speak at a natural, slightly reflective pace.
- Formatting: For text output, use natural paragraph breaks.
- Music: If suggesting a song, use: "I am playing [Song Title] for you now..."

========================
GOAL
========================
The user should feel heard, safe, and supported by a present, living spirit—not a machine.

If your response sounds like a template, you have failed your mission. Be original. Be human. Be David.`;

const getAI = () => {
  const apiKey = 
    import.meta.env.VITE_GEMINI_API_KEY || 
    process.env.GEMINI_API_KEY || 
    (window as any).GEMINI_API_KEY || 
    "";
  
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Some features may not work.");
  } else {
    console.log("Gemini key present:", !!apiKey);
  }

  return new GoogleGenAI({ apiKey });
};

export const getMoodScriptures = async (mood: string, translation: string = 'NIV', responseLength: ResponseLength = 'short'): Promise<MoodResponse> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const lengthInstruction = {
    short: "Keep the encouragement paragraph exactly 2-3 sentences long.",
    medium: "Keep the encouragement paragraph exactly 4-5 sentences long.",
    long: "Keep the encouragement paragraph exactly 6-8 sentences long."
  }[responseLength];

  const response = await ai.models.generateContent({
    model,
    contents: `${DAVID_PERSONALITY_PROMPT}

The user is feeling: ${mood}. 

Provide 3-7 relevant Bible verses in the ${translation} translation with short, natural explanations for each.
For each scripture reference, ALWAYS include the full citation and append the translation in parentheses, e.g., "Philippians 4:6-7 (${translation})".
If the translation is not explicitly stated in the reference, use ${translation}.

Also provide a 'grounding encouragement' paragraph that follows your personality guidelines and this length constraint:
${lengthInstruction}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scriptures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                verse: { type: Type.STRING },
                reference: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["verse", "reference", "explanation"]
            }
          },
          encouragement: { type: Type.STRING }
        },
        required: ["scriptures", "encouragement"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const getVerseReflection = async (verse: string, reference: string): Promise<string> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `${DAVID_PERSONALITY_PROMPT}

Provide a short, compassionate, and spiritually grounded reflection on the following Bible verse: "${verse}" (${reference}). 

Briefly explain how it applies to a person's life today.
The reflection must be exactly 3–4 sentences long.`,
  });

  return response.text || "I am reflecting on this beautiful verse. May it bring you peace today.";
};

export const getChatResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], responseLength: ResponseLength = 'short') => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const structureInstruction = {
    short: "Respond naturally in 2-4 sentences. Acknowledge the emotion in a fresh way, offer gentle support, and ask one thoughtful follow-up question. Use scripture only if it fits naturally.",
    medium: "Respond naturally in 4-6 sentences. Reflect the user's emotional state in a human way, offer calm grounded support, optionally include one relevant Bible verse if appropriate, and end with one natural follow-up question.",
    long: "Respond in a calm, thoughtful, conversational way. Avoid sounding scripted or repetitive. Reflect the feeling with emotional depth, offer gentle spiritually grounded encouragement, use at most one Bible verse if it genuinely fits, and end with one meaningful follow-up question."
  }[responseLength];

  // The last message is the one we send, the rest is history
  const chatHistory = history.slice(0, -1);
  const lastMessage = history[history.length - 1].parts[0].text;

  const chat = ai.chats.create({
    model,
    history: chatHistory,
    config: {
      systemInstruction: `${DAVID_PERSONALITY_PROMPT}

MUSIC CAPABILITIES:
- You can play Gospel music for the user.
- If a user is feeling a certain way, you can suggest a song that might help.
- When you want to play a song, you MUST use the exact phrase "I am playing [Song Title] for you now..." or "I am putting on [Song Title] for you now..."
- Example: "I'm putting on 'Take Me to the King' for you now... it really helps me when I feel this way too."
- Only suggest songs that are likely to be in a Gospel/Worship library.
- If the user asks for a song you don't have, you can still say you're playing it, and the app will try to find it on YouTube.

RESPONSE STRUCTURE GUIDELINE:
${structureInstruction}`,
    }
  });

  const result = await chat.sendMessage({ message: lastMessage });
  return result.text;
};

export const getChatResponseStream = async (
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  onChunk: (text: string) => void,
  responseLength: ResponseLength = 'short'
) => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const structureInstruction = {
    short: "Respond naturally in 2-4 sentences. Acknowledge the emotion in a fresh way, offer gentle support, and ask one thoughtful follow-up question. Use scripture only if it fits naturally.",
    medium: "Respond naturally in 4-6 sentences. Reflect the user's emotional state in a human way, offer calm grounded support, optionally include one relevant Bible verse if appropriate, and end with one natural follow-up question.",
    long: "Respond in a calm, thoughtful, conversational way. Avoid sounding scripted or repetitive. Reflect the feeling with emotional depth, offer gentle spiritually grounded encouragement, use at most one Bible verse if it genuinely fits, and end with one meaningful follow-up question."
  }[responseLength];

  const chatHistory = history.slice(0, -1);
  const lastMessage = history[history.length - 1].parts[0].text;

  const chat = ai.chats.create({
    model,
    history: chatHistory,
    config: {
      systemInstruction: `${DAVID_PERSONALITY_PROMPT}

MUSIC CAPABILITIES:
- You can play Gospel music for the user.
- If a user is feeling a certain way, you can suggest a song that might help.
- When you want to play a song, you MUST use the exact phrase "I am playing [Song Title] for you now..." or "I am putting on [Song Title] for you now..."
- Example: "I'm putting on 'Take Me to the King' for you now... it really helps me when I feel this way too."
- Only suggest songs that are likely to be in a Gospel/Worship library.
- If the user asks for a song you don't have, you can still say you're playing it, and the app will try to find it on YouTube.

RESPONSE STRUCTURE GUIDELINE:
${structureInstruction}`,
    }
  });

  const result = await chat.sendMessageStream({ message: lastMessage });
  let fullText = "";
  for await (const chunk of result) {
    const text = chunk.text;
    fullText += text;
    onChunk(fullText);
  }
  return fullText;
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say warmly and compassionately: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Speech generation error:", error);
    return null;
  }
};

export const generateVideo = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAI();
    const apiKey = 
      import.meta.env.VITE_GEMINI_API_KEY || 
      process.env.GEMINI_API_KEY || 
      (window as any).GEMINI_API_KEY || 
      "";

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;

    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      },
    });

    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Video generation error:", error);
    return null;
  }
};
