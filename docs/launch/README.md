# Launch playbook

Everything you need to launch the project across multiple channels. **Order matters**: HN first (highest leverage), then Twitter (compounding), then Reddit (drip), then dev.to (long-tail SEO), then LinkedIn (Italian network).

## Day-by-day plan

| Day | Channel | Effort | Expected stars |
|---|---|---|---|
| Mon | Final preparation: social preview image upload, README polish | 30 min | 0 |
| **Tue 14:00** | **Hacker News (Show HN)** — see [HN.md](HN.md) | Engaged for 2h after post | 500–2000 if front page |
| Tue 14:30 | **Twitter thread** — see [TWITTER.md](TWITTER.md) | 30 min posting + replies | 50–200 |
| Wed | LinkedIn post — see [LINKEDIN.md](LINKEDIN.md) | 30 min | 20–50 |
| Thu | r/selfhosted post — see [REDDIT.md](REDDIT.md) | 1h engagement | 30–80 |
| Fri | dev.to article — see [DEV-TO.md](DEV-TO.md) | 2h writing + cross-post | 50–100 long-tail |
| Sat | r/SaaS post | 1h engagement | 20–60 |
| Sun | r/webdev post | 1h | 20–60 |
| Mon (week 2) | r/italyinformatica post | 30 min | 10–30 |

**Realistic total**: 700–2500 stars in week 1 if HN front pages. 200–500 if HN doesn't catch.

## Pre-launch checklist (do these BEFORE Tuesday)

- [ ] Star the repo yourself (seed)
- [ ] Pin `whatsapp-receptionist` on your GitHub profile (Settings → Pinned repositories)
- [ ] Upload `docs/screenshots/social-preview.png` as repo Social Preview (Settings → Social preview)
- [ ] Verify `README.md` looks good on github.com (refresh, check rendering)
- [ ] Verify all docs links in README work
- [ ] Re-verify `npm run verify` is green
- [ ] Mention in your Twitter bio: "Building [whatsapp-receptionist](url) → open source"
- [ ] Update LinkedIn experience to mention the project
- [ ] Have first 5 friendly stars lined up — DM 5 dev friends asking them to star at HN post time

## During-launch checklist

- [ ] Be online for 2 hours after every post
- [ ] Respond to every comment within 15 minutes for the first hour
- [ ] Don't link-spam your own post in other channels mid-thread
- [ ] DON'T sock-puppet upvote (bans are immediate and permanent)
- [ ] Save the URL of every post you make in `docs/launch/POSTS.md` so you can update them later

## Post-launch checklist

- [ ] After 24h: add "As seen on HN/Reddit" section to README if you got 50+ from a single source
- [ ] After 72h: write a short follow-up post on what you learned, link to the original
- [ ] After 1 week: open a "v0.2 priorities" GitHub Discussion to involve the community
- [ ] After 1 month: open the most-upvoted feature requests as issues, tag with `help-wanted`

## Awesome lists to submit (low priority — wait for 100+ stars)

Most awesome list maintainers want a project to have proven traction (100+ stars, active development) before accepting. Wait, then submit:

- `awesome-nextjs` — once you have 100+ stars
- `awesome-supabase` — once you have 50+ stars
- `awesome-self-hosted` — selfhosted-friendly category
- `awesome-italian-projects` — fewer requirements
- `awesome-claude` (if exists) or `awesome-anthropic`

For each: read their CONTRIBUTING.md carefully, follow their PR template exactly, mention specific differentiators in your PR description.

## Channels NOT to use (or use later)

- **ProductHunt** — better for B2C / consumer-facing tools. Open-source dev tools rarely catch.
- **IndieHackers** — fine if you're optimising for community, but smaller audience than HN.
- **Discord servers** — too noisy. Save for later, when you have a community to direct to a Discord.
- **Substack/newsletter outreach** — wait until you have 200+ stars and one merged community PR.

## Post-mortem template (fill in after week 1)

```
Stars after week 1:
HN result (front page Y/N, peak rank, traffic):
Twitter thread metrics (impressions, retweets, profile views):
Reddit best-performing sub:
Top 3 issues opened by community:
First PR received:
Lessons learned:
What I would do differently:
```

Save this to `docs/launch/POST-MORTEM.md` after the dust settles.
