#!/usr/bin/env node

import blessed from "blessed";
import contrib from "blessed-contrib";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Load registry
const REGISTRY_PATH = join(homedir(), ".claude", "interclaude-registry.json");
let registry = { instances: {}, default: "local" };

if (existsSync(REGISTRY_PATH)) {
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  } catch (e) {
    // Use default
  }
}

// State
let selectedInstance = registry.default || Object.keys(registry.instances)[0];
let instanceStatus = {};
let messageHistory = [];
let isLoading = false;

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: "InterClaude TUI",
  fullUnicode: true,
});

// Create grid layout
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

// Header/Title bar
const header = grid.set(0, 0, 1, 12, blessed.box, {
  content: "{center}{bold}InterClaude{/bold} - Multi-Instance Claude Communication{/center}",
  tags: true,
  style: {
    fg: "white",
    bg: "blue",
  },
});

// Instance list (left panel)
const instanceList = grid.set(1, 0, 5, 3, blessed.list, {
  label: " Instances ",
  border: { type: "line" },
  tags: true,
  style: {
    border: { fg: "cyan" },
    selected: { bg: "cyan", fg: "black", bold: true },
    item: { fg: "white" },
    focus: { border: { fg: "yellow" } },
  },
  keys: true,
  vi: true,
  mouse: true,
  interactive: true,
  scrollbar: {
    ch: " ",
    style: { bg: "cyan" },
  },
});

// Instance details panel
const instanceDetails = grid.set(1, 3, 5, 4, blessed.box, {
  label: " Instance Details ",
  border: { type: "line" },
  tags: true,
  style: {
    border: { fg: "green" },
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    style: { bg: "green" },
  },
});

// Stats/metrics panel
const statsBox = grid.set(1, 7, 2, 5, blessed.box, {
  label: " Stats ",
  border: { type: "line" },
  tags: true,
  style: {
    border: { fg: "yellow" },
  },
});

// Activity sparkline
const activityLine = grid.set(3, 7, 3, 5, contrib.sparkline, {
  label: " Activity ",
  tags: true,
  border: { type: "line" },
  style: {
    border: { fg: "magenta" },
  },
});

// Message log (main area)
const messageLog = grid.set(6, 0, 4, 12, blessed.log, {
  label: " Messages ",
  border: { type: "line" },
  tags: true,
  style: {
    border: { fg: "white" },
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    style: { bg: "white" },
  },
  mouse: true,
});

// Input box
const inputBox = grid.set(10, 0, 2, 10, blessed.textbox, {
  label: " Ask a Question (Enter to send, Esc to cancel) ",
  border: { type: "line" },
  style: {
    border: { fg: "green" },
    focus: { border: { fg: "yellow" } },
  },
  inputOnFocus: true,
  mouse: true,
});

// Help panel
const helpBox = grid.set(10, 10, 2, 2, blessed.box, {
  label: " Keys ",
  border: { type: "line" },
  tags: true,
  content: "{cyan-fg}i{/} Input\n{cyan-fg}d{/} Discover\n{cyan-fg}q{/} Quit\n{cyan-fg}?{/} Help",
  style: {
    border: { fg: "gray" },
  },
});

// Loading indicator
const loadingBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: 30,
  height: 5,
  border: { type: "line" },
  style: {
    border: { fg: "yellow" },
    bg: "black",
  },
  tags: true,
  content: "{center}{yellow-fg}Loading...{/yellow-fg}{/center}",
  hidden: true,
});

// Spinner frames
const spinnerFrames = ["", "", "", "", "", "", "", "", "", ""];
const listSpinnerFrames = ["◐", "◓", "◑", "◒"];
let spinnerIndex = 0;
let listSpinnerIndex = 0;
let spinnerInterval = null;
let listSpinnerInterval = null;

function showLoading(message = "Loading...") {
  isLoading = true;
  loadingBox.setContent(`{center}{yellow-fg}${spinnerFrames[0]} ${message}{/yellow-fg}{/center}`);
  loadingBox.show();
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    loadingBox.setContent(`{center}{yellow-fg}${spinnerFrames[spinnerIndex]} ${message}{/yellow-fg}{/center}`);
    screen.render();
  }, 100);
  screen.render();
}

function hideLoading() {
  isLoading = false;
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  loadingBox.hide();
  screen.render();
}

// Activity data for sparkline
let activityData = new Array(20).fill(0);

function addActivity(value) {
  activityData.shift();
  activityData.push(value);
  activityLine.setData(["Requests"], [activityData]);
}

// Start list spinner for unknown statuses
function startListSpinner() {
  if (listSpinnerInterval) return;
  listSpinnerInterval = setInterval(() => {
    listSpinnerIndex = (listSpinnerIndex + 1) % listSpinnerFrames.length;
    // Only update if there are unknown statuses and not navigating
    const hasUnknown = Object.keys(registry.instances).some(
      (name) => !instanceStatus[name] || (instanceStatus[name] !== "online" && instanceStatus[name] !== "offline")
    );
    if (hasUnknown) {
      updateInstanceListItems();
      screen.render();
    } else {
      stopListSpinner();
    }
  }, 200);
}

