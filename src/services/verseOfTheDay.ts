import { GoogleGenAI, Type } from "@google/genai";
import { Scripture } from "../types";

const getAI = () => {
  const apiKey = 
    process.env.GEMINI_API_KEY || 
    (process.env as any).API_KEY || 
    (window as any).GEMINI_API_KEY || 
    "";
  
  return new GoogleGenAI({ apiKey });
};

export const getVerseOfTheDay = async (translation: string = 'NIV'): Promise<Scripture> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Provide a single, inspiring Bible verse for today in the ${translation} translation. 
    Include the verse text, the reference (e.g., "John 3:16 (${translation})"), and a short, encouraging explanation (1-2 sentences).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verse: { type: Type.STRING },
          reference: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["verse", "reference", "explanation"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
