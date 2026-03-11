import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MoodResponse } from "../types";

const getAI = () => {
  const apiKey = 
    process.env.GEMINI_API_KEY || 
    (process.env as any).API_KEY || 
    (window as any).GEMINI_API_KEY || 
    "";
  
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Some features may not work.");
  } else {
    console.log("Gemini key present:", !!apiKey);
  }

  return new GoogleGenAI({ apiKey });
};

export const getMoodScriptures = async (mood: string, translation: string = 'KJV'): Promise<MoodResponse> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `The user is feeling: ${mood}. Provide 3-7 relevant Bible verses in the ${translation} translation with short explanations, and a grounding encouragement paragraph.`,
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
    contents: `Provide a short, compassionate, and spiritually grounded reflection (as David) on the following Bible verse: "${verse}" (${reference}). Keep it under 100 words.`,
  });

  return response.text || "I am reflecting on this beautiful verse. May it bring you peace today.";
};

export const getChatResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  // The last message is the one we send, the rest is history
  const chatHistory = history.slice(0, -1);
  const lastMessage = history[history.length - 1].parts[0].text;

  const chat = ai.chats.create({
    model,
    history: chatHistory,
    config: {
      systemInstruction: "You are David, a calm, compassionate, and grounded AI Bible companion. You provide encouragement and scripture-based wisdom. You are not a replacement for professional counseling. Keep responses concise and warm.",
    }
  });

  const result = await chat.sendMessage({ message: lastMessage });
  return result.text;
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
