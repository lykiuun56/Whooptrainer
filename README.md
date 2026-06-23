# Whooptrainer

Personal WHOOP-powered trainer coach app.

## Project Memory

- Owner/user: Yukun.
- Default conversation language: Chinese only.
- Product direction: build a private trainer coach based on WHOOP data plus user-entered context such as training notes, food, mood, soreness, and daily intake.
- Current app: Next.js app deployed on Vercel at `https://whooptrainer.vercel.app`.
- WHOOP OAuth is working and the dashboard can read recovery, sleep, HRV, strain, profile, workouts, and body measurement scopes.
- OpenAI integration exists through the coach ask endpoint.

## Coach Direction

The coach should not only display WHOOP numbers. It should combine:

- WHOOP recovery, HRV, sleep, strain, RHR, and workouts.
- User check-ins: food, mood, soreness, training intent, notes, and perceived effort.
- Long-term memory: profile, goals, injuries, equipment, training preferences, previous sessions, and patterns over time.
- Recovery-aware decisions: low recovery should bias toward easier training, mobility, Zone 2, technique, or rest; high recovery can support harder work.
- Optional RPG/progression layer inspired by `chenklein26-maker/fitness-coach-rpg`: levels, EXP, attributes, and small narrative rewards can be used for motivation, but professional coaching and safety come first.

## Integration From fitness-coach-rpg

Use `chenklein26-maker/fitness-coach-rpg` as a coach-engine reference, not as app code to copy directly.

Borrow these ideas:

- Fitness log: every training day should capture intent, exercises, RPE, soreness, notes, and subjective feedback.
- Recovery rules: WHOOP recovery, HRV, sleep, strain, and user soreness should decide whether to push, build, go light, or recover.
- Long-term continuity: the coach should remember repeated patterns and adjust future recommendations.
- Coach style: strength, hypertrophy, cardio, recovery, and mixed modes can produce different advice.
- RPG layer: optional EXP, levels, and attributes can support motivation, but safety and coaching quality come first.

Current MVP implementation:

- Daily check-ins are stored locally in the browser with `localStorage`.
- The Ask Coach API receives WHOOP data, 7-day trends, rule-based coach output, and the latest check-ins.
- OpenAI answers in Chinese and acts as a recovery-aware private coach.

## Communication Preference

Always speak Chinese with the user unless the user explicitly asks for another language.
