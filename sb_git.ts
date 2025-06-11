import { editor, shell, syscall } from "@silverbulletmd/silverbullet/syscalls";

interface IGitInitPayload {
  url: string;
  name: string;
  email: string;
}

export const gitClone = async () => {
  const url = await editor.prompt(`Github project URL:`);
  if (!url) return;

  const token = await editor.prompt(
    `Access token (For GitLab: username:access_token):`,
  );
  if (!token) return;

  const name = await editor.prompt(`Your name:`);
  if (!name) return;

  const email = await editor.prompt(`Your email:`);
  if (!email) return;

  const parts = url.split("/");
  parts[2] = `${token}@${parts[2]}`;

  const payload: IGitInitPayload = {
    url: parts.join("/") + ".git",
    name,
    email,
  };

  await initRepo(payload);
};

export const sync = async () => {
  console.log(`Starting sync with git repo`);
  await commit();
  console.log(`Pulling change(s) from repo`);
  await shell.run("git", ["pull"]);
  console.log(`Pushing change(s) to repo`);
  await shell.run("git", ["push"]);
  console.log(`Done with sync task`);
};

export const replaceToken = async () => {
  const token = await editor.prompt(
    `Enter new token (For GitLab: username:access_token):`,
  );
  if (!token) return;

  // Get current origin
  // Expected output
  // Ex1: https://user:token@gitlab.com/user/repo.git
  // Ex2: https://token@github.com/user/repo.git
  const url = (await shell.run("git", ["get-url", "origin"])).stdout.trim();

  const parts = url.split("/");
  parts[2] = parts[2].replace(/^.*@/, `${token}@`);
  const newUrl = parts.join("/");
  if (newUrl.trim() == "") {
    await editor.flashNotification(`Failed to replace token`);
    return;
  }

  // Update new origin
  await shell.run("git", ["remote", "set-url", "origin", newUrl]);
  await editor.flashNotification(`Replaced token successfully!`);
};

export const changeGitRepo = async () => {
  console.log(`Deleting old .git folder`);
  await shell.run("rm", ["-rf", ".git"]);
  console.log(`Trigger gitClone`);
  await gitClone();
};

export const scheduleCommit = async () => {
};

const initRepo = async (payload: IGitInitPayload) => {
  await editor.flashNotification(
    "Cloning your git repo, it might take some time.",
  );
  await shell.run("mkdir", ["clone", payload.url, "_sb_git"]);

  // Create .gitignore file
  await shell.run("echo", [".silverbullet.db*", ">", ".gitignore"]);
  await shell.run("echo", ["_plug/", ">>", ".gitignore"]);
  await shell.run("echo", ["Library/", ">>", ".gitignore"]);

  // Move content and .git folder from _sb_git
  await shell.run("bash", ["-c", "mv -f _sb_git/{.,}* . 2> /dev/null; true"]);
  await shell.run("rm", ["-rf", "_sb_git"]);
  await shell.run("git", ["config", "user.name", payload.name]);
  await shell.run("git", ["config", "user.email", payload.email]);
  await editor.flashNotification(
    "Done. Now just wait for sync to kick in to get all the content.",
  );
};

const commit = async (msg?: string) => {
  if (!msg) {
    msg = `bot - auto commit ${Date.now()}`;
  }
  console.log(`Commit your space to git with message: ${msg}`);
  await shell.run("git", ["add", "./*"]);
  try {
    await shell.run("git", ["commit", "-a", "-m", msg]);
  } catch {
    console.log(`Failed to commit`);
  }
  console.log(`Done`);
};
