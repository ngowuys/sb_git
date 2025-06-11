import { editor, shell } from "@silverbulletmd/silverbullet/syscalls";

interface IGitInitPayload {
  url: string;
  name: string;
  email: string;
}

// TODO: Add support SSH clone?
export const gitClone = async () => {
  // TODO: Handle HTTP and SSH
  const url = await editor.prompt(`Project URL:`);
  if (!url) return;

  // TODO: Allow input SSH Key if use SSH
  const token = await editor.prompt(
    `Access token (For GitLab: username:access_token):`,
  );
  if (!token) return;

  const name = await editor.prompt(`Your name:`);
  if (!name) return;

  const email = await editor.prompt(`Your email:`);
  if (!email) return;

  // TODO: Add confirmation box
  const confirm = await editor.prompt(
    `Your content in git repo will overide current space, continue?(Yes/No)`,
  );
  if (confirm?.toLowerCase() == "yes" || confirm?.toLowerCase() == "y") {
    const parts = url.split("/");
    parts[2] = `${token}@${parts[2]}`;

    const payload: IGitInitPayload = {
      url: parts.join("/"), // No need .git at the end if use HTTP
      name,
      email,
    };
    await initRepo(payload);
  } else {
    editor.flashNotification(`User cancelled.`);
    return;
  }
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
  const url = (await shell.run("git", ["remote", "get-url", "origin"])).stdout
    .trim();

  const parts = url.split("/");
  parts[2] = parts[2].replace(/^.*@/, `${token}@`);
  const newUrl = parts.join("/");
  if (newUrl.trim() == "") {
    await editor.flashNotification(`Failed to replace token`);
    return;
  }

  // Update new origin
  console.log("Updating git remote");
  await shell.run("git", ["remote", "set-url", "origin", newUrl]);
  await editor.flashNotification(`Replaced token successfully!`);
};

export const changeGitRepo = async () => {
  console.log(`Deleting old .git folder`);
  await shell.run("rm", ["-rf", ".git"]);
  console.log(`Trigger git clone`);
  await gitClone();
};

export const scheduleCommit = async () => {
  // TODO: Handle CONFIG.md
  const currentMin = new Date().getMinutes();
  if (currentMin % 5 === 0) {
    await sync();
  }
};

const initRepo = async (payload: IGitInitPayload) => {
  await editor.flashNotification(
    "Cloning your git repo, it might take some time.",
  );
  try {
    await shell.run("git", ["clone", payload.url, "_sb_git"]);
  } catch {
    console.error("Failed to clone repository, please check your details");
    await editor.flashNotification(
      "Failed to clone repository, please check your details",
    );
    return;
  }
  // Create .gitignore file
  // TODO: Check if .gitignore exist, then skip
  console.log(`Creating .gitignore file`);
  await shell.run("echo", [".silverbullet.db*", ">", ".gitignore"]);
  await shell.run("echo", ["_plug/", ">>", ".gitignore"]);
  await shell.run("echo", ["Library/", ">>", ".gitignore"]);

  // Move content and .git folder from _sb_git
  console.log("Moving repo content to space");
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