// Stop list spinner
function stopListSpinner() {
  if (listSpinnerInterval) {
    clearInterval(listSpinnerInterval);
    listSpinnerInterval = null;
  }
}

// Get status indicator with color codes for list
function getStatusIndicator(status) {
  if (status === "online") {
    return "{green-fg}●{/green-fg}";
  } else if (status === "offline") {
    return "{red-fg}○{/red-fg}";
  } else {
    return `{yellow-fg}${listSpinnerFrames[listSpinnerIndex]}{/yellow-fg}`;
  }
}

// Update instance list items (used by spinner)
function updateInstanceListItems() {
  const names = Object.keys(registry.instances);
  const currentSelection = instanceList.selected;

  const items = names.map((name) => {
    const status = instanceStatus[name];
    const indicator = getStatusIndicator(status);
    return ` ${indicator}  ${name}`;
  });
  instanceList.setItems(items);

  // Restore selection
  if (currentSelection !== undefined && currentSelection < items.length) {
    instanceList.select(currentSelection);
  }
}

// Populate instance list
function refreshInstanceList() {
  updateInstanceListItems();

  // Check if any instances have unknown status
  const hasUnknown = Object.keys(registry.instances).some(
    (name) => !instanceStatus[name] || (instanceStatus[name] !== "online" && instanceStatus[name] !== "offline")
  );

  if (hasUnknown) {
    startListSpinner();
  } else {
    stopListSpinner();
  }

  screen.render();
}

// Update instance details
function updateInstanceDetails(name) {
  const instance = registry.instances[name];
  if (!instance) {
    instanceDetails.setContent("{red-fg}No instance selected{/red-fg}");
    return;
  }

  const status = instanceStatus[name] || "unknown";
  const statusColor = status === "online" ? "green" : status === "offline" ? "red" : "yellow";

  let content = `{bold}${name}{/bold}\n\n`;
  content += `{cyan-fg}Host:{/cyan-fg} ${instance.host}:${instance.port}\n`;
  content += `{cyan-fg}Status:{/cyan-fg} {${statusColor}-fg}${status}{/${statusColor}-fg}\n`;
  content += `{cyan-fg}Description:{/cyan-fg} ${instance.description || "N/A"}\n`;

  if (instanceStatus[name + "_details"]) {
    const details = instanceStatus[name + "_details"];
    content += `\n{bold}Live Info:{/bold}\n`;
    content += `{cyan-fg}Version:{/cyan-fg} ${details.version || "N/A"}\n`;
    content += `{cyan-fg}Instance:{/cyan-fg} ${details.instance_name || "N/A"}\n`;
    content += `{cyan-fg}Claude:{/cyan-fg} ${details.claude_code_available ? "{green-fg}Available{/green-fg}" : "{red-fg}Unavailable{/red-fg}"}\n`;
    content += `{cyan-fg}Active:{/cyan-fg} ${details.active_requests}/${details.max_concurrent}\n`;
    if (details.persona) {
      content += `{cyan-fg}Persona:{/cyan-fg} ${details.persona.substring(0, 50)}...\n`;
    }
  }

  instanceDetails.setContent(content);
  screen.render();
}

// Update stats
let totalRequests = 0;
let totalResponses = 0;
let avgResponseTime = 0;

function updateStats() {
  statsBox.setContent(
    `{cyan-fg}Requests:{/cyan-fg} ${totalRequests}\n` +
    `{green-fg}Responses:{/green-fg} ${totalResponses}\n` +
    `{yellow-fg}Avg Time:{/yellow-fg} ${avgResponseTime.toFixed(0)}ms`
  );
  screen.render();
}

// Discover instances
async function discoverInstances() {
  showLoading("Discovering instances...");
  messageLog.log("{yellow-fg}Discovering instances...{/yellow-fg}");

  const instances = Object.keys(registry.instances);
  let discovered = 0;

  for (const name of instances) {
    const instance = registry.instances[name];
    const url = `http://${instance.host}:${instance.port}/health`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        instanceStatus[name] = "online";
        instanceStatus[name + "_details"] = data;
        discovered++;
        messageLog.log(`{green-fg}${name}{/green-fg} - Online (${data.instance_name})`);
      } else {
        instanceStatus[name] = "offline";
        messageLog.log(`{red-fg}${name}{/red-fg} - Offline (HTTP ${response.status})`);
      }
    } catch (e) {
      instanceStatus[name] = "offline";
      messageLog.log(`{red-fg}${name}{/red-fg} - Offline (${e.message})`);
    }
  }

  hideLoading();
  refreshInstanceList();
  updateInstanceDetails(selectedInstance);
  messageLog.log(`{cyan-fg}Discovery complete: ${discovered}/${instances.length} online{/cyan-fg}`);
  instanceList.focus();
}

