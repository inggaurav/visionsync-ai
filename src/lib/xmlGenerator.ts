import { Scene } from "../types";

export function generatePremiereXML(projectName: string, scenes: Scene[], videoFileName?: string): string {
  const frameRate = 30;
  const width = 1920;
  const height = 1080;

  const totalDurationSeconds = scenes.length > 0 ? Math.max(...scenes.map(s => s.endTime)) : 3600;
  const totalDurationFrames = Math.floor(totalDurationSeconds * frameRate);

  // FIX: Premiere Pro XML requires the <name> element, not <n>.
  // Using <n> is invalid and causes Premiere to fail to parse the XML.

  const imageFiles = scenes.map((scene, index) => {
    const fileName = `scene_${String(index + 1).padStart(3, '0')}.png`;
    return `
      <clip id="master-clip-${index}">
        <name>${fileName}</name>
        <duration>${totalDurationFrames}</duration>
        <rate>
          <timebase>${frameRate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <track>
              <clipitem id="master-clipitem-${index}">
                <name>${fileName}</name>
                <duration>${totalDurationFrames}</duration>
                <rate>
                  <timebase>${frameRate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <file id="file-${index}">
                  <name>${fileName}</name>
                  <pathurl>images/${fileName}</pathurl>
                  <rate>
                    <timebase>${frameRate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                  <media>
                    <video>
                      <samplecharacteristics>
                        <width>${width}</width>
                        <height>${height}</height>
                      </samplecharacteristics>
                    </video>
                  </media>
                </file>
              </clipitem>
            </track>
          </video>
        </media>
      </clip>
    `;
  }).join('\n');

  let videoFileDef = '';
  if (videoFileName) {
    videoFileDef = `
      <clip id="master-video">
        <name>${videoFileName}</name>
        <duration>${totalDurationFrames}</duration>
        <rate>
          <timebase>${frameRate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <track>
              <clipitem id="master-video-item">
                <name>${videoFileName}</name>
                <duration>${totalDurationFrames}</duration>
                <rate>
                  <timebase>${frameRate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <file id="file-video-bg">
                  <name>${videoFileName}</name>
                  <pathurl>${videoFileName}</pathurl>
                  <rate>
                    <timebase>${frameRate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                </file>
              </clipitem>
            </track>
          </video>
        </media>
      </clip>
    `;
  }

  // Background Video Track (Track 1)
  let videoTrack = '';
  if (videoFileName) {
    videoTrack = `
      <track>
        <clipitem id="bg-video-sequence-item">
          <name>${videoFileName}</name>
          <enabled>TRUE</enabled>
          <duration>${totalDurationFrames}</duration>
          <rate>
            <timebase>${frameRate}</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <start>0</start>
          <end>${totalDurationFrames}</end>
          <in>0</in>
          <out>${totalDurationFrames}</out>
          <file id="file-video-bg"/>
        </clipitem>
      </track>
    `;
  }

  // Image Track (Track 2)
  // FIX: Each <clipitem> needs a <masterclipid> referencing the master clip 
  //      so Premiere can properly link the file asset.
  const imageTrackItems = scenes.map((scene, index) => {
    const startFrame = Math.floor(scene.startTime * frameRate);
    const endFrame = Math.floor(scene.endTime * frameRate);
    const duration = Math.max(1, endFrame - startFrame);
    const fileName = `scene_${String(index + 1).padStart(3, '0')}.png`;

    return `
      <clipitem id="clipitem-${index}">
        <name>${fileName}</name>
        <enabled>TRUE</enabled>
        <duration>${totalDurationFrames}</duration>
        <rate>
          <timebase>${frameRate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <start>${startFrame}</start>
        <end>${endFrame}</end>
        <in>0</in>
        <out>${duration}</out>
        <masterclipid>master-clip-${index}</masterclipid>
        <file id="file-${index}"/>
        <labels>
          <label2>Iris</label2>
        </labels>
      </clipitem>
    `;
  }).join('\n');

  // FIX: The <project> element needs a <name> child, not <n>.
  // FIX: <sequence> also needs a proper <name> child.
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>${projectName}</name>
    <children>
      ${videoFileDef}
      ${imageFiles}
      <sequence id="sequence-1">
        <name>${projectName}_Sequence</name>
        <duration>${totalDurationFrames}</duration>
        <rate>
          <timebase>${frameRate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <width>${width}</width>
                <height>${height}</height>
                <rate>
                  <timebase>${frameRate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
              </samplecharacteristics>
            </format>
            ${videoTrack}
            <track>
              ${imageTrackItems}
            </track>
          </video>
          <audio/>
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`;
}
