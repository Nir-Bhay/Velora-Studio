# Research notes: DeepMind RSA video (60 s)

Every number in the film is listed here with its source and its status. Anything marked "estimate" is
theoretical or leading-order and was not measured on a real key of that size.

## Primary sources

**Paper 1.** "Modular Roots from a Restricted Oracle: Faster Affine Roots and a 1024-bit Computation." Google DeepMind working paper.
Read sections: chunks 0 and 8–10 (chunk 11 duplicates chunk 10).

**Paper 2.** "Fan Factories: Multiple Number Fields in Factorization Factories and Batch NFS." Dated 5 Nov 2026.
Read sections: chunks 0 and 6 of 7.

**Secondary.** DeepMind announcement, 6 Nov 2026 (secondary coverage only; no primary post text was checked
line by line). Used for framing and for the quotes listed below. No independent cryptographer assessment was found.

## Figures used in the film

| On screen | Value | Source | Status |
|---|---|---|---|
| 1,600× | Signature forgery, 1024-bit, leading-order exponent ratio 1.8171 → 1.5803 (offline included) | Paper 1 | **Theoretical estimate.** Our recomputation: ≈1,646×. DeepMind's public figure: ~1,600×. Not run at that key size. Targets a 32-byte digest. Does not recover the private key. |
| ≈30× | Batch factoring, after one-GNFS precomputation, exponent 1.9019 → 1.7929 | Paper 2 | **Theoretical estimate, leading order.** No fan factory has been implemented. Precomputation is roughly one factorization. |
| 1/58 (not on screen) | GNFS 1.9230 → 1.7929, ≈58× | Our recomputation from Paper 2 exponents | Shown here only for transparency. Not on screen. |
| 3.5× | 391 vs ≈1,380 CPU core-years for the first 1024-bit root | Paper 1 | **Measured reproduction** of Shea et al. (SHS+26). Same algorithm and parameters. The 1,380 figure was reported on other hardware. Paper attributes at most ~1.5× (core sieve) and ~1.2× (second tier) to hardware differences. Caveat is on screen. |
| 300,000 CPU cores, 16 GPUs | Peak resources | Paper 1 | Measured run. |
| 3.2 days | Calendar time from first full-scale sieving job | Paper 1 | Measured run. Shea et al. took ~5 months with ~3,300 average cores. |
| 336 experiments, 33,500 new lines | Agent setup | Paper 1, Section 6 | Reported. Human wrote no code. |
| RSA-2048+ not threatened | Stated scope | Both papers | Paper 1: "do not change the security of modern RSA deployments." Paper 2: results do not change RSA-2048+ security. |
| 1024-bit no longer approved for signatures | NIST SP 800-131A Rev. 2 | Paper 1 (cited) | Quoted as cited. |

## Framing rules applied

- The 1,600× is never called "broken" or "cracked". Always "theoretical estimate", always with "not run at this key size".
- The 30× is always "theoretical" and "not implemented".
- The 3.5× is always called a measured reproduction, and always carries the hardware caveat.
- The film never says the internet, banks or TLS were broken. The VO line "This isn't a mass internet breach" is kept verbatim from the brief.
- Signers that hash inside the device are outside both oracle models (Paper 1). The film says "a specific signing interface, not all RSA operations".

## On-screen illustrations (not data)

- The curves on scene 4 are illustrative shapes on a log-style axis. Their gap is drawn to match 1,600× at the right edge. They are not measured data, and the label says so.
- The compute-node grid on scene 6 is decorative. It is not a count of real nodes.

## Open items

- DeepMind's own post text was not checked line by line. Secondary coverage only.
- No independent cryptographer assessment was found.
- Paper 1 notes that windows below half are not run at any cryptographic size. The film does not depend on that case.

## Motion-design research (visual direction)

Consulted 2026 motion-design guidance on vertical short-form video. Points applied:

- Bold scale contrast: key words far larger than supporting words.
- Kinetic type that enters, interacts and exits, with a strong first second.
- Beat-timed typography and marker highlights for emphasis.
- Glitch frames, split screens and pop-up text for energy.
- Keep key content inside platform safe zones, and plan one master animation.

Sources consulted (secondary, for design direction only; no claims in the film depend on them):
- "High-Impact Kinetic Typography Reel" (promptsrush.com), describes beat-synced kinetic type for 9:16.
- "Motion Design Trends 2026: What Actually Matters" (makashif.com), kinetic type and vertical-first video.
- "Video and Motion Creative Trends 2026" (graphicdesignjunction.com), vertical split screens, pop-up text and glitch frames.
