import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(process.cwd(), "scripts/network-profile.sh");

export type NetworkProfileMode = "open" | "tailnet-only" | "custom";

export type NetworkProfileStatus = {
  mode: NetworkProfileMode;
  launchHost: string;
  serveStatus: string;
  localListener: string;
};

type ScriptFailure = Error & {
  stdout?: string;
  stderr?: string;
};

function formatScriptError(error: unknown) {
  if (error && typeof error === "object") {
    const failure = error as ScriptFailure;
    const message = [failure.stderr, failure.stdout, failure.message]
      .map((value) => value?.trim())
      .find(Boolean);

    if (message) {
      return message;
    }
  }

  return "Network profile command failed.";
}

async function runProfileScript(args: string[]) {
  try {
    const { stdout } = await execFileAsync(scriptPath, args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        TAILSCALE_BIN: process.env.TAILSCALE_BIN ?? "/usr/local/bin/tailscale",
        PYTHON_BIN: process.env.PYTHON_BIN ?? "/opt/homebrew/bin/python3.11",
      },
    });

    return stdout.trim();
  } catch (error) {
    throw new Error(formatScriptError(error));
  }
}

function profileCommandEnv() {
  return {
    ...process.env,
    TAILSCALE_BIN: process.env.TAILSCALE_BIN ?? "/usr/local/bin/tailscale",
    PYTHON_BIN: process.env.PYTHON_BIN ?? "/opt/homebrew/bin/python3.11",
  };
}

export async function getNetworkProfileStatus(): Promise<NetworkProfileStatus> {
  const output = await runProfileScript(["status-json"]);
  return JSON.parse(output) as NetworkProfileStatus;
}

export async function switchNetworkProfile(mode: Extract<NetworkProfileMode, "open" | "tailnet-only">) {
  await runProfileScript([mode]);
  return getNetworkProfileStatus();
}

export function queueNetworkProfileSwitch(mode: Extract<NetworkProfileMode, "open" | "tailnet-only">) {
  const command = `sleep 1; "${scriptPath}" ${mode} >> /tmp/network-profile-switch.log 2>&1`;
  const child = spawn("/bin/bash", ["-lc", command], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: profileCommandEnv(),
  });

  child.unref();
}
