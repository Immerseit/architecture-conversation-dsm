import sql from "mssql";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { CanvasInstance, Matrix, Statement, StatementLink } from "./codl.js";

export interface Store {
  matrices: Matrix[];
  statements: Statement[];
  links: StatementLink[];
  canvasInstances: CanvasInstance[];
}

function emptyStore(): Store {
  return { matrices: [], statements: [], links: [], canvasInstances: [] };
}

function hashAccessKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function connectionConfig(database: string): sql.config {
  const connectionString =
    process.env.AZURE_SQL_CONNECTION_STRING
    ?? process.env.SQLCONNSTR_AZURE_SQL_CONNECTION_STRING
    ?? process.env.CUSTOMCONNSTR_AZURE_SQL_CONNECTION_STRING;
  if (!connectionString) throw new Error("AZURE_SQL_CONNECTION_STRING saknas (lägg in den i backend/.env eller App Service Configuration)");

  const values = new Map<string, string>();
  for (const part of connectionString.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }
  const server = values.get("data source") ?? values.get("server");
  const user = values.get("user id") ?? values.get("uid");
  const password = values.get("password") ?? values.get("pwd");
  if (!server || !user || !password) throw new Error("AZURE_SQL_CONNECTION_STRING saknar server, user eller password");
  if (user === "YOUR_USER" || password === "YOUR_PASSWORD") {
    throw new Error("AZURE_SQL_CONNECTION_STRING använder placeholder-värden. Uppdatera backend/.env med riktiga credentials.");
  }

  return {
    server,
    user,
    password,
    database,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    options: { encrypt: true, trustServerCertificate: false },
  };
}

let pool: sql.ConnectionPool;
let appStateIdIsIdentity = false;

export async function initializeDatabase(legacyDataFile: string): Promise<Store> {
  const databaseName = "dsm";
  // Azure SQL database creation is an administrative operation and commonly
  // fails for application users connected to the logical server. The database
  // must be created once in Azure; the application only connects to it.
  pool = await new sql.ConnectionPool(connectionConfig(databaseName)).connect();
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.AppState', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AppState (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppState PRIMARY KEY,
        AccessKey nvarchar(255) NOT NULL CONSTRAINT DF_AppState_AccessKey DEFAULT N'',
        JsonData nvarchar(max) NOT NULL,
        UpdatedAt datetime2 NOT NULL CONSTRAINT DF_AppState_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_AppState_AccessKey UNIQUE (AccessKey)
      );
    END
    ELSE IF COL_LENGTH(N'dbo.AppState', N'AccessKey') IS NULL
    BEGIN
      ALTER TABLE dbo.AppState ADD AccessKey nvarchar(255) NOT NULL CONSTRAINT DF_AppState_AccessKey DEFAULT N'';
    END`);
  const idMetadata = await pool.request().query(`
    SELECT COLUMNPROPERTY(OBJECT_ID(N'dbo.AppState'), N'Id', 'IsIdentity') AS IsIdentity`);
  appStateIdIsIdentity = idMetadata.recordset[0]?.IsIdentity === 1;
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_AppState_AccessKey' AND object_id = OBJECT_ID(N'dbo.AppState'))
      CREATE UNIQUE INDEX UQ_AppState_AccessKey ON dbo.AppState (AccessKey);`);

  const result = await pool.request().query("SELECT AccessKey, JsonData FROM dbo.AppState ORDER BY Id");
  if (result.recordset.length > 0) return mergeRows(result.recordset);

  let initial = emptyStore();
  if (fs.existsSync(legacyDataFile)) {
    initial = { ...emptyStore(), ...JSON.parse(fs.readFileSync(legacyDataFile, "utf8")) };
  }
  await saveStore(initial);
  return initial;
}

export async function saveStore(store: Store): Promise<void> {
  if (!pool) throw new Error("Databasen är inte initierad");
  const rows = new Map<string, Store>();
  for (const matrix of store.matrices) {
    const key = matrix.accessKey ?? matrix.accessKeyHash ?? "";
    const row = rows.get(key) ?? emptyStore();
    row.matrices.push(matrix);
    row.statements.push(...store.statements.filter((statement) => statement.matrixId === matrix.id));
    row.links.push(...store.links.filter((link) => link.matrixId === matrix.id));
    rows.set(key, row);
  }
  const openRow = rows.get("") ?? emptyStore();
  openRow.canvasInstances = store.canvasInstances;
  rows.set("", openRow);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).query("DELETE FROM dbo.AppState");
    let id = 1;
    for (const [accessKey, row] of rows) {
      // The key is deliberately stored in its own SQL column, not in JsonData.
      const jsonData = {
        ...row,
        matrices: row.matrices.map(({ accessKey: _key, accessKeyHash: _hash, ...matrix }) => matrix),
      };
      const request = new sql.Request(transaction)
        .input("accessKey", sql.NVarChar(255), accessKey)
        .input("jsonData", sql.NVarChar(sql.MAX), JSON.stringify(jsonData));
      if (appStateIdIsIdentity) {
        await request.query("INSERT INTO dbo.AppState (AccessKey, JsonData) VALUES (@accessKey, @jsonData)");
      } else {
        await request.input("id", sql.Int, id++)
          .query("INSERT INTO dbo.AppState (Id, AccessKey, JsonData) VALUES (@id, @accessKey, @jsonData)");
      }
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function mergeRows(rows: Array<{ AccessKey: string; JsonData: string }>): Store {
  const merged = emptyStore();
  for (const row of rows) {
    const parsed = { ...emptyStore(), ...JSON.parse(row.JsonData) } as Store;
    for (const matrix of parsed.matrices) {
      if (row.AccessKey) {
        matrix.accessKey = row.AccessKey;
        matrix.accessKeyHash = matrix.accessKeyHash ?? hashAccessKey(row.AccessKey);
      }
    }
    merged.matrices.push(...parsed.matrices);
    merged.statements.push(...parsed.statements);
    merged.links.push(...parsed.links);
    merged.canvasInstances.push(...parsed.canvasInstances);
  }
  return merged;
}
