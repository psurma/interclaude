#!/usr/bin/env node

import express from "express";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.WEB_PORT || "3000", 10);
const REGISTRY_PATH = join(homedir(), ".claude", "interclaude-registry.json");

// Get version from package.json
let version = "0.0.0";
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  );
  version = packageJson.version;
} catch (err) {
  // Use default version
}

const app = express();

// Serve static files
app.use(express.static(__dirname));

// API endpoint for version
app.get("/api/version", (req, res) => {
  res.json({ version });
});

// API endpoint for registry
app.get("/api/registry", (req, res) => {
  let registry = { instances: {}, default: null };

  if (existsSync(REGISTRY_PATH)) {
    try {
      registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
    } catch (e) {
      console.error("Failed to load registry:", e.message);
    }
  }

  res.json(registry);
});

// Start server
app.listen(PORT, () => {
  console.log(`InterClaude Web UI running at http://localhost:${PORT}`);
  console.log(`Registry: ${REGISTRY_PATH}`);
});
