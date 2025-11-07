// controllers/connection.controller.js
"use strict";

/**
 * Connection Controller
 * - Supports testing direct DB credentials sent in the request body
 * - (Optional) Can support connectionId lookup if you pass a fetcher
 *
 * Usage:
 *   const controller = createConnectionController({ connectionManager, fetchConnectionById });
 *   router.post('/connections/test', controller.testConnection);
 */

function createConnectionController({
  connectionManager,
  fetchConnectionById,
} = {}) {
  if (
    !connectionManager ||
    typeof connectionManager.testConnection !== "function"
  ) {
    throw new Error(
      "connectionManager with testConnection(kind, config) is required"
    );
  }

  // --- helpers ---------------------------------------------------------------

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

  const coerceBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string")
      return ["1", "true", "yes", "on"].includes(v.toLowerCase());
    if (typeof v === "number") return v === 1;
    return false;
  };

  const mask = (value, keep = 2) => {
    if (!value) return value;
    const s = String(value);
    if (s.length <= keep) return "*".repeat(s.length);
    return s.slice(0, keep) + "*".repeat(s.length - keep);
  };

  const normalizeKind = (k) =>
    (k || "").toLowerCase().replace("sqlserver", "mssql");

  // --- controller ------------------------------------------------------------

  const testConnection = async (req, res) => {
    const started = Date.now();
    try {
      // Extract inputs
      let {
        connectionId,
        kind,
        host,
        port,
        username,
        password,
        database,
        ssl,
        // mssql-only extras (optional)
        encrypt,
        trustServerCertificate,
        enableArithAbort,
      } = req.body || {};

      kind = normalizeKind(kind);

      // If a connectionId is provided and you supplied a fetcher, hydrate from store
      let connectionConfig;
      if (connectionId && typeof fetchConnectionById === "function") {
        const saved = await fetchConnectionById(connectionId);
        if (!saved) {
          return res.status(404).json({
            success: false,
            error: `No saved connection found for id: ${connectionId}`,
            elapsedMs: Date.now() - started,
          });
        }
        connectionConfig = {
          kind: normalizeKind(saved.kind),
          host: saved.host,
          port: saved.port || getDefaultPort(saved.kind),
          username: saved.username || saved.user,
          password: saved.password,
          database: saved.database || saved.db,
          ssl: coerceBool(saved.ssl),
          encrypt: saved.encrypt,
          trustServerCertificate: saved.trustServerCertificate,
          enableArithAbort: saved.enableArithAbort,
          options: saved.options,
          pool: saved.pool,
        };
      } else {
        // Direct credentials path (no lookup)
        if (!kind) {
          return res.status(400).json({
            success: false,
            error: 'Either connectionId or database type "kind" is required',
            elapsedMs: Date.now() - started,
          });
        }
        connectionConfig = {
          kind,
          host: host || "localhost",
          port: port || getDefaultPort(kind),
          username,
          password,
          database,
          ssl: coerceBool(ssl),
          encrypt:
            typeof encrypt === "undefined" ? undefined : coerceBool(encrypt),
          trustServerCertificate:
            typeof trustServerCertificate === "undefined"
              ? undefined
              : coerceBool(trustServerCertificate),
          enableArithAbort:
            typeof enableArithAbort === "undefined"
              ? undefined
              : coerceBool(enableArithAbort),
        };
      }

      // Minimal validation
      const required = ["kind", "host", "username", "password"];
      const missing = required.filter((k) => !connectionConfig[k]);
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(", ")}`,
          elapsedMs: Date.now() - started,
        });
      }

      // Final driver config (align keys for your connection manager)
      const final = {
        kind: connectionConfig.kind,
        host: connectionConfig.host,
        server: connectionConfig.host, // MSSQL uses "server"
        port:
          Number(connectionConfig.port) ||
          getDefaultPort(connectionConfig.kind),
        user: connectionConfig.username, // normalize to "user"
        username: connectionConfig.username, // (if your manager reads "username")
        password: connectionConfig.password,
        database: connectionConfig.database,
        ssl: connectionConfig.ssl || false,

        // MSSQL toggles (common local dev setup)
        encrypt:
          connectionConfig.kind === "mssql"
            ? connectionConfig.encrypt ?? false
            : undefined,
        trustServerCertificate:
          connectionConfig.kind === "mssql"
            ? connectionConfig.trustServerCertificate ?? true
            : undefined,
        enableArithAbort:
          connectionConfig.kind === "mssql"
            ? connectionConfig.enableArithAbort ?? true
            : undefined,

        // Pass-through bags if provided (your create*Pool can use these)
        options: connectionConfig.options,
        pool: connectionConfig.pool,
      };

      // Safe log
      console.log("Testing DB connection", {
        kind: final.kind,
        host: final.host,
        port: final.port,
        user: mask(final.user),
        database: final.database,
        ssl: final.ssl,
        ip: req.ip,
        ts: new Date().toISOString(),
      });

      const ok = await connectionManager.testConnection(final.kind, final);
      if (!ok) {
        return res.status(502).json({
          success: false,
          error: "Connection test failed",
          elapsedMs: Date.now() - started,
          connectionId: connectionId || null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Connected successfully",
        elapsedMs: Date.now() - started,
        connectionId: connectionId || null,
      });
    } catch (err) {
      console.error("testConnection controller error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Internal Server Error",
        elapsedMs: Date.now() - started,
      });
    }
  };

  // expose helpers if you want them elsewhere
  testConnection.getDefaultPort = getDefaultPort;

  return { testConnection };
}

module.exports = { createConnectionController };
