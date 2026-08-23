import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_DIMENSIONS,
  dsmManifestDefinition,
  dsmStatementDefinition,
  type Matrix,
  type Statement,
  type StatementLink,
  type CanvasInstance,
} from "./codl.js";
import { canvasDefinitions } from "./canvasDefinitions.js";

interface Store {
  matrices: Matrix[];
  statements: Statement[];
  links: StatementLink[];
  canvasInstances: CanvasInstance[];
}

const dataFile = path.join(process.cwd(), "data.json");

function loadStore(): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    return { canvasInstances: [], ...parsed };
  } catch {
    return { matrices: [], statements: [], links: [], canvasInstances: [] };
  }
}

function saveStore() {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

const store: Store = loadStore();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/codl", (_req, res) => {
  res.json({ dsmManifestDefinition, dsmStatementDefinition });
});

app.get("/api/canvas-types", (_req, res) => {
  res.json(
    Object.entries(canvasDefinitions).map(([key, def]) => ({ key, name: def.name, sectionCount: def.sections.length })),
  );
});

app.get("/api/canvas-types/:key", (req, res) => {
  const def = canvasDefinitions[req.params.key];
  if (!def) {
    res.status(404).json({ error: "okänd canvas-typ" });
    return;
  }
  res.json(def);
});

app.get("/api/canvas-instances", (req, res) => {
  const typeKey = req.query.typeKey;
  const instances = typeKey ? store.canvasInstances.filter((c) => c.typeKey === typeKey) : store.canvasInstances;
  res.json(instances);
});

app.post("/api/canvas-instances", (req, res) => {
  const typeKey = String(req.body?.typeKey ?? "");
  if (!canvasDefinitions[typeKey]) {
    res.status(400).json({ error: "okänd canvas-typ" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name krävs" });
    return;
  }
  const instance: CanvasInstance = {
    id: crypto.randomUUID(),
    typeKey,
    name,
    values: req.body?.values ?? {},
    createdAt: new Date().toISOString(),
  };
  store.canvasInstances.push(instance);
  saveStore();
  res.status(201).json(instance);
});

app.get("/api/canvas-instances/:id", (req, res) => {
  const instance = store.canvasInstances.find((c) => c.id === req.params.id);
  if (!instance) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  res.json(instance);
});

app.patch("/api/canvas-instances/:id", (req, res) => {
  const instance = store.canvasInstances.find((c) => c.id === req.params.id);
  if (!instance) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  if (typeof req.body?.name === "string") instance.name = req.body.name;
  if (req.body?.values) instance.values = req.body.values;
  saveStore();
  res.json(instance);
});

app.delete("/api/canvas-instances/:id", (req, res) => {
  const index = store.canvasInstances.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  store.canvasInstances.splice(index, 1);
  saveStore();
  res.status(204).end();
});

app.get("/api/matrices", (_req, res) => {
  res.json(store.matrices);
});

app.post("/api/matrices", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name krävs" });
    return;
  }
  const matrix: Matrix = {
    id: crypto.randomUUID(),
    name,
    manifest: String(req.body?.manifest ?? ""),
    dimensions: DEFAULT_DIMENSIONS,
    createdAt: new Date().toISOString(),
  };
  store.matrices.push(matrix);
  saveStore();
  res.status(201).json(matrix);
});

app.get("/api/matrices/:id", (req, res) => {
  const matrix = store.matrices.find((m) => m.id === req.params.id);
  if (!matrix) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  const statements = store.statements.filter((s) => s.matrixId === matrix.id);
  const links = store.links.filter((l) => l.matrixId === matrix.id);
  res.json({ ...matrix, statements, links });
});

app.patch("/api/matrices/:id", (req, res) => {
  const matrix = store.matrices.find((m) => m.id === req.params.id);
  if (!matrix) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  if (typeof req.body?.manifest === "string") matrix.manifest = req.body.manifest;
  if (Array.isArray(req.body?.dimensions)) matrix.dimensions = req.body.dimensions;
  saveStore();
  res.json(matrix);
});

app.delete("/api/matrices/:id", (req, res) => {
  const index = store.matrices.findIndex((m) => m.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  store.matrices.splice(index, 1);
  store.statements = store.statements.filter((s) => s.matrixId !== req.params.id);
  store.links = store.links.filter((l) => l.matrixId !== req.params.id);
  saveStore();
  res.status(204).end();
});

app.post("/api/matrices/:id/statements", (req, res) => {
  const matrix = store.matrices.find((m) => m.id === req.params.id);
  if (!matrix) {
    res.status(404).json({ error: "matris hittades inte" });
    return;
  }
  const level = req.body?.level;
  const dimensionKey = req.body?.dimensionKey;
  if (!["N1", "N2", "N3", "N4"].includes(level)) {
    res.status(400).json({ error: "level måste vara N1-N4" });
    return;
  }
  if (!matrix.dimensions.some((d) => d.key === dimensionKey)) {
    res.status(400).json({ error: "okänd dimension" });
    return;
  }
  const statement: Statement = {
    id: crypto.randomUUID(),
    matrixId: matrix.id,
    level,
    dimensionKey,
    content: String(req.body?.content ?? ""),
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [],
    createdAt: new Date().toISOString(),
  };
  store.statements.push(statement);
  saveStore();
  res.status(201).json(statement);
});

app.patch("/api/statements/:id", (req, res) => {
  const statement = store.statements.find((s) => s.id === req.params.id);
  if (!statement) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  if (typeof req.body?.content === "string") statement.content = req.body.content;
  if (Array.isArray(req.body?.tags)) statement.tags = req.body.tags.map(String);
  saveStore();
  res.json(statement);
});

app.delete("/api/statements/:id", (req, res) => {
  const index = store.statements.findIndex((s) => s.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  store.statements.splice(index, 1);
  store.links = store.links.filter((l) => l.fromStatementId !== req.params.id && l.toStatementId !== req.params.id);
  saveStore();
  res.status(204).end();
});

app.post("/api/matrices/:id/links", (req, res) => {
  const matrix = store.matrices.find((m) => m.id === req.params.id);
  if (!matrix) {
    res.status(404).json({ error: "matris hittades inte" });
    return;
  }
  const { fromStatementId, toStatementId } = req.body ?? {};
  const validIds = new Set(store.statements.filter((s) => s.matrixId === matrix.id).map((s) => s.id));
  if (!validIds.has(fromStatementId) || !validIds.has(toStatementId)) {
    res.status(400).json({ error: "ogiltiga statement-id:n" });
    return;
  }
  const link: StatementLink = {
    id: crypto.randomUUID(),
    matrixId: matrix.id,
    fromStatementId,
    toStatementId,
    verb: String(req.body?.verb ?? "relates_to"),
  };
  store.links.push(link);
  saveStore();
  res.status(201).json(link);
});

app.delete("/api/links/:id", (req, res) => {
  const index = store.links.findIndex((l) => l.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  store.links.splice(index, 1);
  saveStore();
  res.status(204).end();
});

const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

const port = process.env.PORT ? Number(process.env.PORT) : 3002;
app.listen(port, () => {
  console.log(`DSM-backend körs på http://localhost:${port}`);
});
