import readline from "node:readline";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { getProviderConfig, validateProviderConfig } from "./aiService.js";
import { fetchGitHubRepositories, fetchGitHubCommits, fetchCommitDetails, fetchRepoTree, downloadCommitArchive, fetchFileContent, fetchRepoIssues } from "./gitConnectionService.js";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
};

export class ChatService {
  constructor(token, providerOverride, modelOverride, username) {
    this.token = token;
    this.username = username;
    this.providerOverride = providerOverride;
    this.modelOverride = modelOverride;
    this.conversationHistory = [];
    this.repoContext = null;
    this.repositories = [];
    this.activeRepo = null;
    this.activeCommit = null;
    this.config = getProviderConfig(providerOverride, modelOverride);
    validateProviderConfig(this.config);
  }

  async initializeRepoContext() {
    try {
      this.repositories = await fetchGitHubRepositories(this.token);

      const repoList = this.repositories
        .slice(0, 10)
        .map(
          (repo) =>
            `${repo.name}: ${repo.description || "No description"} (${repo.language || "Unknown"})`
        )
        .join("\n");

      this.repoContext = {
        repos: repoList,
        reposCount: this.repositories.length,
        topRepos: this.repositories.slice(0, 5).map((r) => r.name).join(", ")
      };

      return this.repoContext;
    } catch (error) {
      throw new Error(`Failed to initialize GitHub context: ${error.message}`);
    }
  }

  buildSystemPrompt() {
    return `You are an expert GitHub assistant with access to the user's repositories. You have full knowledge of the user's codebase and projects.

User: @${this.username}
Total Repositories: ${this.repoContext.reposCount}

Recent Repositories:
${this.repoContext.repos}

IMPORTANT INSTRUCTIONS:
- CRITICAL: DO NOT USE MARKDOWN ANYWHERE IN YOUR RESPONSE.
- NO ASTERISKS (*), NO BACKTICKS (\`), NO HASH SIGN (#), NO BOLD, NO ITALICS.
- YOU MUST ONLY OUTPUT RAW PLAIN TEXT WITH CLEAN, MINIMAL SPACING.
- NEVER repeat or echo the user's prompt in your response. Answer directly.
- Avoid long block paragraphs. Break your response into neat, readable chunks.
- For sections or headers, simply use Title Case followed by a colon (e.g., "Overview:"). Do not underline them or use all-caps.
- Use standard 2-space indentation and simple dashes (-) for lists.
- Maintain a tidy, professional structure. For example, when comparing commits:

Commit: [SHA]
  Author: [Name]
  Summary: [Brief summary]
  Files modified: [List of files]

Analysis:
  - [Key point 1]
  - [Key point 2]

- Respond directly without any thinking or processing messages.
- If the user asks you to download, clone, or save the repository, DO NOT give them instructions. Instead, your entire response MUST be exactly the text "[ACTION:DOWNLOAD]".
- If you need to read a specific file from the repository, output EXACTLY "[ACTION:READ:path/to/file.ext]". I will intercept this and provide the contents.
- If the user asks you to apply a code fix, output EXACTLY "[ACTION:PATCH:path/to/file.ext] --- new file content here ---".
- If you are asked to compare multiple commits or analyze changes across them, output EXACTLY "[ACTION:SELECT_COMMITS]". I will open a multi-selection UI for the user.
- If you need to access a specific historical commit directly by its SHA, output EXACTLY "[ACTION:FETCH_COMMIT:sha]".
- If the user asks you to execute a local git command or terminal command (e.g., git commit, git push, git checkout, etc.), output EXACTLY "[ACTION:EXECUTE:command]". I will run it dynamically and provide the output.
- Be concise, structural, helpful, and visually neat for a plain-text terminal environment.`;
  }

  async sendMessage(userMessage) {
    this.conversationHistory.push({
      role: "user",
      content: userMessage
    });

    try {
      if (this.config.provider === "gemini") {
        return await this.sendGeminiMessage();
      }
      return await this.sendOpenAICompatibleMessage();
    } catch (error) {
      throw new Error(`Failed to get response from LLM: ${error.message}`);
    }
  }

