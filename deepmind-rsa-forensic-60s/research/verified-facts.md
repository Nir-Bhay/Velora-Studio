# Verified facts: DeepMind RSA-1024 film (forensic edition)

Status: partial. Facts were checked against the two working papers (section numbers below) and search-result excerpts of the papers.
PDF page numbers are NOT yet verified. Every row marked "section" needs a page number before publication.

Papers:
- P1: "Modular Roots from a Restricted Oracle: Faster Affine Roots and a 1024-bit Computation" (GDM working paper). https://storage.googleapis.com/deepmind-media/papers/Faster_Affine_Root_and_a_1024bit%20Computation.pdf
- P2: "Fan Factories: Multiple Number Fields in Factorization Factories and Batch NFS" (dated Nov 5, 2026). https://storage.googleapis.com/deepmind-media/papers/Fan_Factories_Multiple_Number_Fields_in_Factorization_Factories_and_Batch_NFS.pdf

Type key: MEASURED = experimental run. PROVEN = mathematical result inside the paper's model. HEURISTIC = leading-order estimate under standard NFS heuristics. ESTIMATE = projected, not run.

| # | Statement (on-screen or narration) | Source | Type | Limitation | Approved wording |
|---|---|---|---|---|---|
| 1 | A 1024-bit RSA modulus corresponds to a 128-byte block. | P1 §4 (PKCS#1 v1.5 encoding) | PROVEN (definition: 1024 / 8) | None | "128-BYTE RSA-1024 BLOCK" |
| 2 | With PKCS#1 v1.5 formatting and caller-controlled input, the caller controlling about half the block is the boundary the paper analyses. | P1 §4 | PROVEN within the oracle model | Applies to the specific signing interface and attacker-controlled input only | "CALLER-CONTROLLED INPUT" / "ABOUT HALF THE BLOCK" |
| 3 | Above that threshold, the format restriction adds no extra difficulty relative to the unrestricted oracle problem. | P1 §4 | PROVEN within the model | Digests computed inside a device are outside both oracle models | "PADDING ADDS NO EXTRA PROTECTION" (with scope note) |
| 4 | 64-byte digest case sits at the threshold. 32-byte digest leaves a harder affine problem. | P1 §4 | PROVEN within the model | Open: windows below half were not run at any cryptographic size (P1 §7) | "32-BYTE DIGEST" |
| 5 | For the 32-byte-digest case, the affine root cost exponent improves from about 1.8171 to 1.5803. | P1 §3–4 (asymptotic) | HEURISTIC, leading order | Asymptotic exponent, not a runtime | Do not show exponents on screen |
| 6 | DeepMind estimates about a 1,600× reduction in attack cost for the 32-byte-digest 1024-bit case. | P1 §4 and DeepMind announcement | ESTIMATE | Not experimentally run at that key size. Not a measured speed-up | "1,600× · THEORETICAL ESTIMATE" / "NOT EXPERIMENTALLY RUN AT THIS KEY SIZE" |
| 7 | The signature result does not recover the private key and does not factor the modulus. | P1 scope (§1, §7) | PROVEN scope statement | None | Use in the narration scope note only. Do not claim a key was recovered |
| 8 | 1,380 CPU core-years (earlier computation) vs 391 CPU core-years (DeepMind reproduction) for the first root. | P1 §5.3 | MEASURED | Reproduction of an already-solved benchmark. Same algorithm, instance, polynomials and bounds. GPU linear-algebra work is excluded from the CPU figure | "1,380 CPU CORE-YEARS" / "391 CPU CORE-YEARS" |
| 9 | About 3.5× less CPU work (1,380 / 391 ≈ 3.53). Excluding GPU work. | P1 §5.3 | MEASURED | Different hardware. Paper attributes at most about 1.5× (sieve) and 1.2× (second tier) to hardware. Including GPU and rehearsal costs gives about 3.3× (brief) | "MEASURED REPRODUCTION · NOT THE 1,600× RESULT" |
| 10 | 391 is about 28.3% of 1,380. | Arithmetic: 391 / 1380 = 0.2833 | Arithmetic | None | Bar lengths in the animation are drawn to this ratio |
| 11 | 3.2 days elapsed time, from the first full-scale sieving job to the verified root. | P1 §5 | MEASURED (wall-clock) | Elapsed time, not CPU work. Reflects massive parallelism. Not another 3.5× | "3.2 DAYS TO VERIFIED ROOT" (calendar) |
| 12 | About 45,000 active CPU cores on average. Peak about 300,000 CPU cores. 16 GPUs. | P1 §5 | MEASURED | Parallel resources, not CPU work | "UP TO 300,000 CPU CORES · 16 GPUs" |
| 13 | 336 distributed experiments. About 33,500 new lines of code for the 1024-bit run. | P1 §6 | MEASURED (engineering record) | Describes the agent workflow | "336 DISTRIBUTED EXPERIMENTS" |
| 14 | Agent roles: a supervisor and an executor, a specialist sub-agent, and a human researcher who set the objective and approved major gates. | P1 §6 | Description | Human approved gates, not every step | Diagram labels: HUMAN RESEARCHER / MODEL A: SUPERVISOR / MODEL B: EXECUTOR |
| 15 | Four problems found in the online phase were resolved without repeating the oracle batch. | P1 Table 4 | MEASURED (engineering record) | Describes the workflow | Narration does not mention it |
| 16 | Fan Factories: after a precomputation costing about one GNFS run (one factorization), each further 1024-bit integer costs about 1/58 of one GNFS run. | P2 abstract/§1 and §4 table | HEURISTIC, leading order | Assumes standard NFS heuristics. Not a measured runtime | "SHARED SETUP ≈ ONE FACTORIZATION" / "≈ 1/58 OF ONE GNFS RUN" (optional) |
| 17 | About 30× less per further 1024-bit integer than MNFS (the previous batch method), at leading order. | P2 §4 table (MNFS / fan factory = 30) | HEURISTIC, leading order | Under the shared-precomputation assumption. Not implemented | "≈30× · LEADING-ORDER ESTIMATE · NOT IMPLEMENTED" |
| 18 | The brief's "30.2×" figure. | Not found in the excerpts checked | UNVERIFIED | Use "30×" until the page is confirmed | Do not use "30.2" on screen |
| 19 | Without any precomputation, batch gains are at most about 1.75× at 1024 bits. | P2 (from earlier review) | HEURISTIC | Not in the storyboard. Keep as a limitation | Optional scope note |
| 20 | No fan-factory implementation has been built. | P2 (author statement) | Statement | None | "NOT IMPLEMENTED" |
| 21 | A single isolated integer gets no benefit without shared work. | P2 §1 / §4 | HEURISTIC | Do not show shared primes. Shared resource is mathematical preparation, not common secret primes | Show a shared structure, never shared prime factors |
| 22 | 1024-bit RSA is no longer approved for generating signatures (NIST SP 800-131A Rev. 2). | P1 scope (as stated by the paper) | Citation as stated in the paper | Confirm against NIST before publication | Optional |
| 23 | Both papers state that RSA-2048 and larger is not threatened by these results. P2 gives about 2^117 operations for precomputation alone at 2048 bits. | P1 §7, P2 §4 | PROVEN scope statement | Not a claim that RSA-2048+ is secure against every future method | "THESE SPECIFIC FINDINGS DO NOT THREATEN DEPLOYED RSA-2048-OR-LARGER" |

## Things the video must not say
- That the internet, a bank, a messaging app, or any named service was broken.
- That a live RSA key or a private key was recovered.
- That 1,600× or 30× was measured.
- That 391 CPU core-years means a new key was cracked.
- That 3.2 days is a 3.5× calendar-time speed-up.
- That the 30× applies to one isolated target without shared precomputation.

## Open items before publication
- Confirm PDF page numbers for rows 1–23 by reading the PDFs page by page.
- Confirm the "30.2" figure (row 18) or drop it.
- Confirm NIST wording (row 22).
