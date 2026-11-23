import { existsSync, statSync } from "node:fs";
import { validateCron } from "../shared/cron.ts";
import { MAX_TIMEOUT_MINUTES, type JobInput } from "../shared/types.ts";

/** Cleans up job input from the TUI and throws an Error describing the first problem. */
export function parseJobInput(raw: any): JobInput {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const name = text(raw?.name);
  const folder = text(raw?.folder);
  const agent = text(raw?.agent);
  const prompt = typeof raw?.prompt === "string" ? raw.prompt.trim() : "";
  const cron = text(raw?.cron);
  const timeoutMinutes = Number(raw?.timeoutMinutes);
  if (!name) throw new Error("Give the job a name");
  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) throw new Error("The folder does not exist");
  if (!agent) throw new Error("Pick an agent");
  if (!prompt) throw new Error("Write a prompt");
  const cronError = validateCron(cron);
  if (cronError) throw new Error(`Cron: ${cronError}`);
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > MAX_TIMEOUT_MINUTES) {
    throw new Error(`Maximum run time must be a whole number of minutes from 1 to ${MAX_TIMEOUT_MINUTES}`);
  }
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : undefined,
    name,
    folder,
    agent,
    model: text(raw?.model) || null,
    timeoutMinutes,
    enabled: raw?.enabled !== false,
    prompt,
    cron,
  };
}
