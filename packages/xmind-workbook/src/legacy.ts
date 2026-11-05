import type { Marker, Relationship, Sheet, Topic, TopicChildren } from "./types.js";
import { innerText, parseXml, type XmlElement } from "./xml.js";

const CHILD_KEYS = ["attached", "detached", "summary", "callout"] as const;
type ChildKey = (typeof CHILD_KEYS)[number];

function isChildKey(value: string): value is ChildKey {
  return (CHILD_KEYS as readonly string[]).includes(value);
}

function textOf(el: XmlElement, name: string): string | undefined {
  const child = el.children.find((candidate) => candidate.name === name);
  if (!child) return undefined;
  return innerText(child).trim();
}

function xmlTopic(el: XmlElement): Topic {
  const topic: Topic = {
    id: el.attrs.id ?? "",
    title: textOf(el, "title") ?? "",
  };
  const structure = el.attrs["structure-class"];
  if (structure) topic.structureClass = structure;
  if (el.attrs.href) topic.href = el.attrs.href;

  const childrenEl = el.children.find((child) => child.name === "children");
  if (childrenEl) {
    const children: TopicChildren = {};
    for (const group of childrenEl.children) {
      if (group.name !== "topics") continue;
      const type = group.attrs.type ?? "";
      if (!isChildKey(type)) continue;
      const topics = group.children.filter((child) => child.name === "topic").map(xmlTopic);
      const existing = children[type] ?? [];
      children[type] = existing.concat(topics);
    }
    if (CHILD_KEYS.some((key) => children[key]?.length)) topic.children = children;
  }

  const labelsEl = el.children.find((child) => child.name === "labels");
  if (labelsEl) {
    const labels = labelsEl.children
      .filter((child) => child.name === "label")
      .map((child) => innerText(child).trim())
      .filter((label) => label.length > 0);
    if (labels.length > 0) topic.labels = labels;
  }

  const markersEl = el.children.find((child) => child.name === "marker-refs");
  if (markersEl) {
    const markers: Marker[] = [];
    for (const child of markersEl.children) {
      if (child.name !== "marker-ref") continue;
      const markerId = child.attrs["marker-id"] ?? "";
      if (!markerId) continue;
      markers.push({ markerId });
    }
    if (markers.length > 0) topic.markers = markers;
  }

  const notesEl = el.children.find((child) => child.name === "notes");
  if (notesEl) {
    const plain = notesEl.children.find((child) => child.name === "plain");
    const content = plain ? innerText(plain).trim() : "";
    if (content) topic.notes = { plain: { content } };
  }

  const position = el.children.find((child) => child.name === "position");
  if (position) {
    const x = Number(position.attrs.x);
    const y = Number(position.attrs.y);
    if (Number.isFinite(x) && Number.isFinite(y)) topic.position = { x, y };
  }

  return topic;
}

function xmlRelationships(el: XmlElement): Relationship[] {
  const group = el.children.find((child) => child.name === "relationships");
  if (!group) return [];
  const relationships: Relationship[] = [];
  for (const child of group.children) {
    if (child.name !== "relationship") continue;
    const relationship: Relationship = {
      id: child.attrs.id ?? "",
      end1Id: child.attrs.end1 ?? child.attrs.end1Id ?? "",
      end2Id: child.attrs.end2 ?? child.attrs.end2Id ?? "",
    };
    const title = textOf(child, "title");
    if (title) relationship.title = title;
    relationships.push(relationship);
  }
  return relationships;
}

function xmlSheet(el: XmlElement): Sheet {
  const topicEl = el.children.find((child) => child.name === "topic");
  if (!topicEl) throw new Error("legacy sheet is missing a root topic");
  const sheet: Sheet = {
    id: el.attrs.id ?? "",
    title: textOf(el, "title") ?? "",
    rootTopic: xmlTopic(topicEl),
  };
  const relationships = xmlRelationships(el);
  if (relationships.length > 0) sheet.relationships = relationships;
  return sheet;
}

/** Legacy XMind 3–8 content.xml (xmap-content). Not used when content.json exists. */
export function sheetsFromContentXml(xml: string): Sheet[] {
  let root: XmlElement;
  try {
    root = parseXml(xml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid content.xml: ${message}`);
  }
  const sheetEls = root.name === "sheet" ? [root] : root.children.filter((child) => child.name === "sheet");
  if (sheetEls.length === 0) throw new Error("content.xml has no sheets");
  return sheetEls.map(xmlSheet);
}