// Send question to instance
async function askInstance(name, question) {
  const instance = registry.instances[name];
  if (!instance) {
    messageLog.log(`{red-fg}Error: Unknown instance "${name}"{/red-fg}`);
    return;
  }

  const url = `http://${instance.host}:${instance.port}/ask`;
  totalRequests++;
  updateStats();
  addActivity(1);

  showLoading(`Asking ${name}...`);
  messageLog.log(`{cyan-fg}[You -> ${name}]{/cyan-fg} ${question}`);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const duration = Date.now() - startTime;
    avgResponseTime = (avgResponseTime * (totalResponses) + duration) / (totalResponses + 1);

    if (response.ok) {
      const data = await response.json();
      totalResponses++;
      updateStats();

      messageLog.log(`{green-fg}[${data.instance_name || name}]{/green-fg} (${duration}ms)`);

      // Split long responses into lines
      const lines = data.answer.split("\n");
      for (const line of lines) {
        messageLog.log(`  ${line}`);
      }
    } else {
      const data = await response.json();
      messageLog.log(`{red-fg}[Error from ${name}]{/red-fg} ${data.error || "Unknown error"}`);
    }
  } catch (e) {
    messageLog.log(`{red-fg}[Error]{/red-fg} Could not reach ${name}: ${e.message}`);
  }

  hideLoading();
  addActivity(0);
  screen.render();
}

// Help dialog
function showHelp() {
  const helpDialog = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 50,
    height: 20,
    border: { type: "line" },
    style: {
      border: { fg: "cyan" },
      bg: "black",
    },
    tags: true,
    label: " Help ",
    content: `
{bold}InterClaude TUI{/bold}

{cyan-fg}Navigation:{/cyan-fg}
  {yellow-fg}Tab{/yellow-fg}        - Switch focus between panels
  {yellow-fg}Up/Down{/yellow-fg}    - Navigate instance list
  {yellow-fg}Enter{/yellow-fg}      - Select instance

{cyan-fg}Actions:{/cyan-fg}
  {yellow-fg}i{/yellow-fg}          - Focus input box
  {yellow-fg}d{/yellow-fg}          - Discover/refresh instances
  {yellow-fg}r{/yellow-fg}          - Reload registry
  {yellow-fg}?{/yellow-fg}          - Show this help
  {yellow-fg}q / Ctrl+C{/yellow-fg} - Quit

{cyan-fg}Input:{/cyan-fg}
  {yellow-fg}Enter{/yellow-fg}      - Send question
  {yellow-fg}Escape{/yellow-fg}     - Cancel input

Press any key to close...
`,
  });

  helpDialog.focus();
  screen.render();

  helpDialog.onceKey(["escape", "enter", "q", "space"], () => {
    helpDialog.destroy();
    screen.render();
  });
}

// Key bindings
screen.key(["q", "C-c"], () => {
  return process.exit(0);
});

screen.key(["?"], () => {
  showHelp();
});

screen.key(["d"], () => {
  if (!isLoading) discoverInstances();
});

screen.key(["i"], () => {
  inputBox.focus();
});

screen.key(["r"], () => {
  if (existsSync(REGISTRY_PATH)) {
    try {
      registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
      refreshInstanceList();
      messageLog.log("{cyan-fg}Registry reloaded{/cyan-fg}");
    } catch (e) {
      messageLog.log(`{red-fg}Error reloading registry: ${e.message}{/red-fg}`);
    }
  }
});

screen.key(["tab"], () => {
  if (screen.focused === instanceList) {
    inputBox.focus();
  } else {
    instanceList.focus();
  }
});

// Handle list navigation events to update details
instanceList.on("select item", (item, index) => {
  stopListSpinner();
  const name = Object.keys(registry.instances)[index];
  if (name) {
    selectedInstance = name;
    updateInstanceDetails(name);
  }
});

// Instance list selection (Enter key) - focus input
instanceList.on("select", (item, index) => {
  const name = Object.keys(registry.instances)[index];
  selectedInstance = name;
  updateInstanceDetails(name);
  inputBox.focus();
});

// Input handling
inputBox.on("submit", (value) => {
  if (value && value.trim()) {
    askInstance(selectedInstance, value.trim());
  }
  inputBox.clearValue();
  instanceList.focus();
  screen.render();
});

inputBox.on("cancel", () => {
  inputBox.clearValue();
  instanceList.focus();
  screen.render();
});

// Initialize
refreshInstanceList();
updateInstanceDetails(selectedInstance);
updateStats();
activityLine.setData(["Requests"], [activityData]);

messageLog.log("{bold}{cyan-fg}Welcome to InterClaude TUI!{/cyan-fg}{/bold}");
messageLog.log("Press {yellow-fg}d{/yellow-fg} to discover instances, {yellow-fg}i{/yellow-fg} to ask a question, {yellow-fg}?{/yellow-fg} for help");
messageLog.log("");

// Focus instance list
instanceList.focus();

// Initial discovery
setTimeout(() => {
  discoverInstances();
}, 500);

screen.render();
