#!/usr/bin/env python3
"""
ai_provider.py -- the one place an AI call leaves this machine.

Two providers sit behind the same two calls, so nothing else in the app has to
know which one answered:

  claude_cli  the Claude Code CLI already installed here. It is signed in with
              your Claude subscription, so there is no API key to keep and no
              per-call bill. The cost is elsewhere: a call is a subprocess, so
              it answers in seconds rather than milliseconds, and the CLI
              cannot enforce a response schema, so the shape is written into
              the prompt and the answer is parsed leniently.
  gemini      the Google API, which needs GEMINI_API_KEY and does enforce a
              schema. lead_desk_app.py owns that path; this module only reports
              whether it is the one selected.

AI_PROVIDER in .env picks one. With nothing set, the CLI wins when it is on
PATH, because it needs no key.

Reading a DM screenshot goes through the same switch. The CLI has no inline
image part, so the picture is read off disk with its Read tool, which is why
that call gets --allowedTools and an --add-dir for the folder holding it, and
nothing else.
"""

import json
import os
import re
import shutil
import subprocess

DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_TIMEOUT = 240
# A text prompt is one turn. Reading a screenshot costs a Read before the
# answer, and room for a second look when the first read comes back thin.
TEXT_TURNS = 1
IMAGE_TURNS = 6


def setting(config, key, default=""):
    value = (config or {}).get(key)
    if value is None or str(value).strip() == "":
        value = os.environ.get(key, "")
    return str(value).strip() or default


def binary(config):
    """The claude executable, or an empty string when it is not installed."""
    pinned = setting(config, "CLAUDE_BIN")
    if pinned:
        return pinned if os.path.isfile(pinned) else ""
    return shutil.which("claude") or ""


def chosen(config):
    """Which provider answers: 'claude_cli' or 'gemini'."""
    asked = setting(config, "AI_PROVIDER").lower().replace("-", "_")
    if asked in ("claude", "claude_cli", "cli", "subscription"):
        return "claude_cli"
    if asked in ("gemini", "google"):
        return "gemini"
    return "claude_cli" if binary(config) else "gemini"


def model_for(config, vision=False):
    if vision:
        pinned = setting(config, "CLAUDE_VISION_MODEL")
        if pinned:
            return pinned
    return setting(config, "CLAUDE_MODEL", DEFAULT_MODEL)


def timeout_for(config):
    try:
        return max(30, int(float(setting(config, "CLAUDE_TIMEOUT",
                                         str(DEFAULT_TIMEOUT)))))
    except ValueError:
        return DEFAULT_TIMEOUT


# ------------------------------------------------------------ the schema ---

def schema_hint(schema):
    """The response schema as a line of JSON the prompt can carry.

    The CLI takes no responseSchema, so the only way to ask for a shape is to
    show it. Types are spelled out rather than exemplified, because an example
    value is something a model will happily copy into its answer.
    """
    def render(node):
        kind = (node or {}).get("type", "string")
        if kind == "object":
            return "{%s}" % ", ".join(
                '"%s": %s' % (key, render(value))
                for key, value in (node.get("properties") or {}).items())
        if kind == "array":
            return "[%s]" % render(node.get("items") or {})
        if kind == "boolean":
            return "true|false"
        if kind in ("number", "integer"):
            return "<number>"
        return "<string>"

    shape = render(schema)
    required = (schema or {}).get("required") or []
    if required:
        shape += "\nThese keys must be present: " + ", ".join(required)
    return shape


def loads_loose(text):
    """Parse JSON that arrived wrapped in a code fence or a sentence."""
    text = (text or "").strip()
    if not text:
        return None
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except ValueError:
            return None
    return None


# --------------------------------------------------------------- the CLI ---

