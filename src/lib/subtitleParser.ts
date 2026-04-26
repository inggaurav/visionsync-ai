
import { SubtitleSegment } from '../types';

export function parseSubtitles(content: string, type: 'srt' | 'vtt'): SubtitleSegment[] {
  let segments: SubtitleSegment[] = [];
  if (type === 'vtt') {
    segments = parseVTT(content);
  } else {
    segments = parseSRT(content);
  }

  // Merge segments to avoid having too many scenes.
  // Goal: ~24 images per 30 minutes (1 image every ~75 seconds).
  return mergeSegments(segments, 75);
}

function mergeSegments(segments: SubtitleSegment[], targetDuration: number): SubtitleSegment[] {
  if (segments.length === 0) return [];

  const merged: SubtitleSegment[] = [];
  let currentGroup: SubtitleSegment[] = [];
  let currentStartTime = segments[0].startTime;
  let currentAccumulatedTime = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentDuration = segment.endTime - segment.startTime;
    
    currentGroup.push(segment);
    currentAccumulatedTime += segmentDuration;

    // Check if we should close the current group
    // We close if accumulated time in group exceeds targetDuration OR if there's a big gap
    const nextSegment = segments[i + 1];
    const isGapLarge = nextSegment ? (nextSegment.startTime - segment.endTime > 5) : false;

    if (currentAccumulatedTime >= targetDuration || isGapLarge || !nextSegment) {
      merged.push({
        id: `merged-${merged.length}`,
        startTime: currentStartTime,
        endTime: segment.endTime,
        text: currentGroup.map(s => s.text).join(' ').trim()
      });

      if (nextSegment) {
        currentGroup = [];
        currentStartTime = nextSegment.startTime;
        currentAccumulatedTime = 0;
      }
    }
  }

  return merged;
}

function timeToSeconds(timeStr: string): number {
  // Format: HH:MM:SS,ms or HH:MM:SS.ms
  const parts = timeStr.trim().replace(',', '.').split(':');
  let seconds = 0;
  if (parts.length === 3) {
    seconds += parseInt(parts[0], 10) * 3600;
    seconds += parseInt(parts[1], 10) * 60;
    seconds += parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds += parseInt(parts[0], 10) * 60;
    seconds += parseFloat(parts[1]);
  }
  return seconds;
}

function parseSRT(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const blocks = content.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length >= 3) {
      const times = lines[1].split(' --> ');
      if (times.length === 2) {
        segments.push({
          id: lines[0].trim(),
          startTime: timeToSeconds(times[0]),
          endTime: timeToSeconds(times[1]),
          text: lines.slice(2).join(' ').replace(/<[^>]*>/g, '').trim(),
        });
      }
    }
  }
  return segments;
}

function parseVTT(content: string): SubtitleSegment[] {
  // Very similar to SRT but might have 'WEBVTT' header
  const lines = content.replace('WEBVTT', '').trim().split(/\r?\n\r?\n/);
  const segments: SubtitleSegment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const block = lines[i].split(/\r?\n/);
    let timeLine = -1;
    for(let j=0; j<block.length; j++) {
      if(block[j].includes('-->')) {
        timeLine = j;
        break;
      }
    }

    if (timeLine !== -1) {
      const times = block[timeLine].split(' --> ');
      if (times.length === 2) {
        segments.push({
          id: `vtt-${i}`,
          startTime: timeToSeconds(times[0].split(' ')[0]), // Handle possible tags
          endTime: timeToSeconds(times[1].split(' ')[0]),
          text: block.slice(timeLine + 1).join(' ').replace(/<[^>]*>/g, '').trim(),
        });
      }
    }
  }
  return segments;
}
