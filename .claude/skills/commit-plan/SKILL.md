---
name: commit-plan
description: Plan how to split the current uncommitted work into commits and write each message in Conventional Commits. Use after finishing an implementation, when the user asks how to split/group commits, for a commit message, or invokes /commit-plan. Read-only — it answers with text and never runs a git write command.
---

# Commit plan

Read the pending work, group it into the smallest set of commits that each stand
on their own, and answer with the file list and the finished message for each
one. The user runs the commands; this skill only writes the plan.

## Hard rule: no git writes, ever

Allowed: `git status`, `git diff`, `git diff --stat`, `git log`, `git show`,
`git stash list`, `git blame`, and reading files.

Never run — not even when asked mid-task, not "just to check": `add`, `commit`,
`restore`, `checkout`, `switch`, `reset`, `stash push/pop`, `rm`, `mv`, `apply`,
`rebase`, `cherry-pick`, `push`, `tag`, `clean`, `branch`, or any command that
opens a PR. If the user asks for the commit to be made, say this skill only
plans and hand them the commands to paste.

## Gathering

```bash
git status --porcelain=v1
git diff --stat HEAD
git diff HEAD            # plus `git diff --cached` if something is staged
```

Untracked files do not appear in `git diff HEAD` — read them directly. Read the
actual diff of every file, not just the stat: the grouping and the bodies depend
on *what* changed, and a path name does not tell you.

## Learn this repo's conventions first

Before writing a single message, read the history and copy what is there:

```bash
git log --format='%s%n%b%n---' -20
```

Take from it:

- **Scopes** — whether they are used at all, and the vocabulary already in play
  (module names, package names, directories, feature areas). Reuse an existing
  scope rather than coining a synonym; if the log has no scopes, do not add them.
- **Type vocabulary** — which of `feat` / `fix` / `refactor` / `test` / `docs` /
  `build` / `chore` / `perf` / `ci` / `style` this repo actually uses.
- **Language** — write subjects and bodies in the language of the log, even when
  the conversation or the code comments are in another one.
- **Subject style** — imperative vs. past tense, capitalisation, length.
- **Body habits** — prose or bullets, and the vocabulary the project reaches for.
  Take *style* from the log, never *length*. A history full of essay-length
  bodies does not license one more: the cap below wins over the log, always.

If the log is empty, or inconsistent enough that there is no convention to
follow, use the defaults below and say in one line that you picked them.

## Grouping

One commit = one reason to change. Order them so each one could be the tip of
the branch: it builds, tests pass, nothing references something that lands later.

- A schema or interface change ships with the migration and the generated code it
  implies. Generated or derived files that are checked in — clients, lockfiles,
  snapshots, compiled output — go with the change that regenerates them, never in
  a commit of their own.
- Code and the tests that cover it go together, unless the tests are the point of
  the change (then a test commit on its own).
- A fix found while building a feature is its own fix commit, placed before the
  feature when the feature builds on it.
- A rename or extraction that only moves code is its own refactor commit, placed
  first so the feature diff stays readable.
- Docs that describe the change ship with it; docs that stand alone go in their
  own docs commit.
- Dependency changes ride with the commit that needs them, or stand alone when
  nothing uses them yet.

Do not invent commits to look tidy. If the work is genuinely one change, say so
and give one commit.

**When one file holds two unrelated changes**, say so explicitly, name the
function or line range for each side, and point the user at `git add -p` — do not
pretend the file can only go in one commit.

## Message format

```
<type>(<scope>)<!>: <subject>

<body, only when needed>

<footers>
```

- **type**: pick by what the commit does to the software's behaviour, not by
  which directory it touched.
- **scope**: as the repo already uses them (see above). Omit it when the change
  is repo-wide or when the project does not use scopes.
- **subject**: imperative, no trailing period, ≤72 chars. Say the effect, not the
  mechanics: "stop the user directory leaking profiles", not "change the select
  in the user repository".

## Bodies: short, and only when the diff needs one

> **Hard cap: 4 lines.** Not a target to fill — a ceiling most commits come in
> under, and most come in at zero.

An overlong body is the most common way this skill goes wrong. Right after an
implementation the whole investigation is fresh and wants retelling, and almost
none of it belongs in the message. The reader has the diff; give them only the
one thing the diff cannot tell them.

Default to no body. Add one only when the diff leaves a real question open:

- the change is not obviously correct, or looks wrong until you know why
- a plausible simpler approach was rejected
- something broken is being fixed and the failure mode is not visible in the diff
- something was deliberately left out, or a known limitation remains
- behaviour changes for an existing caller

Pick the single strongest of those and write only that. If two of them feel
equally essential, the commit is probably two commits.

Skip the body when the subject already covers it: a new endpoint or feature flag,
a test added for existing behaviour, a dependency bump, a rename, a typo.

When there is a body: **at most 4 lines**, wrapped at 72 columns, prose (bullets
only for a genuine list of independent items). Explain **why**, never restate the
file list — the diff is right there. No "this commit", no filler like "improves
maintainability".

Leave out, every time — this is what the 4 lines are protecting:

- the root-cause story, and which commit introduced the bug
- the symptom walked through step by step
- test output, verification steps, literal ids or ranks
- what you deliberately left alone, unless a caller has to act on it
- anything the subject already says

Those belong in the conversation, a code comment or an issue, not here.

**Before answering, count the lines of each body.** Over four, cut something out
— never reflow to fit.

## Footers

Only footers the Conventional Commits spec defines, plus any this repo's log
already shows (an issue reference, a tracker id). Never add an attribution,
trailer or co-author line, whoever wrote the change.

A breaking change is indicated in **one** of the two ways the spec allows, not
necessarily both:

- `!` before the colon (`fix(api)!: ...`), which makes the footer optional, or
- a `BREAKING CHANGE: <what callers must change>` footer.

Prefer `!` on its own when the subject already says what breaks. Add the footer
too when a caller needs the specifics — which fields vanished, which parameter is
now required — and keep it to the facts a caller has to act on.

## Answer shape

For each commit, in the order they should be made: a heading with the number and
the subject, the file list (paths, one per line, with `(new)` / `(deleted)` where
it applies), then the full message in a fenced block ready to copy, body and
footer included when they apply.

Close with anything the user has to decide: a file that needs `git add -p`, a
commit whose type is arguable, a change that looks unfinished. Keep it to a few
lines. Nothing else — no summary of the implementation, no next steps, no offer
to run the commands.
