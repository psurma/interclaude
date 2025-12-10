import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join, isAbsolute } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Parse --env argument
function getEnvPath() {
  const args = process.argv.slice(2);
  const envIndex = args.findIndex((arg) => arg === "--env" || arg === "-e");

  if (envIndex !== -1 && args[envIndex + 1]) {
    const envFile = args[envIndex + 1];
    // Support absolute or relative paths
    const envPath = isAbsolute(envFile) ? envFile : join(projectRoot, envFile);

    if (!existsSync(envPath)) {
      console.error(`Error: Environment file not found: ${envPath}`);
      process.exit(1);
    }

    console.log(`Loading config from: ${envPath}`);
    return envPath;
  }

  // Default to .env in project root
  return join(projectRoot, ".env");
}

// Load environment variables BEFORE any other modules read them
config({ path: getEnvPath() });
