import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileUp, Download, Play, Image as ImageIcon, Trash2, Sparkles,
  Zap, Loader2, FlaskConical, Brain, BookOpen, BarChart3,
  ChevronDown, ChevronUp, Tag, RefreshCw, Eye, Layers,
  Key, Settings, Microscope, Calculator, Globe, Star, Atom
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { Toaster, toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { parseSubtitles } from './lib/subtitleParser';
import { generateScenePrompts, generateImage, buildAnalysisStats, CATEGORY_LABELS } from './lib/geminiService';
import { generatePremiereXML } from './lib/xmlGenerator';
import { ProjectData, Scene, SubtitleSegment, SceneCategory, AnalysisStats } from './types';
import { hasApiKey, maskedKey } from './lib/apiKey';
import { ApiKeyModal } from './components/ApiKeyModal';
import { cn } from '@/lib/utils';

// ─── Category Config ──────────────────────────────────────────────────────────
const CATEGORY_ICON: Record<SceneCategory, React.ReactNode> = {
  chemical_reaction:    <FlaskConical size={12} />,
  biological_process:   <Microscope size={12} />,
  physics_concept:      <Atom size={12} />,
  mathematical_concept: <Calculator size={12} />,
  historical_event:     <Globe size={12} />,
  diagram_or_chart:     <BarChart3 size={12} />,
  real_world_example:   <Star size={12} />,
  abstract_concept:     <Brain size={12} />,
  definition:           <BookOpen size={12} />,
  general:              <Layers size={12} />,
};

const CATEGORY_COLOR: Record<SceneCategory, string> = {
  chemical_reaction:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  biological_process:   'bg-green-500/20 text-green-300 border-green-500/30',
  physics_concept:      'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  mathematical_concept: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  historical_event:     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  diagram_or_chart:     'bg-blue-500/20 text-blue-300 border-blue-500/30',
  real_world_example:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
  abstract_concept:     'bg-violet-500/20 text-violet-300 border-violet-500/30',
  definition:           'bg-slate-500/20 text-slate-300 border-slate-500/30',
  general:              'bg-slate-600/20 text-slate-400 border-slate-600/30',
};

const DIFFICULTY_COLOR = {
  beginner:     'bg-green-500/15 text-green-400 border-green-500/25',
  intermediate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  advanced:     'bg-red-500/15 text-red-400 border-red-500/25',
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'grid' | 'gallery' | 'stats'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<SceneCategory | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<Scene['difficultyLevel'] | 'all'>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [showOnlyReactions, setShowOnlyReactions] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(hasApiKey());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show API key modal on first launch
  useEffect(() => {
    if (!hasApiKey()) setShowApiKeyModal(true);
  }, []);

  const chapters = useMemo(() => {
    if (!project) return [];
    return ['all', ...Array.from(new Set(project.scenes.map(s => s.chapterTag)))];
  }, [project]);

  const filteredScenes = useMemo(() => {
    if (!project) return [];
    return project.scenes.filter(scene => {
      if (showOnlyReactions && scene.category !== 'chemical_reaction') return false;
      if (categoryFilter !== 'all' && scene.category !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && scene.difficultyLevel !== difficultyFilter) return false;
      if (chapterFilter !== 'all' && scene.chapterTag !== chapterFilter) return false;
      return true;
    });
  }, [project, categoryFilter, difficultyFilter, chapterFilter, showOnlyReactions]);

  // ─── Guards ─────────────────────────────────────────────────────────────────
  const requireKey = (): boolean => {
    if (!hasApiKey()) {
      setShowApiKeyModal(true);
      toast.error('Please set your Gemini API key first.');
      return false;
    }
    return true;
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'srt' && extension !== 'vtt') {
      toast.error('Please upload an SRT or VTT file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const segments = parseSubtitles(content, extension as 'srt' | 'vtt');
      const totalDuration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;
      setProject({ name: file.name.replace(/\.[^/.]+$/, ''), segments, scenes: [], totalDuration });
      toast.success(`Loaded ${segments.length} segments (${Math.round(totalDuration / 60)} min)`);
    };
    reader.readAsText(file);
  };

  const analyzeSegments = async () => {
    if (!requireKey()) return;
    if (!project || project.segments.length === 0) return;
    setIsAnalyzing(true);
    toast.info('Running deep educational analysis…');
    try {
      const aiScenes = await generateScenePrompts(project.segments);
      const newScenes: Scene[] = aiScenes.map((s): Scene => ({
        id: s.id ?? `scene-${Math.random()}`,
        startTime: s.startTime ?? 0,
        endTime: s.endTime ?? 0,
        scriptText: s.scriptText ?? '',
        aiPrompt: s.aiPrompt ?? '',
        conceptTitle: s.conceptTitle ?? 'Untitled',
        category: s.category ?? 'general',
        difficultyLevel: s.difficultyLevel ?? 'intermediate',
        keywords: s.keywords ?? [],
        chapterTag: s.chapterTag ?? 'General',
        educationalNote: s.educationalNote ?? '',
        chemicalEquation: s.chemicalEquation,
        status: 'idle',
        isNecessary: true,
      }));
      const stats = buildAnalysisStats(newScenes, project.segments, (aiScenes[0] as any)?.detectedSubject ?? 'Unknown');
      setProject(prev => prev ? { ...prev, scenes: newScenes, analysisStats: stats, subject: stats.detectedSubject } : null);
      const rxCount = stats.chemicalReactions;
      toast.success(`${newScenes.length} scenes identified${rxCount > 0 ? ` — ${rxCount} chemical reaction${rxCount > 1 ? 's' : ''} detected 🧪` : ''}`);
    } catch (e: any) {
      if (e.message === 'NO_API_KEY') { setShowApiKeyModal(true); }
      else toast.error('Analysis failed. Check your API key.');
    }
    setIsAnalyzing(false);
  };

  const generateSingleImage = async (sceneId: string) => {
    if (!requireKey()) return;
    if (!project) return;
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setProject(prev => prev ? {
      ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: 'generating' } : s)
    } : null);

    try {
      const imageUrl = await generateImage(scene.aiPrompt, scene.category);
      setProject(prev => prev ? {
        ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? {
          ...s, imageUrl: imageUrl ?? undefined, status: imageUrl ? 'completed' : 'error'
        } : s)
      } : null);
      if (imageUrl) toast.success(`Rendered: ${scene.conceptTitle}`);
      else toast.error(`Failed to render: ${scene.conceptTitle}`);
    } catch (e: any) {
      if (e.message === 'NO_API_KEY') setShowApiKeyModal(true);
      setProject(prev => prev ? {
        ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, status: 'error' } : s)
      } : null);
    }
  };

  const generateAllImages = async () => {
    if (!requireKey()) return;
    if (!project) return;
    const pending = project.scenes.filter(s => s.status !== 'completed');
    if (pending.length === 0) { toast.info('All scenes already rendered!'); return; }
    toast.info(`Rendering ${pending.length} scenes…`);
    for (let i = 0; i < pending.length; i++) {
      setGlobalProgress(Math.round(((i + 1) / pending.length) * 100));
      await generateSingleImage(pending[i].id);
    }
    setGlobalProgress(0);
    toast.success('All images rendered!');
  };

  const generateCategoryImages = async (cat: SceneCategory) => {
    if (!requireKey()) return;
    if (!project) return;
    const pending = project.scenes.filter(s => s.category === cat && s.status !== 'completed');
    if (pending.length === 0) { toast.info('No pending scenes in this category.'); return; }
    for (let i = 0; i < pending.length; i++) {
      setGlobalProgress(Math.round(((i + 1) / pending.length) * 100));
      await generateSingleImage(pending[i].id);
    }
    setGlobalProgress(0);
  };

  const exportZip = async () => {
    if (!project || project.scenes.length === 0) return;
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');
    let count = 0;
    project.scenes.forEach((scene, index) => {
      if (scene.imageUrl) {
        imagesFolder?.file(
          `scene_${String(index + 1).padStart(3, '0')}_${scene.category}.png`,
          scene.imageUrl.split(',')[1], { base64: true }
        );
        count++;
      }
    });
    if (count === 0) { toast.error('No images to export.'); return; }
    const manifest = project.scenes.map((s, i) => ({
      sceneNumber: i + 1, conceptTitle: s.conceptTitle, category: s.category,
      chapterTag: s.chapterTag, startTime: s.startTime, endTime: s.endTime,
      difficultyLevel: s.difficultyLevel, keywords: s.keywords,
      chemicalEquation: s.chemicalEquation, educationalNote: s.educationalNote, hasImage: !!s.imageUrl,
    }));
    zip.file('scene_manifest.json', JSON.stringify(manifest, null, 2));
    if (!project.videoFileName) toast.warning('No video source file specified — XML exported without background track.');
    zip.file(`${project.name}.xml`, generatePremiereXML(project.name, project.scenes, project.videoFileName));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project.name}_Package.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success(`Exported ${count} images + XML + manifest!`, { duration: 6000 });
  };

  const clearProject = () => {
    setProject(null);
    setCategoryFilter('all'); setDifficultyFilter('all');
    setChapterFilter('all'); setShowOnlyReactions(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = project?.analysisStats;
  const completedCount = project?.scenes.filter(s => s.status === 'completed').length ?? 0;
  const totalScenes = project?.scenes.length ?? 0;
  const keyPreview = maskedKey() || 'Not set';

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSaved={() => { setApiKeySet(true); toast.success('Gemini key saved && verified!'); }} onCleared={() => { setApiKeySet(false); toast.info('API key cleared.'); }}
      />

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-brand-surface border-b border-slate-700 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg"><Play size={18} fill="white" className="text-white" /></div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">VisionSync AI <span className="text-blue-400 text-xs font-mono ml-1">v2.0</span></h1>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-mono">College Course Visualizer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* API Key indicator */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-colors',
              apiKeySet
                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 animate-pulse'
            )}
          >
            <Key size={11} />
            {apiKeySet ? keyPreview : 'Set API Key'}
          </button>
          {project?.subject && (
            <div className="hidden md:flex items-center px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full">
              <BookOpen size={11} className="text-blue-400 mr-1.5" />
              <span className="text-[10px] font-bold text-blue-300">{project.subject}</span>
            </div>
          )}
          {project && totalScenes > 0 && (
            <Button onClick={exportZip} className="bg-blue-600 text-white hover:bg-blue-500 gap-2 h-8 px-4 text-xs font-bold">
              Export Package <Download size={14} />
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-64 bg-brand-sidebar border-r border-slate-800 p-5 flex flex-col gap-6 shrink-0 overflow-y-auto">
          {!project ? (
            <div className="flex flex-col gap-3 py-10 text-center opacity-40">
              <FileUp size={36} className="mx-auto" />
              <p className="text-[10px] uppercase tracking-widest">No active project</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block mb-1.5 text-[9px] font-bold tracking-widest text-slate-500 uppercase">Video Source File</label>
                <input
                  type="text" placeholder="e.g. lecture_01.mp4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500/50"
                  value={project.videoFileName ?? ''}
                  onChange={(e) => setProject(prev => prev ? { ...prev, videoFileName: e.target.value } : null)}
                />
              </div>
              {totalScenes > 0 && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] uppercase text-slate-500 font-bold">Render Progress</span>
                    <span className="text-[9px] font-mono text-blue-400">{completedCount}/{totalScenes}</span>
                  </div>
                  <Progress value={(completedCount / totalScenes) * 100} className="h-1 bg-slate-800" />
                </div>
              )}
              {stats && (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Segments', val: stats.totalSegments },
                    { label: 'Scenes', val: stats.scenesIdentified },
                    { label: '🧪 Reactions', val: stats.chemicalReactions },
                    { label: 'Rendered', val: completedCount },
                  ].map(({ label, val }) => (
                    <div key={label} className="p-2 bg-slate-800/60 rounded-lg border border-slate-700 text-center">
                      <div className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">{label}</div>
                      <div className="text-sm font-mono font-bold text-white">{val}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {totalScenes === 0 ? (
                  <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs" onClick={analyzeSegments} disabled={isAnalyzing}>
                    {isAnalyzing ? <><Loader2 className="animate-spin mr-2" size={15} />Analysing…</> : <><Sparkles size={14} className="mr-2" />Run AI Analysis</>}
                  </Button>
                ) : (
                  <>
                    <Button className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs" onClick={generateAllImages} disabled={globalProgress > 0}>
                      {globalProgress > 0 ? <><Loader2 className="animate-spin mr-2" size={14} />{globalProgress}%</> : <><Zap size={14} className="mr-2" />Generate All</>}
                    </Button>
                    {stats && stats.chemicalReactions > 0 && (
                      <Button className="w-full h-9 bg-orange-600/80 hover:bg-orange-500 text-white font-bold text-xs" onClick={() => generateCategoryImages('chemical_reaction')} disabled={globalProgress > 0}>
                        <FlaskConical size={13} className="mr-2" />Generate Reactions ({stats.chemicalReactions})
                      </Button>
                    )}
                    <Button variant="outline" className="w-full h-8 border-slate-700 text-slate-400 hover:text-white text-xs" onClick={clearProject}>
                      <Trash2 size={12} className="mr-1.5" />Reset Project
                    </Button>
                  </>
                )}
              </div>
              {chapters.length > 2 && (
                <div>
                  <label className="block mb-1.5 text-[9px] font-bold tracking-widest text-slate-500 uppercase">Filter by Chapter</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {chapters.map(ch => (
                      <button key={ch} onClick={() => setChapterFilter(ch)}
                        className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors',
                          chapterFilter === ch ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                        {ch === 'all' ? 'All Chapters' : ch}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* API Key shortcut in sidebar */}
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold mt-auto"
              >
                <Settings size={13} /> Manage API Key
              </button>
            </>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 bg-brand-bg p-5 overflow-y-auto">
          {!project ? (
            <div className="h-full flex items-center justify-center">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg text-center">
                {/* API key warning banner */}
                {!apiKeySet && (
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-red-900/30 border border-red-500/30 rounded-xl text-left hover:bg-red-900/40 transition-colors"
                  >
                    <Key size={16} className="text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-300">API Key Required</p>
                      <p className="text-[10px] text-red-400/70">Click to add your Gemini API key to enable AI features</p>
                    </div>
                  </button>
                )}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group cursor-pointer aspect-video bg-brand-surface border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl flex flex-col items-center justify-center transition-all p-12 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors" />
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors">
                    <FileUp size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Upload Course Script</h3>
                  <p className="text-slate-400 text-sm max-w-[280px] mx-auto">Supports .srt and .vtt — chemical reactions, diagrams, and key concepts auto-detected</p>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".srt,.vtt" onChange={handleFileUpload} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[
                    { icon: <FlaskConical size={16} />, label: 'Chemical Reactions', desc: 'Auto-detected & visualized' },
                    { icon: <Brain size={16} />, label: 'Smart Categorisation', desc: '10 scene types classified' },
                    { icon: <BarChart3 size={16} />, label: 'Analytics Dashboard', desc: 'Chapter & difficulty stats' },
                  ].map(f => (
                    <div key={f.label} className="p-3 bg-brand-surface border border-slate-800 rounded-xl text-center">
                      <div className="text-blue-400 flex justify-center mb-1.5">{f.icon}</div>
                      <div className="text-[10px] font-bold text-white mb-0.5">{f.label}</div>
                      <div className="text-[9px] text-slate-500">{f.desc}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto pb-20">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <div className="flex items-center justify-between mb-5">
                  <TabsList className="bg-brand-surface border border-slate-700 p-1">
                    <TabsTrigger value="grid" className="text-[9px] uppercase font-bold data-[state=active]:bg-slate-700"><Layers size={11} className="mr-1.5" />Scenes</TabsTrigger>
                    <TabsTrigger value="gallery" className="text-[9px] uppercase font-bold data-[state=active]:bg-slate-700"><Eye size={11} className="mr-1.5" />Gallery</TabsTrigger>
                    <TabsTrigger value="stats" className="text-[9px] uppercase font-bold data-[state=active]:bg-slate-700"><BarChart3 size={11} className="mr-1.5" />Analytics</TabsTrigger>
                  </TabsList>
                  {totalScenes > 0 && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {globalProgress > 0 && <span className="text-[9px] font-mono text-blue-400 animate-pulse uppercase">Processing {globalProgress}%</span>}
                      <button onClick={() => setShowOnlyReactions(v => !v)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold border transition-colors',
                          showOnlyReactions ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'border-slate-700 text-slate-500 hover:text-slate-300')}>
                        <FlaskConical size={10} /> Reactions Only
                      </button>
                      <select className="bg-brand-surface border border-slate-700 rounded-full px-3 py-1.5 text-[9px] font-bold text-slate-300 focus:outline-none"
                        value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value as any)}>
                        <option value="all">All Levels</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  )}
                </div>

                <TabsContent value="grid" className="outline-none space-y-4">
                  {totalScenes === 0 ? (
                    <div className="bg-brand-surface border border-slate-800 rounded-2xl p-20 text-center flex flex-col items-center gap-4">
                      <Sparkles size={36} className="text-indigo-500/50" />
                      <div>
                        <h3 className="text-lg font-bold text-white">Run AI Analysis First</h3>
                        <p className="text-sm text-slate-500 mt-1">Click "Run AI Analysis" in the sidebar to identify scenes and detect chemical reactions.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Showing {filteredScenes.length} of {totalScenes} scenes</p>
                      {filteredScenes.map((scene, idx) => (
                        <SceneCard key={scene.id} scene={scene} index={idx}
                          expanded={expandedScene === scene.id}
                          onToggleExpand={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                          onGenerate={() => generateSingleImage(scene.id)}
                          onPromptChange={(val) => setProject(prev => prev ? {
                            ...prev, scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, aiPrompt: val } : s)
                          } : null)}
                        />
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="gallery" className="outline-none">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {project.scenes.filter(s => s.imageUrl).map((s) => (
                      <div key={s.id} className="group relative aspect-video bg-brand-surface rounded-xl overflow-hidden border border-slate-800">
                        <img src={s.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={s.conceptTitle} />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full w-fit mb-1.5 border text-[9px] font-bold', CATEGORY_COLOR[s.category])}>
                            {CATEGORY_ICON[s.category]}<span className="ml-1">{CATEGORY_LABELS[s.category]}</span>
                          </div>
                          <p className="text-[10px] font-bold text-white">{s.conceptTitle}</p>
                          {s.chemicalEquation && <p className="text-[9px] font-mono text-orange-300 mt-0.5">{s.chemicalEquation}</p>}
                        </div>
                      </div>
                    ))}
                    {project.scenes.filter(s => s.imageUrl).length === 0 && (
                      <div className="col-span-3 py-20 text-center text-slate-500 text-sm">No images generated yet.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="outline-none">
                  {!stats ? <div className="py-20 text-center text-slate-500 text-sm">Run AI Analysis to see analytics.</div>
                    : <AnalyticsDashboard stats={stats} scenes={project.scenes} />}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>

      <footer className="h-7 bg-brand-surface border-t border-slate-700 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', apiKeySet ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500')} />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{apiKeySet ? 'API Ready' : 'No API Key'}</span>
          </div>
          {project && <span className="text-[9px] text-slate-600 uppercase font-bold">{project.segments.length} segments · {totalScenes} scenes · {completedCount} rendered</span>}
        </div>
        <span className="text-[9px] font-mono text-slate-600 uppercase">Gemini 2.0 Flash · VisionSync v2.0</span>
      </footer>
    </div>
  );
}

// ─── Scene Card ───────────────────────────────────────────────────────────────
function SceneCard({ scene, index, expanded, onToggleExpand, onGenerate, onPromptChange }: {
  scene: Scene; index: number; expanded: boolean;
  onToggleExpand: () => void; onGenerate: () => void; onPromptChange: (val: string) => void;
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border transition-all',
        scene.category === 'chemical_reaction'
          ? 'bg-orange-950/20 border-orange-500/20 hover:border-orange-400/40'
          : 'bg-brand-surface border-slate-700/50 hover:border-blue-500/30')}>
      <div className="flex gap-4 p-4">
        <div className="w-48 shrink-0">
          <div className="aspect-video bg-brand-bg rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-700 relative overflow-hidden group/img">
            {scene.imageUrl ? (
              <img src={scene.imageUrl} alt={scene.conceptTitle} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                {scene.status === 'generating' ? <Loader2 className="text-blue-500 animate-spin" size={24} /> : <ImageIcon className="text-slate-700" size={24} />}
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{scene.status === 'generating' ? 'Rendering…' : 'Not Rendered'}</span>
              </div>
            )}
            <div className="absolute top-2 left-2">
              <span className="bg-black/70 text-[8px] font-mono px-1.5 py-0.5 rounded text-slate-300">#{String(index + 1).padStart(3, '0')}</span>
            </div>
            {scene.imageUrl && (
              <a href={scene.imageUrl} download={`scene_${index + 1}_${scene.category}.png`}
                className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <Download size={16} className="text-white" />
              </a>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight truncate">{scene.conceptTitle}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold border', CATEGORY_COLOR[scene.category])}>
                  {CATEGORY_ICON[scene.category]} {CATEGORY_LABELS[scene.category]}
                </span>
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold border', DIFFICULTY_COLOR[scene.difficultyLevel])}>{scene.difficultyLevel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" onClick={onGenerate} disabled={scene.status === 'generating'}
                className={cn('h-7 px-3 text-[9px] font-bold uppercase',
                  scene.status === 'completed' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
                {scene.status === 'generating' ? <Loader2 size={11} className="animate-spin" />
                  : scene.status === 'completed' ? <><RefreshCw size={10} className="mr-1" />Redo</>
                  : <><Zap size={10} className="mr-1" />Render</>}
              </Button>
              <button onClick={onToggleExpand} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>
          {scene.chemicalEquation && (
            <div className="mb-2 px-3 py-2 bg-orange-900/30 border border-orange-500/30 rounded-xl flex items-center gap-2">
              <FlaskConical size={12} className="text-orange-400 shrink-0" />
              <span className="font-mono text-orange-200 text-xs">{scene.chemicalEquation}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-2 border-l-2 border-indigo-500/30 pl-2.5">"{scene.scriptText}"</p>
          {scene.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {scene.keywords.slice(0, 4).map(kw => (
                <span key={kw} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[8px] font-mono rounded border border-slate-700">{kw}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-3">
              <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                <div className="text-[8px] font-bold uppercase text-blue-400 mb-1 flex items-center gap-1.5"><BookOpen size={9} /> Educational Note</div>
                <p className="text-xs text-blue-200/80 leading-relaxed">{scene.educationalNote}</p>
              </div>
              <div>
                <label className="text-[8px] font-bold uppercase text-slate-500 tracking-widest mb-1.5 block">Image Generation Prompt (editable)</label>
                <textarea className="w-full bg-brand-bg/60 border border-slate-700/50 rounded-xl p-3 text-xs font-mono text-blue-300 leading-normal focus:outline-none focus:border-blue-500/50 resize-none min-h-[80px]"
                  value={scene.aiPrompt} onChange={(e) => onPromptChange(e.target.value)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsDashboard({ stats, scenes }: { stats: AnalysisStats; scenes: Scene[] }) {
  const maxCat = Math.max(...Object.values(stats.byCategory).map(v => v ?? 0), 1);
  const chapters = Array.from(new Set(scenes.map(s => s.chapterTag)));
  return (
    <div className="space-y-5">
      <div className="p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/20 rounded-2xl flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase text-blue-400 font-bold mb-0.5">Detected Subject</div>
          <div className="text-lg font-bold text-white">{stats.detectedSubject}</div>
        </div>
        {stats.chemicalReactions > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-orange-500/20 border border-orange-500/30 rounded-xl">
            <FlaskConical size={20} className="text-orange-400" />
            <div>
              <div className="text-[9px] uppercase text-orange-400 font-bold">Reactions Found</div>
              <div className="text-xl font-bold text-orange-200">{stats.chemicalReactions}</div>
            </div>
          </div>
        )}
      </div>
      <div className="bg-brand-surface border border-slate-800 rounded-2xl p-4">
        <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-4">Scene Categories</h3>
        <div className="space-y-2.5">
          {(Object.entries(stats.byCategory) as [SceneCategory, number][]).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold w-40 shrink-0', CATEGORY_COLOR[cat])}>
                {CATEGORY_ICON[cat]}<span className="truncate ml-1">{CATEGORY_LABELS[cat]}</span>
              </div>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', cat === 'chemical_reaction' ? 'bg-orange-500' : 'bg-blue-500')} style={{ width: `${(count / maxCat) * 100}%` }} />
              </div>
              <span className="text-xs font-mono font-bold text-slate-300 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['beginner', 'intermediate', 'advanced'] as const).map(level => (
          <div key={level} className="bg-brand-surface border border-slate-800 rounded-xl p-3 text-center">
            <div className={cn('text-xl font-bold font-mono mb-0.5', level === 'beginner' ? 'text-green-400' : level === 'intermediate' ? 'text-yellow-400' : 'text-red-400')}>{stats.byDifficulty[level]}</div>
            <div className="text-[8px] uppercase text-slate-500 font-bold capitalize">{level}</div>
          </div>
        ))}
      </div>
      {chapters.length > 0 && (
        <div className="bg-brand-surface border border-slate-800 rounded-2xl p-4">
          <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-3">Detected Chapters / Topics</h3>
          <div className="flex flex-wrap gap-2">
            {chapters.map(ch => (
              <div key={ch} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-full">
                <Tag size={9} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-300">{ch}</span>
                <span className="text-[8px] font-mono text-slate-500 ml-0.5">{scenes.filter(s => s.chapterTag === ch).length}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
