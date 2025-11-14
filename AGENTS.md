RULES for agentic codeing
1) do not try to run a development server
2) do not try to run the linter
3) with every prompt update the TODO.md with the incoming new or changed requirements AND also update the any affected specs inside the specs folder or add new specs when needed
4) put the content of any prompt into the prompt-history folder and for each prompt create a new file inside that folder that has the UTC timestamp as its name followed by an underscore and up to 3 word summary (with dashes as separators) of the prompt so a user can quickly identify what the prompt was about when reading the filename. The file is and .md file with UTC timestamp added on top and the name of the LLM that processed it (copilot, chatGPT, codex, ...).