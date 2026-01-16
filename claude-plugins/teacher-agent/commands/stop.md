---
description: "Stop Teacher monitoring agent"
argument-hint: ""
hide-from-slash-command-tool: "false"
---

# Stop Teacher Agent

This will stop the background Teacher monitoring agent.

**To stop Teacher:**

1. Use the `/tasks` command to list running background tasks
2. Find the Teacher agent task
3. Use the appropriate command to terminate it (usually Ctrl+C in the background task)

Or if Teacher is running in a separate terminal session, simply close that session.

The Teacher agent should gracefully stop monitoring when terminated.

---

**Alternative:** If Teacher is running as a named background task in Claude Code, you can stop it using task management commands.

Teacher monitoring stopped. Messages will no longer be processed automatically.
