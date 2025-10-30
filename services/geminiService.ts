
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { Summary } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "A concise, catchy title for the conversation, under 5 words."
        },
        keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 3-5 main topics or takeaways from the conversation."
        },
        actionItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of any specific tasks or action items mentioned. If none, return an empty array."
        },
    }
};

export const summarizeTranscript = async (transcript: string): Promise<Summary> => {
    if (!transcript.trim()) {
        return {
            title: "A Moment of Silence",
            keyPoints: ["No words were spoken, but the silence was profound."],
            actionItems: []
        };
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Summarize the following conversation transcript:\n\n---\n${transcript}\n---`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: summarySchema,
            },
        });

        const jsonText = response.text.trim();
        const summaryData = JSON.parse(jsonText);
        return summaryData;
    } catch (error) {
        console.error("Error summarizing transcript:", error);
        return {
            title: "Summary Failed",
            keyPoints: ["Could not generate a summary for this conversation."],
            actionItems: []
        };
    }
};

export const getAiInstance = () => ai;
