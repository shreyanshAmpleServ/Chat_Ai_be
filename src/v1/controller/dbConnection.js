// controller/dbQueryPostRaw.js
"use strict";

module.exports = async function dbQueryPostRawController(req, res) {
  const started = Date.now();

  const getDefaultPort = (kind) => {
    switch ((kind || "").toLowerCase()) {
      case "postgres":
      case "postgresql":
        return 5432;
      case "mysql":
        return 3306;
      case "mssql":
      case "sqlserver":
        return 1433;
      default:
        return undefined;
    }
  };

  const normalizeKind = (k) =>
    (k || "")
      .toLowerCase()
      .replace("postgresql", "postgres")
      .replace("sqlserver", "mssql");

  const coerceBool = (v, fallback = false) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string")
      return ["1", "true", "yes", "on"].includes(v.toLowerCase());
    if (typeof v === "number") return v === 1;
    return fallback;
  };

  const pickDbConfig = (req) => {
    const b = req.body || {};
    const db = b.db || req.dbConfig || b;

    return {
      kind: normalizeKind(db.kind),
      host: db.host || db.server || "localhost",
      port: Number(db.port) || getDefaultPort(db.kind),
      user: db.user || db.username,
      password: db.password,
      database: db.database || db.db,
      ssl: coerceBool(db.ssl, false),
      encrypt: db.encrypt !== undefined ? coerceBool(db.encrypt) : undefined,
      trustServerCertificate:
        db.trustServerCertificate !== undefined
          ? coerceBool(db.trustServerCertificate)
          : undefined,
      enableArithAbort:
        db.enableArithAbort !== undefined
          ? coerceBool(db.enableArithAbort)
          : undefined,
      options: db.options,
      pool: db.pool,
      connectionTimeoutMillis: db.connectionTimeoutMillis || db.connectTimeout,
      statement_timeout: db.statement_timeout,
      idleTimeoutMillis: db.idleTimeoutMillis,
      max: db.max,
      min: db.min,
    };
  };

  try {
    const { sql } = req.body || {};
    const cfg = pickDbConfig(req);

    if (!sql || typeof sql !== "string" || !sql.trim()) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid body.sql",
        elapsedMs: Date.now() - started,
      });
    }

    if (!cfg.kind) {
      return res.status(400).json({
        success: false,
        error: "Database kind is required (db.kind)",
        elapsedMs: Date.now() - started,
      });
    }

    if (!cfg.host || !cfg.user || !cfg.password) {
      return res.status(400).json({
        success: false,
        error:
          "Database credentials incomplete: host, user/username, password are required",
        elapsedMs: Date.now() - started,
      });
    }

    // OPTIONAL: Only allow SELECT statements to limit risk.
    // Remove or change this check if you intentionally want to allow writes.
    const onlySelect = req.body.onlySelect !== false; // default true
    if (onlySelect) {
      const cleaned = sql.trim().toLowerCase();
      // allow statements that begin with "select" or "with" (common for CTEs)
      if (!(cleaned.startsWith("select") || cleaned.startsWith("with"))) {
        return res.status(403).json({
          success: false,
          error:
            "Only read-only SELECT/CTE queries are allowed on this endpoint",
          elapsedMs: Date.now() - started,
        });
      }
    }

    let rows = [];
    let rowCount = 0;

    if (cfg.kind === "postgres") {
      const { Client } = require("pg");
      const client = new Client({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
        statement_timeout: cfg.statement_timeout || 30000,
        connectionTimeoutMillis: cfg.connectionTimeoutMillis || 10000,
      });

      try {
        await client.connect();
        const r = await client.query(sql);
        rows = r.rows || [];
        rowCount = typeof r.rowCount === "number" ? r.rowCount : rows.length;
      } finally {
        await client.end().catch(() => {});
      }
    } else if (cfg.kind === "mysql") {
      const mysql = require("mysql2/promise");
      const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        ssl: cfg.ssl ? {} : undefined,
        connectTimeout: cfg.connectionTimeoutMillis || 10000,
      });

      try {
        const [resRows] = await conn.query(sql);
        rows = Array.isArray(resRows) ? resRows : [];
        rowCount = rows.length;
      } finally {
        await conn.end().catch(() => {});
      }
    } else if (cfg.kind === "mssql") {
      let mssql;
      try {
        mssql = require("mssql");
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: "MSSQL driver not installed. Run: npm i mssql",
          elapsedMs: Date.now() - started,
        });
      }

      const pool = new mssql.ConnectionPool({
        server: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        options: {
          encrypt: cfg.encrypt ?? false,
          trustServerCertificate: cfg.trustServerCertificate ?? true,
          enableArithAbort: cfg.enableArithAbort ?? true,
          ...cfg.options,
        },
        pool: {
          max: cfg.max || 10,
          min: cfg.min || 0,
          idleTimeoutMillis: cfg.idleTimeoutMillis || 30000,
          ...cfg.pool,
        },
      });

      try {
        const connected = await pool.connect();
        const request = connected.request();
        const result = await request.query(sql);
        rows = result.recordset || [];
        rowCount =
          typeof result.rowsAffected?.[0] === "number"
            ? result.rowsAffected[0]
            : rows.length;
      } finally {
        await pool.close().catch(() => {});
      }
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported database kind: ${cfg.kind}`,
        elapsedMs: Date.now() - started,
      });
    }

    return res.status(200).json({
      success: true,
      rows,
      rowCount,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    console.error("POST /query (raw) error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Internal Server Error",
      elapsedMs: Date.now() - started,
    });
  }
};
