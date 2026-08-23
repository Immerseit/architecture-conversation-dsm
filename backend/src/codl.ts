// DSM canvas-language definitions, written in the same CoDL convention used by
// Iasa Global's Loom platform (sections -> typed fields, cardinality, linksTo).
// This is what makes the matrix machine-readable and portable to other tools later
// (Archi/ArchiMate, Azure DevOps) instead of just a UI-only data shape.

export const dsmManifestDefinition = {
  codlVersion: "2",
  typeIri: "dsm.manifest",
  name: "DSM Manifest",
  sections: [
    {
      sectionKey: "manifest",
      name: "Manifest",
      description: "Free-text statement that scopes the whole architecture conversation",
      cardinality: "one",
      fields: [{ fieldKey: "value", label: "Manifest", type: "longtext", required: false }],
    },
    {
      sectionKey: "dimensions",
      name: "Dimensions",
      description: "The dynamic columns of the matrix, fixed for this manifest instance",
      cardinality: "many",
      fields: [
        { fieldKey: "key", label: "Key", type: "string", required: true },
        { fieldKey: "name", label: "Name", type: "string", required: true },
        { fieldKey: "description", label: "Description", type: "longtext", required: false },
      ],
    },
  ],
} as const;

export const dsmStatementDefinition = {
  codlVersion: "2",
  typeIri: "dsm.statement",
  name: "DSM Statement",
  sections: [
    {
      sectionKey: "coordinate",
      name: "Coordinate",
      description: "Position in the matrix: fixed level (N1-N4) x dimension key",
      cardinality: "one",
      fields: [
        { fieldKey: "level", label: "Level", type: "string", required: true, enum: ["N1", "N2", "N3", "N4"] },
        { fieldKey: "dimensionKey", label: "Dimension", type: "string", required: true },
      ],
    },
    {
      sectionKey: "content",
      name: "Content",
      description: "What is held in the conversation at this coordinate",
      cardinality: "one",
      fields: [{ fieldKey: "value", label: "Content", type: "longtext", required: false }],
    },
    {
      sectionKey: "tags",
      name: "Tags",
      description: "Freeform labels, e.g. 'Business Goal'",
      cardinality: "many",
      fields: [{ fieldKey: "value", label: "Tag", type: "string", required: false }],
    },
    {
      sectionKey: "links",
      name: "Links",
      description: "Decision-chain connections to other statements",
      cardinality: "many",
      fields: [
        {
          fieldKey: "value",
          label: "Related statement",
          type: "string",
          required: false,
          referencedCanvas: "dsm.statement",
          referencedCanvasName: "DSM Statement",
        },
      ],
    },
  ],
  linksTo: [{ fromSection: "links", fromField: "value", targetType: "dsm.statement", verb: "relates_to", verbSource: "provisional" }],
} as const;

export const DEFAULT_DIMENSIONS: Dimension[] = [
  { key: "business", name: "Business", description: "Why the business exists, what it does, and how it is realized." },
  { key: "information", name: "Information", description: "Management of data and security of information." },
  { key: "application", name: "Application", description: "Software structure, behaviour and usage." },
  { key: "technology", name: "Technology", description: "Such as platform, network, server and equipment." },
];

export interface Dimension {
  key: string;
  name: string;
  description: string;
}

export type Level = "N1" | "N2" | "N3" | "N4";

export interface Matrix {
  id: string;
  name: string;
  manifest: string;
  dimensions: Dimension[];
  createdAt: string;
}

export interface Statement {
  id: string;
  matrixId: string;
  level: Level;
  dimensionKey: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface StatementLink {
  id: string;
  matrixId: string;
  fromStatementId: string;
  toStatementId: string;
  verb: string;
}

export interface CanvasInstance {
  id: string;
  typeKey: string;
  name: string;
  // sectionKey -> (single value object for cardinality "one", array of value objects for "many")
  values: Record<string, Record<string, unknown> | Record<string, unknown>[]>;
  createdAt: string;
}
