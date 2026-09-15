# The Harness Engine: turning working knowledge into an AI environment

A spreadsheet can tell you what someone recorded. It rarely tells you why they trust one column more than another, which exception means the usual procedure should stop, or when they would rather make a phone call than send another email.

That knowledge matters when building an AI environment around someone's work. Without it, the system can produce plausible documents while missing the distinctions that make those documents useful.

The Harness Engine is my work on making this knowledge explicit and turning it into a working environment. It combines structured interviews, a recorded account of the work, generation of role-specific instructions, and evaluation and installation procedures. I have developed it through successive versions using Claude Code and AI-assisted implementation.

A *harness*, in this context, is the surrounding arrangement that makes a model useful for a particular job: instructions, tools, reference material, saved state and rules for how they fit together.

## Start with work someone recognises

My research background shaped the discovery process. Ask people to describe their work in general and they can give you a neat account. Put a real document in front of them and the exceptions start to appear.

The engine's interview protocol uses working documents as anchors. It first establishes the person's role, tools, constraints and a map of the work. It then examines individual areas: what triggers the task, what an acceptable output looks like, which rules of thumb matter, and what can go wrong.

A fictional supplier-tracking example makes the distinction concrete. “Track deliveries” is too broad to generate useful instructions. Better questions are:

- Does this date mean dispatch, arrival at the border, or receipt at the warehouse?
- Which source takes priority when two records disagree?
- What evidence is sufficient to tell a colleague that the goods have arrived?
- Which uncertainty should stop the answer and prompt a question?

Each answer changes the behaviour the system should have. The interview is doing requirements work, including the requirements nobody thought to put in a specification.

## Keep the knowledge separate from the generated files

The central design decision is to separate a **corpus** from its **rendering**.

The corpus records what has been learned: a profile, an agreed map of work areas, their workflows and exceptions, and later corrections. The rendering is the particular set of instructions and files generated for a platform.

```text
Interview and working documents
              |
              v
     Corpus: recorded working knowledge
              |
              v
     Generate instructions and components
              |
              v
     Evaluate -> Install -> Try real tasks
              |                     |
              +------ Corrections <-+
                         |
                         v
                    Update corpus
```

This separation makes maintenance more tractable. A platform convention can change without changing the underlying fact that a certain document is authoritative. A new model may need different instructions while the user's exception-handling rule stays the same.

The schema records rules of thumb, exceptions, workflow triggers, expected outputs and failure modes. Corrections have a source, a reason they matter, a status and a record of where they have been encoded. That last link matters: remembering a correction and putting it into effect are separate steps.

The interview exit question is demanding: could a fresh model, given the corpus, recover the important design decisions from the conversation? I treat this as a review question. It is not a guarantee that regeneration will produce equivalent behaviour.

## Choose components after understanding the job

A new role does not automatically require a new agent.

The engine records whether the task needs autonomous dispatch, isolated context, persistent state or step-by-step collaboration. Those answers inform whether a skill, a separate agent or a simpler instruction is appropriate. The person using the environment participates in that choice.

This is partly an engineering decision and partly a usability decision. Every component adds another place where context can be lost, instructions can drift or the user can become unsure what to invoke. There needs to be a reason for that extra machinery.

The same applies to instruction length. Earlier versions used size floors and quotas as proxies for depth. The rework replaced these with a coverage question: where does each important workflow, exception and decision appear? A longer file is useful only when the additional material changes what the system can do.

## Delivery needs evidence at more than one level

The development record contains an instructive installation problem. Generated components existed, but the installed environment did not contain the expected agents, skills and rules in their loading locations. An audit also found a compilation report whose claims were not supported by the output of the compiler it purported to describe.

This led to a more explicit delivery sequence. The engine now contains a structural checker, a procedure for deriving evaluation scenarios from the recorded work, an installation mapping, and a requirement to try scenarios in the installed environment.

These answer different questions:

| Check | Question |
|---|---|
| Structural check | Are the expected files, metadata and references coherent? |
| Loading check | Does the target platform actually discover the intended components? |
| Task scenario | Does the environment handle a relevant piece of work correctly? |
| User review | Is the result useful and understandable to the person doing the work? |

A passing result at one level cannot substitute for the others. This distinction is especially important when the same model can both generate a package and write a persuasive report about it.

The current Claude Code documentation illustrates why loading deserves its own check: plugin metadata and components have specific locations, and a plugin-root `CLAUDE.md` does not load as project context. An installer must account for the chosen installation mode. [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)

## A small reproducible check

The accompanying demonstration runs a snapshot of the engine's existing JavaScript checker against five tiny, synthetic packages. They contain no client material. Each package isolates one condition so the output can be inspected directly.

| Package | What differs | Checker result |
|---|---|---|
| Clean example | Manifest, agent metadata and references follow the fixture's intended layout | No failures or warnings |
| Manifest at root | Manifest placed outside the checker's expected metadata directory | One failure |
| Agent without metadata | Agent lacks required name/description frontmatter | One failure |
| Broken reference | Root instructions reference a nonexistent state file | One failure |
| Nested agent file | Agent uses a nested `AGENT.md` layout | One warning, successful exit |

**Three of the five packages exit with failure.** A fourth produces a warning but exits successfully. The last case is useful because it shows why a successful process exit is insufficient evidence of a clean result: the report still needs to be read.

These are demonstration cases chosen to exercise the checker, not a benchmark of detection accuracy. They measure the supplied script's decisions. They do not launch Claude Code or establish which components a particular runtime version would load. The checker is a snapshot of project policy; the platform's own validation and a loading test remain separate checks.

To reproduce the number, run `node demo/run.cjs` from this directory. It runs the bundled checker over the five fixtures and writes `demo/results.json`; `summary.failed_packages` is `3`, counting child processes that exit with status `1`.

[Code, fixtures and result](demo/README.md)

## Close the loop around what changes

A useful environment will change after its first installation. Someone discovers a better way to phrase an instruction, adds a recurring exception, or changes which document they use. If those corrections exist only in the installed copy, the next regeneration can erase them.

The engine's correction workflow sends that learning back to the corpus. This is the reason for recording both the finding and where it has been encoded. The design aims to make the maintained knowledge outlast a particular generated package.

The implementation includes the schema, interview and generation procedures, JavaScript checks and installation workflow. Full behavioural validation of the latest end-to-end flow remains further work. The direction is concrete: preserve working knowledge, generate the least machinery that serves it, and make each delivery claim correspond to a check someone can inspect.

That is also the connection to [Cyborgism](https://github.com/PetreLaskov/personal-ai-os). Both projects concern continuity. Cyborgism, now developed through Corpus and the knowledge compiler, explores it in my own work; the engine makes it an explicit part of building an environment around someone else's.



By [Petre Laskov](https://github.com/PetreLaskov). Developed and written with AI assistance.

© 2026 Petre Laskov. Shared for portfolio and evaluation purposes. All rights reserved.