  async sendOpenAICompatibleMessage() {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`
    };

    if (this.config.provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://github.com";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "gitxplain";
    }

    const body = {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: this.buildSystemPrompt()
        },
        ...this.conversationHistory
      ],
      temperature: 0.7
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${this.config.provider} request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const assistantMessage =
      data.choices?.[0]?.message?.content?.trim() || "No response from the model.";

    this.conversationHistory.push({
      role: "assistant",
      content: assistantMessage
    });

    return assistantMessage;
  }

  async sendGeminiMessage() {
    const response = await fetch(
      `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: this.buildSystemPrompt()
              }
            ]
          },
          contents: [
            ...this.conversationHistory.map((msg) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content }]
            }))
          ],
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`gemini request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const assistantMessage = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "No response from the model.";

    this.conversationHistory.push({
      role: "assistant",
      content: assistantMessage
    });

    return assistantMessage;
  }

  async startInteractiveChat() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => {
      return new Promise((resolve) => {
        rl.question(`${COLORS.bold}${COLORS.blue}${prompt}${COLORS.reset}`, resolve);
      });
    };

    console.log(`${COLORS.bold}${COLORS.cyan}GitHub Chat - Type 'repos' to select a repo, 'download' to clone the selected commit state, 'exit' to quit, 'clear' to reset history\n${COLORS.reset}`);
    console.log(`${COLORS.cyan}Model: gitXplain\n${COLORS.reset}`);

    while (true) {
      const userInput = await question("You: ");

      if (userInput.toLowerCase() === "exit") {
        console.log(`${COLORS.green}Goodbye!${COLORS.reset}`);
        rl.close();
        break;
      }

      if (userInput.toLowerCase() === "clear") {
        this.conversationHistory = [];
        console.log(`${COLORS.yellow}Conversation history cleared.\n${COLORS.reset}`);
        continue;
      }

      if (userInput.toLowerCase() === "download") {
        if (!this.activeRepo || !this.activeCommit) {
          console.log(`${COLORS.yellow}No repository/commit selected. Please type 'repos' first.\n${COLORS.reset}`);
          continue;
        }
        
        try {
          console.log(`\n${COLORS.cyan}⏳ Downloading ${this.activeRepo.name} (Commit: ${this.activeCommit.sha})...${COLORS.reset}`);
          const filename = `${this.activeRepo.name}-${this.activeCommit.sha}.zip`;
          const destPath = path.join(os.homedir(), "Downloads", filename);
          
          await downloadCommitArchive(this.token, this.activeRepo.owner, this.activeRepo.name, this.activeCommit.fullSha, destPath);
          console.log(`${COLORS.green}✅ Downloaded source successfully to: ${destPath}\n${COLORS.reset}`);
        } catch (err) {
          console.error(`${COLORS.red}❌ Download failed: ${err.message}\n${COLORS.reset}`);
        }
        continue;
      }

      if (userInput.toLowerCase() === "repos") {
        const selectedRepo = await this.showRepoSelector();
        if (selectedRepo) {
          this.activeRepo = selectedRepo;
          try {
            console.log(`\n${COLORS.cyan}⏳ Fetching recent commits for ${selectedRepo.name}...${COLORS.reset}`);
            const commits = await fetchGitHubCommits(this.token, selectedRepo.owner, selectedRepo.name);
            const selectedCommit = await this.showCommitSelector(commits, selectedRepo.name);
            
            if (selectedCommit) {
              this.activeCommit = selectedCommit;
              console.log(`\n${COLORS.cyan}⏳ Downloading file structure and code diffs for context awareness...${COLORS.reset}`);
              const tree = await fetchRepoTree(this.token, selectedRepo.owner, selectedRepo.name, selectedCommit.fullSha);
              const details = await fetchCommitDetails(this.token, selectedRepo.owner, selectedRepo.name, selectedCommit.fullSha);
              
              const treeStr = tree.join('\n');
              let filesStr = details.files.map(f => `--- File: ${f.filename} (Status: ${f.status}) ---\nAdditions: ${f.additions} | Deletions: ${f.deletions}\nPatch/Diff:\n${f.patch}`).join('\n\n');
              
              if (filesStr.length > 8000) {
                filesStr = filesStr.substring(0, 8000) + "\n\n...[Warning: Log truncated due to size. Some diff patches could be missing from this log.]";
              }

              const systemContext = `I have selected the repository: ${selectedRepo.name} (Owner: ${selectedRepo.owner}). Current selected commit: ${selectedCommit.sha} - ${selectedCommit.message}.

