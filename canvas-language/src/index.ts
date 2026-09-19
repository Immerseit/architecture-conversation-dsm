import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SOLUTION_DOMAIN_CANVAS, type SolutionDomainCanvas } from "./standards.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export type CanvasCode = SolutionDomainCanvas;

export function parseImageToCanvas(imageDescription: string): CanvasCode {
  const lower = imageDescription.toLowerCase();

  return {
    canvasType: "solution.domain.canvas",
    name: lower.includes("member") ? "Member Services Platform" : "Untitled Solution Domain",
    purpose: imageDescription || "No explicit purpose provided.",
    owner: "Architecture Team",
    business: {
      outcomes: "Derived from image description and repository context.",
      stakeholders: "Product owners, engineers, architects, users.",
      constraints: lower.includes("security") ? "Security and compliance constraints apply." : "No major constraints identified.",
    },
    data: {
      domainModel: "Domain entities inferred from the source image or document.",
      dataOwners: "Domain owner",
      dataClasses: "Operational and supporting data",
    },
    applications: [
      {
        name: "Core application",
        responsibility: "Main capability represented in the source artifact.",
      },
    ],
    technology: {
      platform: "Planned platform based on repository conventions",
      deploymentModel: "Containerized or service-based delivery",
      securityModel: "Enterprise identity, observability, and governance",
    },
    decisions: [
      {
        decision: "Initial canvas interpretation from image or source material",
        rationale: "This is the first machine-readable view of a conceptual architecture.",
      },
    ],
  };
}

export function describeCanvas(canvas: CanvasCode): string {
  const appNames = canvas.applications.map((a) => a.name).join(", ");
  return `The solution domain ${canvas.name} is intended to ${canvas.purpose}. It is owned by ${canvas.owner}. The business outcomes are ${canvas.business.outcomes}. Key application capabilities include ${appNames}.`;
}

export function generateMermaid(canvas: CanvasCode): string {
  const appRows = canvas.applications.map((app) => `  ${app.name}[${app.name}]`).join("\n");
  return `flowchart LR
  domain[${canvas.name}] --> business[Business]
  domain --> data[Data]
  domain --> apps[Applications]
  domain --> tech[Technology]
  business --> outcome[${canvas.business.outcomes}]
  data --> model[${canvas.data.domainModel}]
  apps -->\n${appRows}
  tech --> platform[${canvas.technology.platform}]
`;
}

export function getCanvasStandard() {
  return SOLUTION_DOMAIN_CANVAS;
}

export function loadExampleCanvas() {
  const path = join(__dirname, "..", "examples", "solution-domain.example.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as CanvasCode;
}

export type McpToolRequest = {
  tool: "getCanvasStandard" | "describeCanvas" | "generateMermaid";
  payload?: unknown;
};

export type McpToolResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export function handleMcpTool(request: McpToolRequest): McpToolResponse {
  switch (request.tool) {
    case "getCanvasStandard":
      return { ok: true, data: getCanvasStandard() };
    case "describeCanvas":
      if (!request.payload || typeof request.payload !== "object") {
        return { ok: false, error: "Canvas payload is required." };
      }
      return { ok: true, data: describeCanvas(request.payload as CanvasCode) };
    case "generateMermaid":
      if (!request.payload || typeof request.payload !== "object") {
        return { ok: false, error: "Canvas payload is required." };
      }
      return { ok: true, data: generateMermaid(request.payload as CanvasCode) };
    default:
      return { ok: false, error: "Unknown tool" };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exampleCanvas = loadExampleCanvas();
  const parsed = parseImageToCanvas("Member services platform with security, workflow, and policy decisions");

  console.log("Canvas standard:");
  console.log(JSON.stringify(getCanvasStandard(), null, 2));
  console.log("\nExample description:");
  console.log(describeCanvas(exampleCanvas));
  console.log("\nGenerated Mermaid:");
  console.log(generateMermaid(parsed));
}
