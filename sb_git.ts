import { editor, shell } from "@silverbulletmd/silverbullet/syscalls";

interface IGitInitPayload {
  url: string;
  name: string;
  email: string;
}

// TODO: Add support SSH clone?
export const gitClone = async () => {
  const gitUrl = await getGitRemoteUrl();
  if (gitUrl != "") {
    await confirmPrompt(
      "Found existed Git setup, do you want to continue? This will delete old git config? (Yes/No)",
    );
    await removeGit();
  }

  // TODO: Handle HTTP and SSH
  const url = await inputPrompt("Project URL:");

  // TODO: Allow input SSH Key if use SSH
  const accessToken = await inputPrompt(
    "Access token (For GitLab: username:access_token):",
  );

  const name = await inputPrompt("Your name:");

  const email = await inputPrompt("Your email:");

  await confirmPrompt(
    "Your content in git repo will overide current space, continue? (Yes/No)",
  );

  const parts = url.split("/");
  parts[2] = `${accessToken}@${parts[2]}`;

  const payload: IGitInitPayload = {
    url: parts.join("/"),
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
    "Enter new token (For GitLab: username:access_token):",
  );
  if (!token) return;

  // Get current origin
  // Expected output
  // Ex1: https://user:token@gitlab.com/user/repo.git
  // Ex2: https://token@github.com/user/repo.git
  const url = await getGitRemoteUrl();

  if (url != "") {
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
  } else return;
};

export const changeGitRepo = async () => {
  await confirmPrompt("Are you sure to continue? (Yes/No)");
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

const getGitRemoteUrl = async () => {
  await editor.flashNotification("Checking git exists or not...");
  const url = (await shell.run("git", ["remote", "get-url", "origin"])).stdout
    .trim();
  if (url == "") {
    console.error(
      "Git repo does not exist, please make sure you have set it up",
    );
    await editor.flashNotification(
      "Git repo does not exist, please make sure you have set it up",
    );
    return "";
  }
  return url;
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

const removeGit = async () => {
  console.log("Removing .git");
  await shell.run("rm", ["-rf", ".git"]);
  await editor.flashNotification("Removed Git");
};

// TODO: Read config to make sure user want to send flash notify when do smthing
// const flashNotify = async (msg: string) => {
//   // TODO: Check config

//   await editor.flashNotification(msg);
// };

const inputPrompt = async (msg: string) => {
  const input = (await editor.prompt(msg))?.trim();
  if (!input) {
    console.log("User cancelled (no response)");
    await editor.flashNotification("User cancelled (no response)");
  }
  return input || "";
};

const confirmPrompt = async (msg: string): Promise<void> => {
  const response = await inputPrompt(msg);
  const confirmed = ["yes", "y"].includes(response.toLowerCase());
  if (!confirmed) {
    await editor.flashNotification("User cancelled!");
    throw new Error("User cancelled");
  }
};
