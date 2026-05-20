const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT, "server", "index.js");
const GIT_REMOTE = String(process.env.AUTO_UPDATE_REMOTE || "origin").trim() || "origin";
const UPDATE_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.AUTO_UPDATE_INTERVAL_MS || process.env.AUTO_UPDATE_INTERVAL_MINUTES * 60_000 || 300_000) || 300_000
);

function toBoolean(value, fallback = false) {
  if (value == null || value === "") return Boolean(fallback);
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

const AUTO_UPDATE_ENABLED =
  toBoolean(process.env.AUTO_UPDATE_ENABLED, true) && !toBoolean(process.env.AUTO_UPDATE_DISABLED, false);
const AUTO_INSTALL_ENABLED = toBoolean(process.env.AUTO_UPDATE_INSTALL, true);
const AUTO_RESTART_DELAY_MS = Math.max(1500, Number(process.env.AUTO_UPDATE_RESTART_DELAY_MS || 3000) || 3000);
const currentEnv = { ...process.env };

let serverProcess = null;
let restarting = false;
let shuttingDown = false;
let updateRunning = false;
let pollingTimer = null;

function log(message) {
  console.log(`[auto-update] ${message}`);
}

function hasGit() {
  return fs.existsSync(path.join(ROOT, ".git"));
}

function getGitCommand() {
  return process.platform === "win32" ? "git.exe" : "git";
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: currentEnv,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function runGit(args) {
  return runCommand(getGitCommand(), args);
}

async function runNpmInstall() {
  log("Dependencies changed, running npm install...");
  await runCommand(getNpmCommand(), ["install", "--no-audit", "--no-fund"]);
}

async function getCurrentBranch() {
  if (!hasGit()) return String(process.env.AUTO_UPDATE_BRANCH || "main").trim() || "main";
  try {
    const branch = await runGit(["branch", "--show-current"]);
    return branch || String(process.env.AUTO_UPDATE_BRANCH || "main").trim() || "main";
  } catch {
    return String(process.env.AUTO_UPDATE_BRANCH || "main").trim() || "main";
  }
}

function spawnServer() {
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env: currentEnv,
    stdio: "inherit",
    windowsHide: true,
  });

  serverProcess.on("exit", (code, signal) => {
    serverProcess = null;
    if (shuttingDown) {
      process.exit(typeof code === "number" ? code : 0);
      return;
    }

    if (restarting) {
      restarting = false;
      setTimeout(spawnServer, AUTO_RESTART_DELAY_MS);
      return;
    }

    log(`Server stopped (${signal || code || "unknown"}), relaunching...`);
    setTimeout(spawnServer, AUTO_RESTART_DELAY_MS);
  });
}

function restartServer(reason) {
  if (restarting) return;
  restarting = true;
  log(`Restart requested: ${reason}`);
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  } else {
    restarting = false;
    spawnServer();
  }
}

async function checkForUpdates() {
  if (!AUTO_UPDATE_ENABLED || !hasGit()) return { checked: false, updated: false };

  const branch = await getCurrentBranch();
  const remote = GIT_REMOTE;

  await runGit(["fetch", remote, branch]);

  const localHead = await runGit(["rev-parse", "HEAD"]);
  let remoteHead = "";
  try {
    remoteHead = await runGit(["rev-parse", `${remote}/${branch}`]);
  } catch {
    remoteHead = await runGit(["rev-parse", "FETCH_HEAD"]);
  }

  if (!remoteHead || localHead === remoteHead) {
    return { checked: true, updated: false, branch, remote };
  }

  const changedFiles = await runGit([
    "diff",
    "--name-only",
    `${localHead}..${remoteHead}`,
    "--",
    "package.json",
    "package-lock.json",
  ]).catch(() => "");

  log(`Update available on ${remote}/${branch}; pulling latest changes...`);
  await runGit(["pull", "--ff-only", remote, branch]);

  if (AUTO_INSTALL_ENABLED && changedFiles) {
    await runNpmInstall();
  }

  return {
    checked: true,
    updated: true,
    branch,
    remote,
    installed: Boolean(AUTO_INSTALL_ENABLED && changedFiles),
  };
}

async function pollForUpdates() {
  if (updateRunning) return;
  updateRunning = true;
  try {
    const result = await checkForUpdates();
    if (result.updated) {
      restartServer(`git pull ${result.remote}/${result.branch}`);
    }
  } catch (error) {
    log(`Update check failed: ${error.message}`);
  } finally {
    updateRunning = false;
  }
}

async function shutdown(code = 0) {
  shuttingDown = true;
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    const timer = setTimeout(() => process.exit(code), 2000);
    if (typeof timer.unref === "function") timer.unref();
    return;
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnServer();

if (AUTO_UPDATE_ENABLED) {
  setTimeout(pollForUpdates, 10_000);
  pollingTimer = setInterval(pollForUpdates, UPDATE_INTERVAL_MS);
  log(`Auto-update active every ${Math.round(UPDATE_INTERVAL_MS / 60000)} minute(s).`);
} else {
  log("Auto-update disabled.");
}
