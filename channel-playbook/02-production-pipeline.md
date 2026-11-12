# 02: The production pipeline (the same 14-day cycle for every flagship)

Each step names the skill from the pack that does it. The hours are **planning estimates for one person**.
Track your real hours for the first three episodes and adjust.

| Day | Step | Skill / tool | Hours (est.) |
|---|---|---|---|
| 1–2 | **1. Research and the Ledger** | Official sources → `ledger.xlsx` | 6 |
| 3–4 | **2. Script and hooks** | `/yt-script` | 5 |
| 5 | **3. Voice-over** | Audacity + `/yt-edit` | 2 |
| 6–9 | **4. Visuals** | Brand templates, Canva, Blender, stock | 10 |
| 10–11 | **5. Edit** | DaVinci Resolve | 8 |
| 12 | **6. Packaging** | `/yt-package`, `/yt-seo`, `/yt-chapters` | 2 |
| 13 | **7. Upload, schedule, Shorts** | YouTube Studio, `/yt-shorts`, CapCut | 3 |
| 14 | **8. Publish and the first 48 hours** | `/yt-comment` | 1 |
| +7 days | **9. Review** | `/yt-retention`, Studio analytics | 1 |

About 38 hours per flagship, or **about 19 hours a week** on a two-week cycle.

---

## Step 1: Research and the Ledger
1. Open the episode's package in `04-episode-packages.md` and read every listed source. Read the primary document, not the coverage of it.
2. For every number you might use, add a Ledger row: **claim · exact quote · source + link · date it was said · check date**.
3. Anything you can't source doesn't go in the script. That rule is the whole brand.
4. Save screenshots or PDFs of the sources in `research/`, because pages change.

## Step 2: Script and hooks (`/yt-script`)
1. Run `/yt-script` with the topic and the research notes. It writes **five hooks**, scores them with `hookscore.py`, and keeps the top two.
2. Shape every script the same way:
   - **Hook (0:00–0:15):** confirm the title's promise, open a question, and show proof that the payoff exists
   - **Turn (0:15–0:45):** one sentence on what the video will do. No intro, no "subscribe"
   - **Beats:** one idea each, every one with `[ON SCREEN: …]`
   - **Payoff:** deliver what the hook promised, and say that you're delivering it
   - **Ledger:** stamp 2–3 entries on screen
   - **Close:** one ask
3. **Read the whole script out loud** before recording. Rewrite any line you stumble on.
4. Aim for 150 words a minute. 1,500 words is about 10 minutes of voice, which runs to roughly 12–14 minutes once the graphics are in.

