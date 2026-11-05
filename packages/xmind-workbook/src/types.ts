/**
 * Shapes cited by the XMind format map (Zen / 2020+ content.json).
 * JSON keys outside these fields are kept on the objects and written back.
 */

export interface ZipMember {
  name: string;
  data: Uint8Array;
}

export interface Marker {
  markerId: string;
  groupId?: string;
}

export interface NoteContent {
  content?: string;
}

/** Official SDK notes use html.content.paragraphs/spans plus ops.insert. */
export interface NoteHtml {
  content?: {
    paragraphs?: Array<{ spans?: Array<{ text?: string }> }>;
  };
}

export interface NoteOps {
  ops?: Array<{ insert?: string }>;
}

export interface Notes {
  plain?: NoteContent;
  realHTML?: NoteContent;
  html?: NoteHtml;
  ops?: NoteOps;
}

export interface Style {
  id?: string;
  type?: string;
  properties?: Record<string, string>;
}

export interface TopicImage {
  src?: string;
  width?: number;
  height?: number;
  align?: string;
}

export interface Boundary {
  id?: string;
  range?: string;
  title?: string;
}

export interface Summary {
  id?: string;
  range?: string;
  topicId?: string;
}

export interface Position {
  x?: number;
  y?: number;
}

export interface Extension {
  provider?: string;
  content?: unknown;
}

export interface TopicChildren {
  attached?: Topic[];
  detached?: Topic[];
  summary?: Topic[];
  callout?: Topic[];
}

export interface Topic {
  id?: string;
  class?: string;
  title?: string;
  titleUnedited?: boolean;
  structureClass?: string;
  children?: TopicChildren;
  labels?: string[];
  markers?: Marker[];
  notes?: Notes;
  href?: string;
  image?: TopicImage;
  boundaries?: Boundary[];
  summaries?: Summary[];
  position?: Position;
  style?: Style;
  branch?: string;
  extensions?: Extension[];
  attributedTitle?: unknown[];
  numbering?: Record<string, unknown>;
}

export interface Relationship {
  id?: string;
  end1Id?: string;
  end2Id?: string;
  title?: string;
  controlPoints?: Record<string, { x?: number; y?: number }>;
  style?: Style;
  class?: string;
}

export interface Sheet {
  id?: string;
  class?: string;
  title?: string;
  rootTopic: Topic;
  revisionId?: string;
  relationships?: Relationship[];
  theme?: Record<string, unknown>;
  extensions?: Extension[];
  topicOverlapping?: string;
  topicPositioning?: string;
  style?: Style;
  legend?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface Metadata {
  dataStructureVersion?: string;
  creator?: { name?: string; version?: string };
  layoutEngineVersion?: string;
  activeSheetId?: string;
  created?: unknown;
}

/** Empty objects and `{ "media-type": "..." }` both appear in the wild. */
export interface ManifestEntry {
  "media-type"?: string;
}

export interface Manifest {
  "file-entries"?: Record<string, ManifestEntry>;
}

export interface Workbook {
  sheets: Sheet[];
  metadata?: Metadata;
  manifest?: Manifest;
  /** Members other than content.json, content.xml, metadata.json, and manifest.json. */
  extras?: ZipMember[];
  /** Which package member supplied the map. */
  source?: "content.json" | "content.xml";
}
