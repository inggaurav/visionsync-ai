export interface SubtitleSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export type SceneCategory =
  | 'chemical_reaction'
  | 'biological_process'
  | 'physics_concept'
  | 'mathematical_concept'
  | 'historical_event'
  | 'diagram_or_chart'
  | 'real_world_example'
  | 'abstract_concept'
  | 'definition'
  | 'general';

export interface Scene {
  id: string;
  startTime: number;
  endTime: number;
  scriptText: string;
  aiPrompt: string;
  imageUrl?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  isNecessary: boolean;

  // New enhanced fields
  category: SceneCategory;
  conceptTitle: string;        // Short title of the concept, e.g. "Combustion Reaction"
  educationalNote: string;     // Why this scene matters for students
  chapterTag: string;          // Auto-detected chapter / topic grouping
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  keywords: string[];          // Key terms detected in this segment
  chemicalEquation?: string;   // If category === 'chemical_reaction', the equation e.g. "2H₂ + O₂ → 2H₂O"
}

export interface ProjectData {
  name: string;
  videoFileName?: string;
  subject?: string;             // Detected subject area e.g. "Organic Chemistry"
  totalDuration?: number;       // In seconds
  segments: SubtitleSegment[];
  scenes: Scene[];
  analysisStats?: AnalysisStats;
}

export interface AnalysisStats {
  totalSegments: number;
  scenesIdentified: number;
  chemicalReactions: number;
  byCategory: Partial<Record<SceneCategory, number>>;
  byDifficulty: { beginner: number; intermediate: number; advanced: number };
  detectedSubject: string;
}
