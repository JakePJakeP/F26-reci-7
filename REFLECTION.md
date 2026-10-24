# Reflection

**Name / Andrew ID:** Jake Pajerski and jakepaje

**Recitation group members (Task 2):** worked alone

---

### 1. Valid but weak

"Returns exactly five colors" passes on the real `matchGuess` and killed none of the public mutants. It is still valid: the spec says the result is one color per position of a five-letter guess. Every public mutant already returns a length-5 array, so the property never fires. It would catch a bug that returned only the green positions, for example `matchGuess('ABCDE', 'ABXYZ')` returning `['G', 'G']` instead of five colors.

### 2. A generator problem, not a property problem

`singlePass` was flaky under the letter-count property. The property matches the spec (a letter cannot be green or yellow more times than the secret contains it). The generator was the problem: five letters drawn from A–Z almost never repeat, and this bug only shows up when an earlier non-match uses up the copy that a later green needed.

Before, with `wordFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ')` for both words:

```
  ~ singlePass     flaky: killed in 3/5 runs  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAAAU","AUAAU"]
      AssertionError: expected 2 to be less than or equal to 1

Mutation score: 3/5 killed (60%)
```

The counterexample is a repeated-letter word the full alphabet only sometimes produced. I kept the same property and changed the generator: most pairs come from the alphabet `ABC`, and one targeted case places a single copy of a letter at a later matching position and also earlier in a non-matching position. After:

```
  ✔ singlePass     killed  by: never credits a letter more times than the secret contains it; assigns leftover yellows from left to right
      Counterexample: [["ZAZZZ","AAZZZ"]]
      AssertionError: expected 2 to be less than or equal to 1

Mutation score: 5/5 killed (100%)
```

### 3. Reading a counterexample

`ignoresCounts`, killed by the letter-count property:

```
Counterexample: [["ZAZZZ","AAZZZ"]]
AssertionError: expected 2 to be less than or equal to 1
```

Secret `ZAZZZ`, guess `AAZZZ`. Position 1 is green, and that green uses the secret's only A. Position 0 is A against Z, so there is no unused A left and the spec says black. The mutant marks it yellow because A occurs somewhere in the secret, which credits A twice.

### 4. Your project

**Function:** Our team's OpenCode progressive debugging hint function, which generates increasingly specific hints based on the student's current hint level and previous hints.

**Property 1 — Invariant:** Each generated hint should provide useful debugging guidance without revealing the complete solution unless explicitly requested. The generator would construct debugging scenarios with different hint levels and solution-request settings. A naive generator might produce arbitrary prompts unrelated to debugging, making it difficult to test whether hints reveal too much.

**Property 2 — Conditional:** If a student requests another hint, the next hint should become more specific without unnecessarily repeating previous guidance. The generator would construct valid debugging interactions with an existing hint history and a request for another hint. A naive generator might generate inconsistent hint histories or invalid progression states that would not occur during normal use.
