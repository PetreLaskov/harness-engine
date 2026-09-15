# Engine checker demonstration

Run from the article folder:

```sh
node demo/run.cjs
```

Requirements: a maintained Node.js release; no npm install, network, API key or Claude session. Tested runtime is recorded in `results.json`.

## Files

- `lint-harness.cjs`: byte-for-byte snapshot of the existing engine's `scripts/lint-harness.js`, renamed so Node treats it as CommonJS regardless of any parent package configuration.
- `fixtures.json`: five fictional file packages, created for this article.
- `run.cjs`: new harness that materialises each package in a fresh temporary directory and invokes the checker in a separate process.
- `results.json`: full output, exit status, counts, Node version and input hashes from the run.

The temporary files are removed after execution; the result is written beside the script. Existing engine and client files are never used as fixture directories or modified.

## What the number means

`summary.failed_packages` counts runs exiting with status 1. It is 3 for the supplied fixture. Of the two remaining packages, one has a warning and one has neither failures nor warnings.

The result measures the snapshot checker's policy on selected inputs. It is not a detection-accuracy estimate, platform compatibility certification, runtime loading test or evaluation of model behaviour. In particular, this checker treats root-level plugin metadata as a failure and nested `AGENT.md` as a warning; those classifications are the script's choices. Consult current platform documentation and test the actual loading path separately.

Authorship: existing AI-assisted engine code from Petre's project, with a new Codex-assisted fixture and reproduction harness prepared for the accompanying article. No third-party or client documents are included.