## Step 3: Voice-over
1. Record in a small, soft room (a closet full of clothes works). Hold the mic about a fist's width away. Record WAV at 48 kHz.
2. Record each paragraph, pause, then re-record anything you flubbed. Don't stop to fix mistakes as you go.
3. Get a transcript (Whisper, or upload unlisted and download YouTube's captions), then run **`/yt-edit`** on it. It prints the exact cuts: dead air, filler and retakes.
4. Clean the audio: noise reduction (light), EQ, a compressor, then normalize. Optionally run it through Adobe Podcast Enhance.

## Step 4: Visuals
- Every `[ON SCREEN]` line in the script becomes a shot list item. Build them in this order: **numbers (charts) → maps → illustrations → stock**.
- Make every number a **chart or counter** in the brand colors, with a **source tag**.
- **Change the visual at least every 5–8 seconds.** A static image for 20 seconds is a cliff in the retention graph.
- Use **satellite imagery** (Copernicus / Sentinel, NASA Earth Observatory) for "already being built" stories. It's free and it proves the claim.
- If you use **photorealistic AI images of real places, people or events**, switch on the **altered or synthetic content** disclosure when uploading. Since May 2026, YouTube can label undisclosed AI content itself, and repeatedly not disclosing risks penalties. Illustrated or obviously stylized images don't need the label.

## Step 5: Edit (DaVinci Resolve)
Same order every time: **cut, lock, then polish once.**
1. **Assembly:** lay down the clean voice-over first. It is the timeline.
2. **Structure pass:** watch it once at full speed. Wherever you'd click away, cut harder or move that section.
3. **Lock the cut.** No more trimming after this.
4. **Visuals:** drop in the shot list on top of the voice.
5. **Audio:** music at roughly –25 to –30 dB under the voice, ducked further when there's speech; sound effects on transitions (a soft whoosh for the timeline ribbon). Aim for about **–14 LUFS** integrated loudness overall.
6. **Captions:** generate them from the transcript, correct them, and upload the .srt to YouTube as well as burning short ones into Shorts.
7. **Color:** one preset for the whole video.
8. **Export:** 16:9 at 1080p or 4K, H.264 or H.265, high bitrate, 24 or 30 fps (keep it consistent across the channel).

## Step 6: Packaging (`/yt-package`, `/yt-seo`, `/yt-chapters`)
1. **Title and thumbnail as one pair:** `/yt-package` writes 10 titles, lints them, and keeps the best. Rules: under 60 characters (under 40 if you can), no repeated words between the title and thumbnail, at most 3 words on the thumbnail, and a number, name or date.
2. **Thumbnail:** make **two versions** (A and B) from the brief: one strong subject, high contrast, the year stamp, and big text. Check them at phone size, about 160 pixels wide. If you can't read it, start over.
3. **Description and tags:** `/yt-seo`. The first two lines use the words someone would search; then the Ledger line, chapters and sources. Keep tags to about 15 for spellings and names only.
4. **Chapters:** run `/yt-chapters` on the transcript. They must start at 00:00, have at least 3 entries, and run at least 10 seconds each. Rewrite each title as a 3–5 word promise.

## Step 7: Upload and schedule
**YouTube Studio → Create → Upload videos:**
- [ ] Title, description (from the template), thumbnail A
- [ ] Playlist(s): the pillar and Start Here (for the first five flagships)
- [ ] Audience: not made for kids
- [ ] **Altered content:** yes or no (see step 4)
- [ ] Tags, category Education, language, the captions .srt
- [ ] Chapters in the description
- [ ] **End screen:** the next episode, plus the subscribe element. **Cards:** link to related episodes at the moments you mention them
- [ ] **Test & Compare:** add thumbnails A and B (and title variants if your Studio offers it)
- [ ] **Schedule:** Tuesday at 15:00 your local time to begin with. Move it once Studio → Analytics → Audience shows when your viewers are online
- [ ] Prepare the 3 Shorts with `/yt-shorts`: for each, a new first line scored with hookscore, on-screen text, a loop point, and a vertical crop note. Export at 1080×1920. Keep them 20–55 seconds. On each Short, set the **related video** to the full episode

## Step 8: Publish and the first 48 hours
- [ ] Pin a comment that asks the video's question (e.g. "What's your job, and where did you land?")
- [ ] Reply to comments in the first few hours: `/yt-comment` sorts them into questions, corrections, praise and bait, and drafts replies in your voice
- [ ] Post a Community post (a poll works well) linking the video
- [ ] Release the Shorts on day 2, day 4 and day 6

## Step 9: Review (+7 days)
1. Studio → the video → Analytics → Engagement → download **Audience retention**, then run **`/yt-retention`** on it (add `--transcript` to see exactly what was said at each drop).
2. Compare the video's **views at day 7** with your channel's median at day 7 (track this in a sheet from EP01 onwards).

**Decision rules:**

| Signal | Action |
|---|---|
| A video reaches **3× or more** your channel median | Make a **Part 2 or follow-up within 30 days**. Move the next calendar slot back |
| **Hook leak over 25%** (viewers lost in the first 30 seconds) | Rewrite the next video's hook first. Don't touch anything else |
| A **cliff** at one moment | Check what was said there (`--transcript`) and stop doing that thing |
| CTR below your channel median | Let Test & Compare finish. Next time, use `/yt-package` on the pair before upload |
| Hook and retention healthy, views low | It's packaging, not content. Go back to `/yt-package` |
