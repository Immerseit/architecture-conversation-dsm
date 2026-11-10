import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
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
import { initializeDatabase, saveStore, type Store } from "./database.js";

let store: Store;

function hashAccessKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function suppliedAccessKey(req: express.Request): string {
  const value = req.query.key ?? req.body?.key;
  return typeof value === "string" ? value.trim() : "";
}

function canAccessMatrix(matrix: Matrix, key: string): boolean {
  return !matrix.accessKeyHash || (!!key && (matrix.accessKey === key || hashAccessKey(key) === matrix.accessKeyHash));
}

function publicMatrix(matrix: Matrix): Omit<Matrix, "accessKeyHash" | "accessKey"> & { isProtected: boolean } {
  const { accessKeyHash: _accessKeyHash, accessKey: _accessKey, ...safeMatrix } = matrix;
  return { ...safeMatrix, isProtected: Boolean(matrix.accessKeyHash) };
}

function findAuthorizedMatrix(req: express.Request, res: express.Response): Matrix | undefined {
  const matrix = store.matrices.find((m) => m.id === req.params.id);
  if (!matrix) {
    res.status(404).json({ error: "hittades inte" });
    return undefined;
  }
  if (!canAccessMatrix(matrix, suppliedAccessKey(req))) {
    res.status(403).json({ error: "rätt nyckel krävs" });
    return undefined;
  }
  return matrix;
}

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

app.post("/api/canvas-instances", async (req, res) => {
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
    id: randomUUID(),
    typeKey,
    name,
    values: req.body?.values ?? {},
    createdAt: new Date().toISOString(),
  };
  store.canvasInstances.push(instance);
  await saveStore(store);
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

app.patch("/api/canvas-instances/:id", async (req, res) => {
  const instance = store.canvasInstances.find((c) => c.id === req.params.id);
  if (!instance) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  if (typeof req.body?.name === "string") instance.name = req.body.name;
  if (req.body?.values) instance.values = req.body.values;
  await saveStore(store);
  res.json(instance);
});

app.delete("/api/canvas-instances/:id", async (req, res) => {
  const index = store.canvasInstances.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  store.canvasInstances.splice(index, 1);
  await saveStore(store);
  res.status(204).end();
});

app.get("/api/matrices", (req, res) => {
  const key = suppliedAccessKey(req);
  res.json(store.matrices.filter((matrix) => canAccessMatrix(matrix, key)).map(publicMatrix));
});

app.post("/api/matrices", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name krävs" });
    return;
  }
  const accessKey = String(req.body?.key ?? "").trim();
  const matrix: Matrix = {
    id: randomUUID(),
    name,
    manifest: String(req.body?.manifest ?? ""),
    dimensions: DEFAULT_DIMENSIONS,
    createdAt: new Date().toISOString(),
    ...(accessKey ? { accessKey, accessKeyHash: hashAccessKey(accessKey) } : {}),
  };
  store.matrices.push(matrix);
  await saveStore(store);
  res.status(201).json(publicMatrix(matrix));
});

app.get("/api/matrices/:id", (req, res) => {
  const matrix = findAuthorizedMatrix(req, res);
  if (!matrix) return;
  const statements = store.statements.filter((s) => s.matrixId === matrix.id);
  const links = store.links.filter((l) => l.matrixId === matrix.id);
  res.json({ ...publicMatrix(matrix), statements, links });
});

app.patch("/api/matrices/:id", async (req, res) => {
  const matrix = findAuthorizedMatrix(req, res);
  if (!matrix) return;
  if (typeof req.body?.manifest === "string") matrix.manifest = req.body.manifest;
  if (Array.isArray(req.body?.dimensions)) {
    const dimensions = req.body.dimensions.filter(
      (dimension: unknown): dimension is { key: string; name: string; description?: string } =>
        !!dimension && typeof dimension === "object" &&
        typeof (dimension as { key?: unknown }).key === "string" &&
        typeof (dimension as { name?: unknown }).name === "string",
    );
    const dimensionKeys = new Set(dimensions.map((dimension) => dimension.key));
    matrix.dimensions = dimensions.map((dimension) => ({
      key: dimension.key,
      name: dimension.name.trim() || "Ny kolumn",
      description: typeof dimension.description === "string" ? dimension.description : "",
    }));
    const removedStatementIds = new Set(
      store.statements
        .filter((statement) => statement.matrixId === matrix.id && !dimensionKeys.has(statement.dimensionKey))
        .map((statement) => statement.id),
    );
    store.statements = store.statements.filter((statement) => !removedStatementIds.has(statement.id));
    store.links = store.links.filter(
      (link) => !removedStatementIds.has(link.fromStatementId) && !removedStatementIds.has(link.toStatementId),
    );
  }
  await saveStore(store);
  res.json(publicMatrix(matrix));
});

