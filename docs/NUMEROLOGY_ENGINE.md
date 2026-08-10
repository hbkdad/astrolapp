# Numerology engine

`packages/numerology-engine`

Numerology traditions disagree with each other. None of the choices below is
"correct" in any external sense, so each is explicit configuration and each is
recorded on the profile it produced.

## Letter values (Pythagorean)

| 1     | 2     | 3     | 4     | 5     | 6     | 7     | 8     | 9   |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | --- |
| A J S | B K T | C L U | D M V | E N W | F O X | G P Y | H Q Z | I R |

## Name normalization

Applied in order, and documented because silently dropping a character changes a
user's number without telling them why:

1. Unicode **NFD** decomposition, then removal of combining marks — `José` → `JOSE`.
2. Whitespace, hyphens, apostrophes (straight and curly), periods, commas,
   underscores and slashes become **word separators** — `Ana-María` → `ANA`,
   `MARIA`; `O'Brien` → `O`, `BRIEN`.
3. Anything still outside `A–Z` is dropped **and reported** in
   `unsupportedCharacters`.

Step 3 matters: a name in a non-Latin script normalizes to nothing. The engine
returns 0 with an explanatory trace rather than a confident number derived from
an empty string, so the UI can ask for a Latin-script spelling.

Word boundaries are preserved because the Y rule depends on them.

## The letter Y

Configurable via `yHandling`:

- **`contextual`** (default) — Y is a vowel when it is _not word-initial_ and the
  preceding letter is _not_ a vowel. So `MARY` and `BRYAN` take Y as a vowel;
  `YOLANDA` and `MOYA` do not.
- `always-vowel` / `always-consonant` — fixed rules for products preferring
  simplicity.

## Reduction and master numbers

Repeated digit summation until a single digit, **stopping early** on a
configured master number (default 11, 22, 33). The master check runs before the
single-digit check, which is what makes 29 → 11 stop at 11 rather than 2.

Every result carries `trace`, showing each intermediate value.

### A subtlety worth knowing

Digit reduction preserves value modulo 9, and 11 ≡ 2, 22 ≡ 4, 33 ≡ 6 (mod 9).
So `preserveMastersInComponents` changes the final answer **only** when the
component sum lands exactly on a master number. For 1989-11-02: preserved gives
11 + 2 + 9 = 22; not preserved gives 2 + 2 + 9 = 13 → 4. For 2000-11-29 both
configurations give 6. Both cases are tested.

## Values

| Value          | Method                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| Life Path      | Month, day and year each reduced **separately**, then summed and reduced |
| Expression     | All letters of the full birth name                                       |
| Soul Urge      | Vowels only                                                              |
| Personality    | Consonants only                                                          |
| Birthday       | Day of month, reduced                                                    |
| Maturity       | Life Path + Expression, reduced                                          |
| Personal Year  | Birth month + birth day + **cycle year**, reduced                        |
| Personal Month | Personal Year + calendar month, reduced                                  |
| Personal Day   | Personal Month + calendar day, reduced                                   |

Life Path uses **component reduction**. Summing every digit of the date in one
pass gives a different answer for some dates; the method is named in the trace so
the difference is visible rather than mysterious.

The **Personal Year turns on the birthday**, not on 1 January. For a 15 May
birthday, a date in March still belongs to the previous cycle year. The trace
states which cycle year was used and why.

## Not yet implemented

Pinnacles, Challenges, Karmic Debt, Balance, Hidden Passion, and the Chaldean
system. `NumerologySystem` is the extension point — Chaldean would be a second
implementation, not a modification of the Pythagorean one. Per the brief, these
are deferred until their methodology is documented rather than guessed.
