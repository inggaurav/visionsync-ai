import { GoogleGenAI, Type } from "@google/genai";
import { Scene, SubtitleSegment, SceneCategory, AnalysisStats } from "../types";
import { getApiKey } from "./apiKey";

const CATEGORY_LABELS: Record<SceneCategory, string> = {
  chemical_reaction:    'Chemical Reaction',
  biological_process:   'Biological Process',
  physics_concept:      'Physics Concept',
  mathematical_concept: 'Mathematical Concept',
  historical_event:     'Historical Event',
  diagram_or_chart:     'Diagram / Chart',
  real_world_example:   'Real-World Example',
  abstract_concept:     'Abstract Concept',
  definition:           'Definition',
  general:              'General',
};

export { CATEGORY_LABELS };

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error('NO_API_KEY');
  return new GoogleGenAI({ apiKey: key });
}

export async function generateScenePrompts(segments: SubtitleSegment[]): Promise<Partial<Scene>[]> {
  const ai = getAI();
  const prompt = `
You are an expert educational content analyst specialising in college-level courses.
Analyse the provided course transcript and identify key visual moments that would benefit students most.

RULES:
1. Density target: 15–35 scenes per 30 minutes of content.
2. ALWAYS flag chemical reactions — even simple ones. For every chemical reaction:
   - Set category to "chemical_reaction"
   - Write the balanced chemical equation in the chemicalEquation field using proper symbols (→, ⇌, subscript numbers e.g. H₂O, CO₂, etc.)
   - The image prompt should show molecular diagrams, laboratory glassware, or the visible reaction (colour change, flame, precipitate, etc.)
3. Categorise every scene accurately using one of:
   chemical_reaction | biological_process | physics_concept | mathematical_concept |
   historical_event | diagram_or_chart | real_world_example | abstract_concept | definition | general
4. Write a conceptTitle (≤6 words) describing what the student will see.
5. Write an educationalNote (1 sentence) explaining why this visual helps a student understand.
6. Assign difficultyLevel: beginner / intermediate / advanced.
7. Extract 2–5 keywords from the segment.
8. Detect the chapter or topic this segment belongs to and put it in chapterTag.
9. Write the aiPrompt as a rich, detailed image generation prompt:
   - For chemical reactions: "Educational diagram showing [reaction name]: [reactants] reacting to form [products]. Show molecular structures, colour changes, and label all species. Scientific illustration style, white background, clear labels, 16:9 format."
   - For everything else: cinematic, photorealistic, visually clear for educational use, 16:9.
10. Ignore filler words, repetitive content, pure introductions/outros.

Transcript data (segments with start/end times in seconds):
${JSON.stringify(segments.slice(0, 200))}

Return ONLY valid JSON matching this exact schema:
{
  "detectedSubject": "string",
  "scenes": [
    {
      "startTime": number,
      "endTime": number,
      "scriptText": "string",
      "conceptTitle": "string",
      "category": "chemical_reaction|biological_process|physics_concept|mathematical_concept|historical_event|diagram_or_chart|real_world_example|abstract_concept|definition|general",
      "difficultyLevel": "beginner|intermediate|advanced",
      "keywords": ["string"],
      "chapterTag": "string",
      "educationalNote": "string",
      "chemicalEquation": "string or null",
      "aiPrompt": "string"
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedSubject: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime:        { type: Type.NUMBER },
                  endTime:          { type: Type.NUMBER },
                  scriptText:       { type: Type.STRING },
                  conceptTitle:     { type: Type.STRING },
                  category:         { type: Type.STRING },
                  difficultyLevel:  { type: Type.STRING },
                  keywords:         { type: Type.ARRAY, items: { type: Type.STRING } },
                  chapterTag:       { type: Type.STRING },
                  educationalNote:  { type: Type.STRING },
                  chemicalEquation: { type: Type.STRING },
                  aiPrompt:         { type: Type.STRING },
                },
                required: ["startTime","endTime","scriptText","conceptTitle","category",
                           "difficultyLevel","keywords","chapterTag","educationalNote","aiPrompt"]
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    return (data.scenes || []).map((s: any, idx: number): Partial<Scene> => ({
      id: `scene-${idx}`,
      startTime:        s.startTime        ?? 0,
      endTime:          s.endTime          ?? 0,
      scriptText:       s.scriptText       ?? '',
      aiPrompt:         s.aiPrompt         ?? '',
      conceptTitle:     s.conceptTitle     ?? 'Untitled Scene',
      category:         (s.category        ?? 'general') as SceneCategory,
      difficultyLevel:  (s.difficultyLevel ?? 'intermediate') as Scene['difficultyLevel'],
      keywords:         s.keywords         ?? [],
      chapterTag:       s.chapterTag       ?? 'General',
      educationalNote:  s.educationalNote  ?? '',
      chemicalEquation: s.chemicalEquation ?? undefined,
      status:           'idle',
      isNecessary:      true,
    }));
  } catch (error: any) {
    if (error.message === 'NO_API_KEY') throw error;
    console.error("Error generating prompts:", error);
    return [];
  }
}

export async function generateImage(prompt: string, category: SceneCategory): Promise<string | null> {
  const ai = getAI();
  const enrichedPrompt = buildEnrichedPrompt(prompt, category);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: { parts: [{ text: enrichedPrompt }] },
      config: { responseModalities: ['IMAGE', 'TEXT'] }
    });

    if (!response.candidates?.[0]?.content?.parts) return null;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    if (error.message === 'NO_API_KEY') throw error;
    console.error("Error generating image:", error);
    return null;
  }
}

function buildEnrichedPrompt(prompt: string, category: SceneCategory): string {
  const base = prompt.trim();
  switch (category) {
    case 'chemical_reaction':
      return `${base} Style: Clean scientific illustration on white background. Show molecular structures with proper bond angles, colour-code atom types (C=black, H=white, O=red, N=blue). Include reaction arrow with conditions. Add small inset showing macroscopic effect. 16:9, high resolution.`;
    case 'biological_process':
      return `${base} Style: Detailed biological illustration, textbook quality. Label all key structures. 16:9.`;
    case 'mathematical_concept':
      return `${base} Style: Clean mathematical visualisation, dark chalkboard or white academic background. Show graphs or geometric figures clearly. 16:9.`;
    case 'diagram_or_chart':
      return `${base} Style: Professional infographic. Clean lines, labelled. 16:9.`;
    case 'historical_event':
      return `${base} Style: Cinematic historical reconstruction. Photorealistic or painterly. Historically accurate. 16:9.`;
    case 'physics_concept':
      return `${base} Style: Physics diagram with vector arrows, field lines. Annotated. 16:9.`;
    default:
      return `${base}, photorealistic cinematic educational image, 16:9 aspect ratio, high resolution, suitable for college students.`;
  }
}

export function buildAnalysisStats(scenes: Scene[], segments: SubtitleSegment[], subject: string): AnalysisStats {
  const byCategory: Partial<Record<SceneCategory, number>> = {};
  const byDifficulty = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const scene of scenes) {
    byCategory[scene.category] = (byCategory[scene.category] ?? 0) + 1;
    byDifficulty[scene.difficultyLevel] = (byDifficulty[scene.difficultyLevel] ?? 0) + 1;
  }
  return {
    totalSegments: segments.length,
    scenesIdentified: scenes.length,
    chemicalReactions: byCategory['chemical_reaction'] ?? 0,
    byCategory,
    byDifficulty,
    detectedSubject: subject,
  };
}
