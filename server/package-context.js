import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';

/**
 * Package Context Loader
 *
 * Automatically detects relevant packages from a question and loads
 * their CLAUDE.md files to provide contextual information to Claude.
 */

const WORKING_DIR = process.env.CLAUDE_WORKING_DIR || '/tmp';

/**
 * Load the root CLAUDE.md file from the working directory
 * @returns {string|null} Contents of root CLAUDE.md or null
 */
export function loadRootClaudeMd() {
  const claudeMdPath = join(WORKING_DIR, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      return readFileSync(claudeMdPath, 'utf8');
    } catch (err) {
      return null;
    }
  }
  return null;
}

/**
 * Discover all packages in the working directory
 * Looks for common monorepo structures: packages/, apps/, libs/, services/
 * @returns {Array<{name: string, path: string, hasClaudeMd: boolean}>}
 */
export function discoverPackages() {
  const packages = [];
  const monorepoRoots = ['packages', 'apps', 'libs', 'services', 'modules'];

  for (const root of monorepoRoots) {
    const rootPath = join(WORKING_DIR, root);
    if (existsSync(rootPath) && statSync(rootPath).isDirectory()) {
      scanPackageDirectory(rootPath, packages, root);
    }
  }

  return packages;
}

/**
 * Recursively scan a directory for packages
 * @param {string} dirPath - Directory to scan
 * @param {Array} packages - Array to populate with packages
 * @param {string} prefix - Prefix for package paths
 */
function scanPackageDirectory(dirPath, packages, prefix) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = join(dirPath, entry.name);
      const packageJsonPath = join(fullPath, 'package.json');
      const claudeMdPath = join(fullPath, 'CLAUDE.md');

      // Check if this is a package (has package.json) or a grouping folder
      if (existsSync(packageJsonPath)) {
        packages.push({
          name: entry.name,
          path: `${prefix}/${entry.name}`,
          fullPath: fullPath,
          hasClaudeMd: existsSync(claudeMdPath)
        });
      } else {
        // Could be a grouping folder (like packages/integration/)
        scanPackageDirectory(fullPath, packages, `${prefix}/${entry.name}`);
      }
    }
  } catch (err) {
    // Ignore permission errors, etc.
  }
}

/**
 * Load CLAUDE.md for a specific package
 * @param {string} packagePath - Relative path to package
 * @returns {string|null} Contents of package CLAUDE.md or null
 */
export function loadPackageClaudeMd(packagePath) {
  const claudeMdPath = join(WORKING_DIR, packagePath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      return readFileSync(claudeMdPath, 'utf8');
    } catch (err) {
      return null;
    }
  }
  return null;
}

/**
 * Extract package names mentioned in a question
 * Uses multiple strategies: exact matches, partial matches, and keyword detection
 * @param {string} question - The user's question
 * @param {Array} packages - List of discovered packages
 * @returns {Array<string>} List of matched package paths
 */
export function detectMentionedPackages(question, packages) {
  const matched = new Set();
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/[\s,.\-_/]+/).filter(w => w.length > 2);

  for (const pkg of packages) {
    const pkgNameLower = pkg.name.toLowerCase();
    const pkgPathLower = pkg.path.toLowerCase();

    // Exact name match (case insensitive)
    if (questionLower.includes(pkgNameLower)) {
      matched.add(pkg.path);
      continue;
    }

    // Check if any word matches the package name
    for (const word of questionWords) {
      // Direct word match
      if (word === pkgNameLower) {
        matched.add(pkg.path);
        break;
      }

      // Partial match for compound names (e.g., "message" matches "message-router")
      if (pkgNameLower.includes(word) || word.includes(pkgNameLower)) {
        // Require at least 4 chars for partial match to avoid false positives
        if (word.length >= 4 || pkgNameLower.length >= 4) {
          matched.add(pkg.path);
          break;
        }
      }
    }

    // Check path segments (e.g., "sf integration" matches "integration/sf")
    const pathSegments = pkgPathLower.split('/');
    for (const segment of pathSegments) {
      if (questionWords.includes(segment) && segment.length >= 3) {
        matched.add(pkg.path);
        break;
      }
    }
  }

  return Array.from(matched);
}

/**
 * Build context string from relevant packages
 * @param {string} question - The user's question
 * @returns {{context: string, packages: Array<string>}} Context and matched packages
 */
export function buildPackageContext(question) {
  const contextParts = [];
  const matchedPackages = [];

  // Always include root CLAUDE.md if it exists
  const rootClaudeMd = loadRootClaudeMd();
  if (rootClaudeMd) {
    contextParts.push('# Project Overview (from root CLAUDE.md)\n\n' + rootClaudeMd);
  }

  // Discover packages
  const packages = discoverPackages();

  if (packages.length === 0) {
    return {
      context: contextParts.join('\n\n---\n\n'),
      packages: [],
      totalPackages: 0
    };
  }

  // Detect mentioned packages
  const mentionedPaths = detectMentionedPackages(question, packages);

  // Load CLAUDE.md for each mentioned package
  for (const pkgPath of mentionedPaths) {
    const claudeMd = loadPackageClaudeMd(pkgPath);
    if (claudeMd) {
      contextParts.push(`# Package: ${pkgPath}\n\n${claudeMd}`);
      matchedPackages.push(pkgPath);
    } else {
      // Even without CLAUDE.md, note that this package exists
      matchedPackages.push(pkgPath);
    }
  }

  // If no specific packages matched but we have a packages directory,
  // provide a summary of available packages
  if (matchedPackages.length === 0 && packages.length > 0) {
    const packageList = packages.map(p => `- ${p.path}${p.hasClaudeMd ? ' (has CLAUDE.md)' : ''}`).join('\n');
    contextParts.push(`# Available Packages\n\nThis monorepo contains ${packages.length} packages:\n\n${packageList}`);
  }

  return {
    context: contextParts.join('\n\n---\n\n'),
    packages: matchedPackages,
    totalPackages: packages.length
  };
}

/**
 * Get summary info about package detection for logging
 * @param {string} question - The question being asked
 * @returns {Object} Summary info
 */
export function getPackageContextSummary(question) {
  const packages = discoverPackages();
  const mentionedPaths = detectMentionedPackages(question, packages);
  const hasRootClaudeMd = !!loadRootClaudeMd();

  return {
    totalPackages: packages.length,
    packagesWithClaudeMd: packages.filter(p => p.hasClaudeMd).length,
    detectedPackages: mentionedPaths,
    hasRootClaudeMd
  };
}
