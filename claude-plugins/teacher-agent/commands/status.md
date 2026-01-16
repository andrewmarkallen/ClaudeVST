---
description: "Check Teacher agent status"
argument-hint: ""
hide-from-slash-command-tool: "false"
---

# Teacher Agent Status

To check if Teacher is running:

1. Use `/tasks` command to list all running background tasks
2. Look for "Teacher monitoring agent" in the list
3. Check the task output file to see recent activity

**Expected behavior when running:**
- Teacher polls messages/to_claude.json every 2 seconds
- Processes new messages automatically
- Writes responses to messages/from_teacher.json
- Logs activity to task output

**Signs Teacher is working:**
- New messages get automatic responses
- Responses appear in from_teacher.json
- TTS watcher speaks the responses

**If Teacher is not responding:**
- Check if the background task is still running (`/tasks`)
- Check for errors in the task output
- Restart with `/teacher start`
