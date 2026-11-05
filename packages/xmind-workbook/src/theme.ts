/**
 * Original sheet theme written when a sheet has none.
 * Property keys and role names are the ones measured on content.json themes.
 * Values are this project's palette and open fonts. NeverMind is never written.
 * skeletonThemeId and colorThemeId are omitted: those strings identify a foreign theme pack.
 */

const FONT = 'Inter, "Noto Sans SC", sans-serif';

function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (!cryptoApi?.randomUUID) throw new Error("crypto.randomUUID is not available");
  return cryptoApi.randomUUID();
}

function role(properties: Record<string, string>): { id: string; properties: Record<string, string> } {
  return { id: newId(), properties };
}

export function defaultSheetTheme(): Record<string, unknown> {
  return {
    map: role({
      "svg:fill": "#f7f4ee",
      "multi-line-colors": "#9a3412 #1d4e89 #1f6b4a #8a4b08 #5c3b73 #3f3f46",
      "line-tapered": "none",
    }),
    centralTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "22pt",
      "fo:font-weight": "600",
      "fo:font-style": "normal",
      "fo:color": "#f6f1e7",
      "fo:text-decoration": "none",
      "fo:text-align": "center",
      "svg:fill": "#24211c",
      "fill-pattern": "solid",
      "line-width": "2pt",
      "line-color": "#24211c",
      "line-pattern": "solid",
      "border-line-color": "#24211c",
      "border-line-width": "0pt",
      "border-line-pattern": "solid",
      "shape-class": "org.xmind.topicShape.roundedRect",
      "line-class": "org.xmind.branchConnection.curve",
      "arrow-end-class": "org.xmind.arrowShape.none",
    }),
    mainTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "15pt",
      "fo:font-weight": "500",
      "fo:font-style": "normal",
      "fo:color": "inherited",
      "fo:text-decoration": "none",
      "fo:text-align": "left",
      "svg:fill": "inherited",
      "fill-pattern": "solid",
      "line-width": "2pt",
      "line-color": "inherited",
      "line-pattern": "solid",
      "border-line-width": "0pt",
      "shape-class": "org.xmind.topicShape.roundedRect",
      "line-class": "org.xmind.branchConnection.curve",
      "arrow-end-class": "inherited",
    }),
    subTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "13pt",
      "fo:font-weight": "400",
      "fo:font-style": "normal",
      "fo:color": "inherited",
      "fo:text-decoration": "none",
      "fo:text-align": "left",
      "svg:fill": "inherited",
      "fill-pattern": "solid",
      "line-width": "1.5pt",
      "line-color": "inherited",
      "line-pattern": "solid",
      "border-line-width": "0pt",
      "shape-class": "org.xmind.topicShape.roundedRect",
      "line-class": "org.xmind.branchConnection.roundedElbow",
      "arrow-end-class": "inherited",
    }),
    floatingTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "13pt",
      "fo:font-weight": "500",
      "fo:font-style": "normal",
      "fo:color": "#241f1a",
      "fo:text-decoration": "none",
      "svg:fill": "#efe6d6",
      "fill-pattern": "solid",
      "line-width": "1.5pt",
      "line-color": "#c4b8a5",
      "line-pattern": "solid",
      "border-line-color": "#c4b8a5",
      "border-line-width": "1pt",
      "shape-class": "org.xmind.topicShape.roundedRect",
      "line-class": "org.xmind.branchConnection.roundedElbow",
    }),
    summaryTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "13pt",
      "fo:font-weight": "400",
      "fo:color": "#241f1a",
      "fo:text-decoration": "none",
      "svg:fill": "#241f1a",
      "fill-pattern": "none",
      "shape-class": "org.xmind.topicShape.roundedRect",
      "line-class": "org.xmind.branchConnection.roundedElbow",
    }),
    calloutTopic: role({
      "fo:font-family": FONT,
      "fo:font-size": "13pt",
      "fo:font-weight": "400",
      "fo:color": "#241f1a",
      "svg:fill": "#fffdf8",
      "fill-pattern": "solid",
      "border-line-color": "#d5cbbd",
      "border-line-width": "1pt",
      "shape-class": "org.xmind.topicShape.roundedRect",
    }),
    importantTopic: role({
      "svg:fill": "#7a2e0e",
      "fill-pattern": "solid",
      "border-line-color": "#7a2e0e",
    }),
    minorTopic: role({
      "svg:fill": "#8a6a2f",
      "fill-pattern": "solid",
      "border-line-color": "#8a6a2f",
    }),
    expiredTopic: role({
      "fo:text-decoration": "line-through",
      "fill-pattern": "none",
    }),
    boundary: role({
      "fo:font-family": FONT,
      "fo:font-size": "12pt",
      "fo:font-weight": "400",
      "fo:color": "#241f1a",
      "fo:text-align": "center",
      "svg:fill": "#241f1a",
      "fill-pattern": "none",
      "line-width": "2",
      "line-color": "#8a8175",
      "line-pattern": "dash",
      "shape-class": "org.xmind.boundaryShape.roundedRect",
    }),
    summary: role({
      "line-width": "2pt",
      "line-color": "#241f1a",
      "line-pattern": "solid",
      "shape-class": "org.xmind.summaryShape.round",
    }),
    relationship: role({
      "fo:font-family": FONT,
      "fo:font-size": "12pt",
      "fo:font-weight": "400",
      "fo:color": "#9a3412",
      "fo:text-align": "center",
      "line-width": "1.5",
      "line-color": "#9a3412",
      "line-pattern": "dash",
      "shape-class": "org.xmind.relationshipShape.curved",
      "arrow-begin-class": "org.xmind.arrowShape.none",
      "arrow-end-class": "org.xmind.arrowShape.triangle",
    }),
  };
}