app.delete("/api/matrices/:id", async (req, res) => {
  const matrix = findAuthorizedMatrix(req, res);
  if (!matrix) return;
  store.matrices = store.matrices.filter((m) => m.id !== matrix.id);
  store.statements = store.statements.filter((s) => s.matrixId !== matrix.id);
  store.links = store.links.filter((l) => l.matrixId !== matrix.id);
  await saveStore(store);
  res.status(204).end();
});

app.post("/api/matrices/:id/statements", async (req, res) => {
  const matrix = findAuthorizedMatrix(req, res);
  if (!matrix) return;
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
    id: randomUUID(),
    matrixId: matrix.id,
    level,
    dimensionKey,
    content: String(req.body?.content ?? ""),
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [],
    createdAt: new Date().toISOString(),
  };
  store.statements.push(statement);
  await saveStore(store);
  res.status(201).json(statement);
});

app.patch("/api/statements/:id", async (req, res) => {
  const statement = store.statements.find((s) => s.id === req.params.id);
  if (!statement) {
    res.status(404).json({ error: "påstående hittades inte" });
    return;
  }
  const matrix = store.matrices.find((m) => m.id === statement.matrixId);
  if (!matrix || !canAccessMatrix(matrix, suppliedAccessKey(req))) {
    res.status(403).json({ error: "rätt nyckel krävs" });
    return;
  }
  if (typeof req.body?.content === "string") {
    const content = req.body.content.trim();
    if (!content) {
      res.status(400).json({ error: "content krävs" });
      return;
    }
    statement.content = content;
  }
  if (Array.isArray(req.body?.tags)) statement.tags = req.body.tags.map(String);
  await saveStore(store);
  res.json(statement);
});

app.delete("/api/statements/:id", async (req, res) => {
  const statement = store.statements.find((s) => s.id === req.params.id);
  if (!statement) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  const matrix = store.matrices.find((m) => m.id === statement.matrixId);
  if (!matrix || !canAccessMatrix(matrix, suppliedAccessKey(req))) {
    res.status(403).json({ error: "rätt nyckel krävs" });
    return;
  }
  store.statements = store.statements.filter((s) => s.id !== req.params.id);
  store.links = store.links.filter((l) => l.fromStatementId !== req.params.id && l.toStatementId !== req.params.id);
  await saveStore(store);
  res.status(204).end();
});

app.post("/api/matrices/:id/links", async (req, res) => {
  const matrix = findAuthorizedMatrix(req, res);
  if (!matrix) return;
  const { fromStatementId, toStatementId } = req.body ?? {};
  const validIds = new Set(store.statements.filter((s) => s.matrixId === matrix.id).map((s) => s.id));
  if (!validIds.has(fromStatementId) || !validIds.has(toStatementId)) {
    res.status(400).json({ error: "ogiltiga statement-id:n" });
    return;
  }
  const link: StatementLink = {
    id: randomUUID(),
    matrixId: matrix.id,
    fromStatementId,
    toStatementId,
    verb: String(req.body?.verb ?? "relates_to"),
  };
  store.links.push(link);
  await saveStore(store);
  res.status(201).json(link);
});

app.delete("/api/links/:id", async (req, res) => {
  const link = store.links.find((l) => l.id === req.params.id);
  if (!link) {
    res.status(404).json({ error: "hittades inte" });
    return;
  }
  const matrix = store.matrices.find((m) => m.id === link.matrixId);
  if (!matrix || !canAccessMatrix(matrix, suppliedAccessKey(req))) {
    res.status(403).json({ error: "rätt nyckel krävs" });
    return;
  }
  store.links = store.links.filter((l) => l.id !== req.params.id);
  await saveStore(store);
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
initializeDatabase(path.join(process.cwd(), "data.json"))
  .then((loadedStore) => {
    store = loadedStore;
    app.listen(port, () => {
      console.log(`DSM-backend körs på http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Kunde inte initiera Azure SQL-databasen:", error);
    process.exitCode = 1;
  });
