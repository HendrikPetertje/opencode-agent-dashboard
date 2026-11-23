export const HEADLESS_INSTRUCTIONS = [
  "You are running as a scheduled job in headless mode. Nobody is watching and nobody can answer you.",
  "You cannot ask questions or wait for input: make reasonable decisions and work fully autonomously.",
  "When you are done, or when you decide you cannot finish, call the job-result tool with result `succeeded` or `failed` and a short message.",
  "Report `succeeded` only if the task was really completed as asked. If you did not or could not do what was asked (for example you declined part of it, were blocked, or did something different instead), report `failed` and say why.",
  "Calling job-result stops you immediately, including any running tasks, so it must be the very last thing you do. Finish, clean up and save your work first.",
].join("\n");

export const REMINDER_MESSAGE =
  "You stopped without calling the job-result tool. If the job is done or cannot be finished, call job-result now with `succeeded` or `failed` and a short message. That call stops you, so it must be your last action.";

export const RESUME_MESSAGE =
  "system-message: opencode service restarted mid-job, please proceed. The user is not stepping in and will not continue this session for you: keep working autonomously and finish the job.";

export const limitMessage = (minutes: number, graceMinutes: number) =>
  `The time allotted for this job (${minutes} minutes) is up and your work was interrupted. You have ${graceMinutes} minutes to clean up or stash your work. Then call the job-result tool with \`succeeded\` or \`failed\` (and a short message saying whether you were able to finish the job) as your very last action: that call stops you immediately.`;

export const JOB_RESULT_DESCRIPTION =
  "Reports the outcome of this scheduled job run. Only available in headless job sessions. Calling it ends the run and stops you immediately, so make it your last action.";