[REPOSITORY FILE STRUCTURE AT COMMIT]
${treeStr}

[COMMIT CHANGES / CODE DIFFS]
${filesStr}

Please acknowledge this selection in a maximum of 3 sentences, giving a brief summary of what codebase files were touched or updated in this commit.`;
              const response = await this.sendMessage(systemContext);
              console.log(`\n${COLORS.green}Assistant: ${COLORS.reset}${response}\n`);
            }
          } catch (err) {
            console.error(`\n${COLORS.red}Failed to fetch context: ${err.message}${COLORS.reset}\n`);
          }
        }
        continue;
      }

      if (!userInput.trim()) {
        continue;
      }
      
      if (userInput.toLowerCase() === "status") {
        try {
          const diff = execSync("git diff").toString();
          if (!diff) {
            console.log(`\n${COLORS.yellow}No uncommitted changes found locally.${COLORS.reset}\n`);
            continue;
          }
          const prompt = `Please review these uncommitted local changes and explain what has been modified, potential bugs, or suggest a good commit message:\n\n${diff.substring(0, 5000)}`;
          console.log(`\n${COLORS.cyan}⏳ Analyzing local uncommitted changes...${COLORS.reset}`);
          const response = await this.sendMessage(prompt);
          console.log(`\n${COLORS.green}Assistant: ${COLORS.reset}${response}\n`);
        } catch (e) {
          console.error(`\n${COLORS.red}Failed to read git status locally. Are you in a git repo?${COLORS.reset}\n`);
        }
        continue;
      }
      
      if (userInput.toLowerCase() === "issues") {
        if (!this.activeRepo) {
          console.log(`${COLORS.yellow}No active repository. Please type 'repos' first.\n${COLORS.reset}`);
          continue;
        }
        try {
          const issues = await fetchRepoIssues(this.token, this.activeRepo.owner, this.activeRepo.name);
          const issueStr = issues.length > 0
            ? issues.map(i => `#${i.number} (${i.user}): ${i.title}`).join('\n')
            : "No open issues.";
          const prompt = `Here are the latest open issues for ${this.activeRepo.name}:\n\n${issueStr}\n\nPlease act as a PM and summarize these issues.`;
          console.log(`\n${COLORS.cyan}⏳ Fetching and summarizing issues...${COLORS.reset}`);
          const response = await this.sendMessage(prompt);
          console.log(`\n${COLORS.green}Assistant: ${COLORS.reset}${response}\n`);
        } catch (e) {
           console.error(`\n${COLORS.red}Failed to fetch issues: ${e.message}${COLORS.reset}\n`);
        }
        continue;
      }

      try {
        let response = await this.sendMessage(userInput);
        let keepProcessing = true;

        while (keepProcessing) {
          keepProcessing = false;

          if (response.match(/\[?ACTION:SELECT_COMMITS\]?/i)) {
            if (!this.activeRepo) {
              console.log(`\n${COLORS.yellow}Assistant: Please type 'repos' to select a repository first before comparing commits.\n${COLORS.reset}`);
              response = "User has not selected a repository. Tell them to do so.";
            } else {
              console.log(`\n${COLORS.cyan}Assistant requested commit selection for comparison...${COLORS.reset}`);
              const commits = await fetchGitHubCommits(this.token, this.activeRepo.owner, this.activeRepo.name);
              const selectedCommits = await this.showCommitSelector(commits, this.activeRepo.name, true);
              
              if (selectedCommits && selectedCommits.length > 0) {
                console.log(`\n${COLORS.cyan}⏳ Fetching context for ${selectedCommits.length} selected commits...${COLORS.reset}`);
                let multiContext = `The user selected ${selectedCommits.length} commits for analysis:\n\n`;
                for (const sc of selectedCommits) {
                  try {
                    const details = await fetchCommitDetails(this.token, this.activeRepo.owner, this.activeRepo.name, sc.fullSha);
                    let filesStr = details.files.map(f => `--- File: ${f.filename} (Status: ${f.status}) ---\nAdditions: ${f.additions} | Deletions: ${f.deletions}\nPatch:\n${f.patch}`).join('\n\n');
                    if (filesStr.length > 3000) filesStr = filesStr.substring(0, 3000) + "\n\n...[truncated]";
                    multiContext += `[COMMIT: ${sc.sha} - ${sc.message}]\nChanges/Diffs:\n${filesStr}\n\n`;
                  } catch (e) {
                    multiContext += `[COMMIT: ${sc.sha} - ${sc.message}]\nFailed to load diff: ${e.message}\n\n`;
                  }
                }
                multiContext += "Please proceed with analyzing or comparing these commits as requested.";
                response = await this.sendMessage(multiContext);
                keepProcessing = true;
                continue;
              } else {
                response = "User cancelled commit selection or no commits were selected.";
                keepProcessing = true;
                continue;
              }
            }
          }

          const fetchCommitMatch = response.match(/\[ACTION:FETCH_COMMIT:([^\]]+)\]/);
          if (fetchCommitMatch && this.activeRepo) {
            const sha = fetchCommitMatch[1];
            console.log(`\n${COLORS.cyan}⏳ Fetching commit data for ${sha}...${COLORS.reset}`);
            try {
              const details = await fetchCommitDetails(this.token, this.activeRepo.owner, this.activeRepo.name, sha);
              let filesStr = details.files.map(f => `--- File: ${f.filename} (Status: ${f.status}) ---\nAdditions: ${f.additions} | Deletions: ${f.deletions}\nPatch/Diff:\n${f.patch}`).join('\n\n');
              if (filesStr.length > 6000) filesStr = filesStr.substring(0, 6000) + "\n\n...[truncated]";
              const commitPrompt = `I fetched commit ${sha}:\n\nChanges/Diffs:\n${filesStr}\n\nPlease analyze this state or continue with the user's request.`;
              response = await this.sendMessage(commitPrompt);
            } catch (err) {
              const commitPrompt = `I tried to fetch commit ${sha} but failed: ${err.message}.`;
              response = await this.sendMessage(commitPrompt);
            }
            keepProcessing = true;
            continue;
          }

          const readMatch = response.match(/\[ACTION:READ:([^\]]+)\]/);
          if (readMatch && this.activeRepo && this.activeCommit) {
            const fileToRead = readMatch[1];
            console.log(`\n${COLORS.cyan}⏳ Requesting file context: ${fileToRead}...${COLORS.reset}`);
            try {
              const fileContent = await fetchFileContent(this.token, this.activeRepo.owner, this.activeRepo.name, this.activeCommit.fullSha, fileToRead);
              const readPrompt = `I fetched the content for ${fileToRead}:\n\n${fileContent.substring(0, 7000)}\n\n(Truncated if too long). Please continue with the user's initial request.`;
              response = await this.sendMessage(readPrompt);
            } catch (err) {
              const readPrompt = `I tried to fetch ${fileToRead} but failed: ${err.message}. Please inform the user or try another file.`;
              response = await this.sendMessage(readPrompt);
            }
            keepProcessing = true;
            continue;
          }

          const execMatch = response.match(/\[ACTION:EXECUTE:([^\]]+)\]/);
          if (execMatch) {
            const cmd = execMatch[1];
            console.log(`\n${COLORS.cyan}🔧 Executing: ${cmd}...${COLORS.reset}`);
            try {
              const output = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
              const outputStr = output ? output.trim() : "Success (no output)";
              const execPrompt = `I executed \`${cmd}\`. Terminal output:\n\n${outputStr.substring(0, 5000)}\n\nPlease continue answering the user.`;
              response = await this.sendMessage(execPrompt);
            } catch (err) {
              let errOut = err.stderr || err.stdout || err.message;
              if (Buffer.isBuffer(errOut)) errOut = errOut.toString("utf8");
              const execPrompt = `I tried to execute \`${cmd}\` but it failed with error:\n\n${String(errOut).trim().substring(0, 5000)}\n\nPlease inform the user and tell them what went wrong.`;
              response = await this.sendMessage(execPrompt);
            }
            keepProcessing = true;
            continue;
          }
        }
        
        const patchMatch = response.match(/\[ACTION:PATCH:([^\]]+)\]([\s\S]*)/);
        if (patchMatch) {
            const fileToPatch = patchMatch[1];
            const content = patchMatch[2].trim();
            try {
                fs.writeFileSync(path.resolve(process.cwd(), fileToPatch), content);
                console.log(`\n${COLORS.green}✅ Assistant successfully patched file: ${fileToPatch}${COLORS.reset}\n`);
                response = `Applied the patch to ${fileToPatch}.`;
            } catch (e) {
                response = `Failed to write patch: ${e.message}`;
            }
        }

        if (response.includes("[ACTION:DOWNLOAD]")) {
          if (!this.activeRepo || !this.activeCommit) {
            console.log(`\n${COLORS.yellow}Assistant: I cannot download because no repository or commit is selected. Please type 'repos' first.\n${COLORS.reset}`);
            continue;
          }
          console.log(`\n${COLORS.cyan}Assistant: Executing download sequence for ${this.activeRepo.name}...${COLORS.reset}`);
          try {
            const filename = `${this.activeRepo.name}-${this.activeCommit.sha}.zip`;
            const destPath = path.join(os.homedir(), "Downloads", filename);
            await downloadCommitArchive(this.token, this.activeRepo.owner, this.activeRepo.name, this.activeCommit.fullSha, destPath);
            console.log(`${COLORS.green}✅ Downloaded source successfully to: ${destPath}\n${COLORS.reset}`);
          } catch (err) {
            console.error(`${COLORS.red}❌ Download failed: ${err.message}\n${COLORS.reset}`);
          }
        } else {
          // Extra step: forcibly strip any residual markdown the LLM might have ignored
          const cleanResponse = response
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/```(?:[a-zA-Z0-9]+)?\n(.*?)\n```/gs, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^#+\s+/gm, '')
            .trim();
          console.log(`\n${COLORS.green}Assistant: ${COLORS.reset}${cleanResponse}\n`);
        }
      } catch (error) {
        console.error(`\n${COLORS.red}Error: ${error.message}${COLORS.reset}\n`);
      }
    }
  }

  async showRepoSelector() {
    return new Promise((resolve) => {
      const repos = this.repositories;
      if (repos.length === 0) {
        console.log("No repositories found.\n");
        resolve();
        return;
      }

      let selected = 0;
      let pageSize = 10;
      const displayRepos = () => {
        let page = Math.floor(selected / pageSize);
        let start = page * pageSize;
        let end = Math.min(start + pageSize, repos.length);
        process.stdout.write('\x1Bc');
        console.log(`Your Repositories (Page ${page + 1}/${Math.ceil(repos.length / pageSize)})`);
        console.log("Use Up/Down to navigate, Left/Right for pages, Enter to select, Ctrl+C to exit:\n");
        for (let i = start; i < end; i++) {
          const repo = repos[i];
          if (i === selected) {
            console.log(`\x1b[36m> ${repo.name}\x1b[0m`);
          } else {
            console.log(`  ${repo.name}`);
          }
        }
      };

      displayRepos();

      const stdin = process.stdin;
      if (!stdin.isTTY) {
        resolve();
        return;
      }

      const onKeyPress = (ch, key) => {
        if (key && key.ctrl && key.name === 'c') {
          process.exit();
        } else if (key && key.name === 'up') {
          selected = (selected - 1 + repos.length) % repos.length;
          displayRepos();
        } else if (key && key.name === 'down') {
          selected = (selected + 1) % repos.length;
          displayRepos();
        } else if (key && key.name === 'left') {
          let page = Math.floor(selected / pageSize);
          if (page > 0) {
            selected = (page - 1) * pageSize;
            displayRepos();
          }
        } else if (key && key.name === 'right') {
          let page = Math.floor(selected / pageSize);
          if (page < Math.floor((repos.length - 1) / pageSize)) {
            selected = Math.min((page + 1) * pageSize, repos.length - 1);
            displayRepos();
          }
        } else if (key && key.name === 'return') {
          stdin.removeListener("keypress", onKeyPress);
          stdin.setRawMode(false);
          const selectedRepo = repos[selected];
          console.log(`\nSelected: ${selectedRepo.name}`);
          console.log(`URL: ${selectedRepo.url || "N/A"}\n`);
          resolve(selectedRepo);
        }
      };

      stdin.on("keypress", onKeyPress);
      stdin.setRawMode(true);
      stdin.resume();
    });
  }

  async showCommitSelector(commits, repoName, isMultiSelect = false) {
    return new Promise((resolve) => {
      if (!commits || commits.length === 0) {
        console.log(`No commits found for ${repoName}.\n`);
        resolve();
        return;
      }

      let selected = 0;
      let pageSize = 10;
      let selectedSet = new Set();
      
      const displayCommits = () => {
        let page = Math.floor(selected / pageSize);
        let start = page * pageSize;
        let end = Math.min(start + pageSize, commits.length);
        
        process.stdout.write('\x1Bc');
        console.log(`Recent commits for ${repoName} (Page ${page + 1}/${Math.ceil(commits.length / pageSize)})`);
        if (isMultiSelect) {
            console.log("Use Up/Down to navigate, Space to toggle selection, Enter to confirm, Ctrl+C to exit:\n");
        } else {
            console.log("Use Up/Down to navigate, Left/Right for pages, Enter to select, Ctrl+C to exit:\n");
        }
        for (let i = start; i < end; i++) {
          const commit = commits[i];
          const commitText = `[${commit.sha}] ${commit.message} - ${commit.author} (${new Date(commit.date).toLocaleDateString()})`;
          let prefix = "  ";
          if (isMultiSelect) {
              prefix = selectedSet.has(i) ? "[*] " : "[ ] ";
          }
          
          if (i === selected) {
            console.log(`\x1b[36m> ${prefix}${commitText}\x1b[0m`);
          } else {
            console.log(`  ${prefix}${commitText}`);
          }
        }
      };

      displayCommits();

      const stdin = process.stdin;
      if (!stdin.isTTY) {
        resolve(commits[0]);
        return;
      }

      const onKeyPress = (ch, key) => {
        if (key && key.ctrl && key.name === 'c') {
          process.exit();
        } else if (key && key.name === 'up') {
          selected = (selected - 1 + commits.length) % commits.length;
          displayCommits();
        } else if (key && key.name === 'down') {
          selected = (selected + 1) % commits.length;
          displayCommits();
        } else if (isMultiSelect && (ch === ' ' || (key && key.name === 'space'))) {
          if (selectedSet.has(selected)) {
            selectedSet.delete(selected);
          } else {
            selectedSet.add(selected);
          }
          displayCommits();
        } else if (key && key.name === 'left') {
          let page = Math.floor(selected / pageSize);
          if (page > 0) {
            selected = (page - 1) * pageSize;
            displayCommits();
          }
        } else if (key && key.name === 'right') {
          let page = Math.floor(selected / pageSize);
          if (page < Math.floor((commits.length - 1) / pageSize)) {
            selected = Math.min((page + 1) * pageSize, commits.length - 1);
            displayCommits();
          }
        } else if (key && key.name === 'return') {
          stdin.removeListener("keypress", onKeyPress);
          stdin.setRawMode(false);
          
          if (isMultiSelect) {
            if (selectedSet.size === 0) {
                selectedSet.add(selected);
            }
            const selectedCommits = Array.from(selectedSet).map(idx => commits[idx]);
            console.log(`\nSelected ${selectedCommits.length} commits for comparison.`);
            resolve(selectedCommits);
          } else {
            const selectedCommit = commits[selected];
            console.log(`\nSelected Commit: ${selectedCommit.sha}`);
            resolve(selectedCommit);
          }
        }
      };

      stdin.on("keypress", onKeyPress);
      stdin.setRawMode(true);
      if (stdin.isPaused()) {
        stdin.resume();
      }
    });
  }
}

export async function startChatSession(token, username, providerOverride, modelOverride) {
  const chatService = new ChatService(token, providerOverride, modelOverride, username);
  await chatService.initializeRepoContext();
  await chatService.startInteractiveChat();
}