def run_cli(config, prompt, system_text="", model=None, extra_args=(),
            cwd=None, max_turns=TEXT_TURNS):
    """One headless CLI call. Returns the assistant's text."""
    exe = binary(config)
    if not exe:
        raise RuntimeError(
            "the claude CLI is not on PATH, so AI_PROVIDER=claude_cli cannot "
            "run. Install Claude Code, set CLAUDE_BIN in .env, or set "
            "AI_PROVIDER=gemini.")

    args = [exe, "-p",
            "--output-format", "json",
            "--model", model or model_for(config),
            "--strict-mcp-config",          # no project MCP servers to wait on
            "--max-turns", str(max_turns)]
    if system_text:
        # Replaces the CLI's own coding-agent preamble rather than appending to
        # it: this is a lead desk, and that preamble is both irrelevant here
        # and the larger half of the token bill.
        args += ["--system-prompt", system_text]
    args += list(extra_args)

    try:
        done = subprocess.run(
            args, input=prompt, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout_for(config),
            cwd=cwd or None)
    except subprocess.TimeoutExpired:
        raise RuntimeError("the claude CLI did not answer within %ds"
                           % timeout_for(config))
    except OSError as err:
        raise RuntimeError("could not run the claude CLI: %s" % err)

    if done.returncode != 0:
        detail = (done.stderr or done.stdout or "").strip().splitlines()
        raise RuntimeError("the claude CLI exited %d: %s"
                           % (done.returncode,
                              detail[-1][:200] if detail else "no output"))

    envelope = loads_loose(done.stdout)
    if not isinstance(envelope, dict):
        raise RuntimeError("the claude CLI did not return JSON: %s"
                           % (done.stdout or "")[:200])
    result = envelope.get("result")
    if envelope.get("is_error"):
        raise RuntimeError("the claude CLI reported an error: %s"
                           % str(result)[:200])
    if not str(result or "").strip():
        raise RuntimeError("the claude CLI returned an empty answer")
    return str(result)


def json_call(config, system_text, user_text, schema, model=None,
              extra_args=(), cwd=None, max_turns=TEXT_TURNS):
    """A CLI call that has to come back as one JSON object.

    One retry, and it quotes what came back the first time, because the usual
    failure is prose wrapped around otherwise correct JSON.
    """
    ask = "%s\n\nReturn ONLY one JSON object, no prose and no code fence, in " \
          "exactly this shape:\n%s" % (user_text, schema_hint(schema))
    first = run_cli(config, ask, system_text, model, extra_args, cwd, max_turns)
    parsed = loads_loose(first)
    if isinstance(parsed, dict):
        return parsed

    retry = "%s\n\nYour previous answer could not be parsed as JSON. It " \
            "began:\n%s\n\nAnswer again with the JSON object alone." \
            % (ask, first[:400])
    parsed = loads_loose(run_cli(config, retry, system_text, model, extra_args,
                                 cwd, max_turns))
    if isinstance(parsed, dict):
        return parsed
    raise RuntimeError("the claude CLI did not return JSON: %s" % first[:300])


def read_image(config, image_path, prompt, schema):
    """Read one screenshot through the CLI's own Read tool.

    The file is named relative to its folder and that folder is the working
    directory, so the tool grant covers the folder holding the screenshots and
    nothing above it.
    """
    image_path = os.path.abspath(image_path)
    folder = os.path.dirname(image_path)
    name = os.path.basename(image_path)
    return json_call(
        config,
        "You read one screenshot and return JSON. Read the file you are given, "
        "answer from what is visible in it, and never guess at something the "
        "picture does not show.",
        "Read the image file ./%s in this folder, then answer this:\n\n%s"
        % (name, prompt),
        schema,
        model=model_for(config, vision=True),
        extra_args=["--allowedTools", "Read", "--add-dir", folder],
        cwd=folder,
        max_turns=IMAGE_TURNS)


def health(config):
    """What the app's status bar should say about the AI."""
    provider = chosen(config)
    if provider != "claude_cli":
        return {"provider": "gemini", "ok": True, "model": "",
                "vision_model": "", "note": ""}
    exe = binary(config)
    return {
        "provider": "claude_cli",
        "ok": bool(exe),
        "model": model_for(config),
        "vision_model": model_for(config, vision=True),
        "binary": exe,
        "note": ("your Claude subscription, through the CLI at %s" % exe)
                if exe else "the claude CLI is not on PATH",
    }


if __name__ == "__main__":
    import sys
    conf = {}
    print(json.dumps(health(conf), indent=2))
    if len(sys.argv) > 1:
        print(json.dumps(json_call(
            conf, "You answer in JSON.", " ".join(sys.argv[1:]),
            {"type": "object", "properties": {"answer": {"type": "string"}},
             "required": ["answer"]}), indent=2))
