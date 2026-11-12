# 07: Image prompts for every picture the channel needs

These prompts work in **Adobe Firefly** (the safest for commercial use), **Midjourney**, **ChatGPT image generation** or **Ideogram**.
Every prompt is self-contained: copy one, paste it, and generate.

## Four rules first

1. **Generate the artwork, then add the text yourself.** AI tools misspell words and can't use your brand fonts. Every
   prompt here asks for *no text*. Add titles, "TR", "LEDGER #0001" and year stamps afterwards in **Canva or Photopea** using
   **Space Grotesk Bold** (headlines) and **Inter** (small text).
2. **Charts and numbers are never AI.** Every bar, counter and graph in the videos is built in Canva, Resolve or After Effects
   from the real source numbers. An AI chart with made-up proportions would break the channel's one rule.
3. **Don't fake real places.** For "already being built" stories (EP04, EP07, EP10) use **real satellite imagery** (Copernicus
   Sentinel, NASA Earth Observatory) inside the video. The AI art below is for thumbnails and illustrations only, and it's
   deliberately stylized so nobody mistakes it for a photo. If you ever generate something photorealistic of a real place,
   person or event, switch on YouTube's altered content label.
4. **Faceless means no faces.** Silhouettes, hands from behind, or objects only.

## The style anchor (already built into every prompt below)

> flat vector illustration with subtle depth, minimalist editorial style, deep navy blue background (#0B1426), glowing amber
> accents (#FFB020), warm off-white highlights (#F4F1EA), high contrast, clean geometric shapes, soft amber glow, fine film
> grain texture, cinematic lighting, no text, no letters, no numbers, no watermark, no faces

**For Midjourney**, add this at the end of any prompt: `--style raw --no text, letters, words, watermark, faces, people's faces`
and set the aspect ratio with `--ar` (shown on each prompt).
**For Firefly**, choose content type: *Art*, and the aspect ratio in the panel.
**Colors drift.** If the result isn't navy and amber enough, fix it in Canva/Photopea (Adjust → Hue/Saturation, or a navy gradient map), or regenerate.

---

# A. Brand kit

### A1. Profile picture / logo emblem: 800×800 (`--ar 1:1`)

> A minimalist circular emblem logo: a thin glowing amber ring with a short amber horizontal timeline line crossing through its
> center, the line ending in a small bright dot like a marker on a timeline, centered on a solid deep navy blue background
> (#0B1426), amber (#FFB020) and warm off-white (#F4F1EA) only, flat vector, perfectly symmetrical, lots of empty space around
> the emblem, simple enough to read at 48 pixels, no text, no letters, no numbers, no watermark

**Then in Canva:** you can either keep the emblem alone, or put **"TR"** in Space Grotesk Bold, amber, centered inside the ring.
Check how it looks as a small circle. YouTube crops it round.

**Alternative idea (a ledger tick):**

> A minimalist logo icon of a small open ledger book seen from the front, with a single glowing amber check mark rising out of
> its pages like a sunrise, flat vector, deep navy blue background (#0B1426), amber (#FFB020) and off-white (#F4F1EA), centered,
> symmetrical, bold simple shapes readable at small size, no text, no letters, no numbers

### A2. Channel banner: 2560×1440 (`--ar 16:9`, then upscale)

> A wide cinematic panoramic illustration: the curved horizon of planet Earth seen from orbit at night in deep navy blue
> (#0B1426), city lights as tiny amber dots, a single thin glowing amber timeline line arcing across the whole image from left
> to right just above the horizon with small evenly spaced tick marks along it, a faint sunrise glow on the far right edge,
> the CENTER of the image is calm and mostly empty dark sky for text to be placed over, flat vector with subtle depth, fine
> film grain, no text, no letters, no numbers, no watermark

**Then:** upscale to 2560×1440. Add the text **inside the center 1546×423 area** (the only part shown on phones):
"**TOMORROW'S RECORD**" (Space Grotesk Bold, off-white) and "*The future, on the record · New documentary every other Tuesday*" (Inter, amber).

### A3. Watermark: 150×150

Don't generate this. **Export the A1 emblem** at 150×150 on a transparent background (Canva → Download → PNG → Transparent background).
AI art is too detailed at this size.

### A4. The five pillar icons (`--ar 1:1`, one per pillar; generate all five in the same session so they match)

Use the same opening for all five, then change only the subject:

> A single minimalist flat vector icon in a consistent icon set style, thick rounded amber (#FFB020) line art with one
> off-white (#F4F1EA) accent, centered on a solid deep navy blue (#0B1426) square, generous padding, simple bold shapes
> readable at small size, no text, no letters, no numbers — SUBJECT:

| Pillar | Subject to add at the end |
|---|---|
| AI & Work | "a briefcase with a small glowing circuit-board pattern inside it" |
| Cities & Megaprojects | "a construction crane beside three simple skyscraper outlines" |
| Energy & Climate | "a wind turbine and a sun half-rising behind it" |
| Space | "a rocket on a curved launch trajectory around a small moon" |
| Money & Power | "a coin dissolving into small square pixels on one side" |

### A5. Thumbnail master background: 1280×720 (`--ar 16:9`)

> An empty atmospheric background for a YouTube thumbnail: a deep navy blue (#0B1426) gradient getting darker toward the
> edges, a soft amber (#FFB020) glow coming from the right third of the frame, a very subtle fine grid of thin lines
> fading into the dark, fine film grain, clean and minimal, plenty of empty space on the left half, no objects, no text,
> no letters, no numbers, no watermark

**Then:** save it as `thumbnail_master.psd` with locked layers for the year stamp (top-left, amber) and a text area (left half).

### A6. Ledger card background (`--ar 16:9`)

> A single blank paper index card lying flat, centered, seen straight from above, warm off-white paper (#F4F1EA) with very
> subtle paper texture and slightly rounded corners, a thin amber (#FFB020) border line on the left edge, a soft shadow
> underneath, on a solid deep navy blue (#0B1426) background, completely empty card with no writing, no text, no letters,
> no numbers, flat minimal style

**Then:** in Canva, add the fields: `LEDGER #0001` · CLAIM · SOURCE · DATE SAID · CHECK DATE, plus a status stamp.

### A7. Status stamps: RIGHT / PARTLY / WRONG (`--ar 1:1`, generate 3 times, one per color)

> A round rubber ink stamp impression, slightly imperfect ink texture with a few gaps, bold double circular border, empty
> center, single flat color [GREEN #30A46C / AMBER #FFB020 / RED #E5484D] on a transparent or plain white background,
> top-down view, no text, no letters, no numbers

**Then:** remove the background, and add the word (RIGHT / PARTLY / WRONG) in Space Grotesk Bold in the same color, rotated a few degrees.

### A8. End screen background: 1920×1080 (`--ar 16:9`)

> A calm minimal end-screen background: deep navy blue (#0B1426), a thin glowing amber (#FFB020) timeline line running
> horizontally across the lower third, a faint starfield, a soft amber glow in the top-right corner, large empty areas on
> the left and right for video thumbnails to be placed over, fine film grain, no text, no letters, no numbers

### A9. Lower-third / source tag strip (make in Canva, don't generate)

A navy rounded rectangle at 80% opacity with an amber left edge. Text in Inter: `Source: WEF 2025`. AI isn't needed here.

---

# B. Thumbnails (artwork only; add the thumbnail text from `04-episode-packages.md` yourself)

Every thumbnail: **1280×720**, `--ar 16:9`. Keep the left 40% calmer for the text. Make **two versions (A and B)** of each for Test & Compare.

### Trailer: *The Last Normal Decade* · text: **ON THE RECORD**
> A single off-white paper index card floating in deep navy space (#0B1426), glowing at its edges with amber light (#FFB020),
> a thin amber timeline line passing behind it with tick marks, faint stack of blurred cards behind it, minimalist flat
> vector with depth, dramatic soft lighting, card positioned on the right third, no text, no letters, no numbers, no faces

### EP01: *What Happens to Your Job Before 2035* · text: **AM I SAFE?**
> Split composition: on the right, the dark silhouette of an office worker seated at a desk seen from the side, the right half
> of their silhouette dissolving into glowing amber (#FFB020) grid lines and small square particles drifting away, deep navy
> blue background (#0B1426), dramatic rim light, minimalist flat vector illustration, strong contrast, clean empty space on
> the left, no faces, no facial features, no text, no letters, no numbers

**Version B:** *"a single office chair alone under a spotlight, half of the chair dissolving into amber pixels, navy background, same style"*

### EP02: *Every Year From Now Until 2100* · text: **74 YEARS LEFT**
> A long glowing amber (#FFB020) ribbon-shaped timeline curving from the foreground into the far distance over the dark curved
> horizon of Earth, evenly spaced small glowing tick marks along the ribbon, deep navy blue sky (#0B1426), tiny city lights
> below, cinematic perspective, minimalist flat vector with depth, empty space on the left, no text, no letters, no numbers

### EP03: *The 2026 Predictions, Graded* · text: **WHO WAS RIGHT?**
> A school-style report card lying on a dark navy desk (#0B1426), seen at a slight angle, three large ink stamp marks on it,
> one green, one amber, one red, an old newspaper clipping half-tucked underneath, a dramatic desk-lamp light from above,
> minimalist flat vector illustration with depth, card on the right side, no readable writing, no text, no letters, no numbers

### EP04: *Earth in 2050 Is Already Being Built* · text: **UNDER CONSTRUCTION**
> Stylized top-down view of a huge construction site seen from orbit, rendered as a two-tone duotone illustration in deep navy
> (#0B1426) and amber (#FFB020), geometric foundations, roads and cranes as simple shapes, a faint circular satellite
> targeting reticle overlay, minimalist, clearly an illustration not a photograph, no text, no letters, no numbers

### EP05: *The Next 10 Years of AI, Year by Year* · text: **TOO FAST?**
> A large glowing amber (#FFB020) clock face floating in deep navy blue space (#0B1426), its twelve hour marks replaced by small
> glowing dots, both hands pointing almost to the top, faint circuit-board lines radiating outward from the clock, a subtle
> motion blur on the minute hand suggesting speed, minimalist flat vector, dramatic glow, clock on the right third, no text,
> no letters, no numbers

### EP06: *The Cities That Won't Exist by 2075* · text: **SINKING NOW**
> A dense city skyline silhouette cut horizontally by a perfectly straight glowing amber (#FFB020) waterline, the part of the
> city below the line tinted dark navy blue (#0B1426) and slightly distorted as if underwater, small bubbles rising, calm dark
> sky above, minimalist flat vector illustration, strong contrast, no text, no letters, no numbers

### EP07: *The Megaprojects Finishing Before 2040* · text: **SEEN FROM ORBIT**
> Planet Earth at night seen from orbit, deep navy blue (#0B1426), three huge glowing amber (#FFB020) outlined geometric
> structures visible on the surface (a long straight line, a ring, and a grid), thin orbital path line arcing across the
> top, minimalist flat vector with depth, cinematic, no text, no letters, no numbers

### EP08: *What Daily Life Looks Like in 2030* · text: **YOUR TUESDAY**
> A cozy minimalist kitchen at dawn seen from the doorway, everything ordinary and calm in deep navy blue tones (#0B1426),
> a single object on the counter glowing with soft amber (#FFB020) light like a small futuristic device, warm sunrise light
> coming through the window, flat vector illustration with soft depth, quiet and inviting, no people, no text, no letters,
> no numbers

### EP09: *What Your Money Looks Like in 2035* · text: **CASH ENDS?**
> A single generic banknote (no real currency, no portraits, no symbols) floating in deep navy space (#0B1426), its right half
> breaking apart into hundreds of small glowing amber (#FFB020) square pixels drifting away, dramatic lighting, minimalist
> flat vector, banknote on the right third, no text, no letters, no numbers, no faces

### EP10: *Megaprojects Before 2040: Part 2* · text: **EVEN BIGGER**
> A cross-section illustration of the ocean: a calm dark navy (#0B1426) sea surface at the top, and deep below, a long glowing
> amber (#FFB020) tunnel and cable running along the sea floor into the distance, faint fish silhouettes, light rays from
> the surface, minimalist flat vector with depth, no text, no letters, no numbers

### EP11: *Every Space Launch That Matters Until 2036* · text: **MOON AGAIN**
> A close-up of the Moon's surface curving away, rendered in cool grey and deep navy (#0B1426), a glowing amber (#FFB020)
> target marker at the south pole region, a thin amber arc showing a spacecraft trajectory coming in from the top right,
> Earth small in the black sky, minimalist flat vector illustration with depth, no text, no letters, no numbers

### EP12: *5 Possible Futures for 2100* · text: **WHICH ONE?**
> Five glowing amber (#FFB020) paths diverging from a single bright point in the foreground, spreading out across a dark navy
> (#0B1426) landscape toward the horizon, each path ending at a different small distant silhouette (a green forest, a dense
> city, a desert, a flooded town, a city of wind turbines), dramatic perspective, minimalist flat vector, no text, no
> letters, no numbers, no people

### Marathons (Vol. 1 and 2) · text: **3 HOURS** (for example)
> A calm night scene: a small glowing amber (#FFB020) window of a quiet room looking out at a vast deep navy (#0B1426) sky
> where a faint timeline line of tiny stars crosses from left to right, soft dreamy atmosphere, gentle glow, slow and
> peaceful mood, minimalist flat vector, lots of dark empty space, no text, no letters, no numbers, no people

---

# C. Illustrations inside EP01 (the only full script so far)

Charts and numbers in EP01 are made in the editor from the real figures. These prompts are only for illustration scenes. Use `--ar 16:9`.

| Script moment | Prompt |
|---|---|
| **Hook: the globe** (amber dots added in the editor) | *"A dark minimalist globe of planet Earth in deep navy blue (#0B1426) floating in black space, continents outlined with thin warm off-white lines, subtle amber (#FFB020) rim light, flat vector, centered, lots of empty space, no text, no letters, no numbers"* |
| **Beat 1: exposed ≠ replaced** | *"Two identical worker silhouettes side by side at desks, the left one surrounded by soft amber glowing helper shapes like floating tools, the right one partly fading into navy pixels, deep navy background (#0B1426), minimalist flat vector, no faces, no text, no letters, no numbers"* |
| **Beat 4: the farmworkers surprise** | *"A wide field of crops at golden hour rendered in amber (#FFB020) and deep navy (#0B1426), small silhouettes of farmworkers from behind working in rows, a tiny distant office building on the horizon for contrast, minimalist flat vector, no faces, no text, no letters, no numbers"* |
| **Beat 5: same chair, different job** | *"A single empty office chair in the center of a navy room (#0B1426) with small glowing amber skill icons orbiting it (a wrench, a speech bubble, a chart, a lightbulb, a gear), some icons fading out and new ones fading in, minimalist flat vector, no text, no letters, no numbers"* |
| **Beat 6: the three-question icons** | Make these in Canva from the A4 icon style: a hand, a location pin, two people. Or generate: *"Three minimalist amber line icons in a row on deep navy: an open hand, a map location pin, two simple person outlines without faces, consistent thick rounded line style, no text, no letters, no numbers"* |
| **Close: end screen** | Use **A8** |

---

# D. Shorts covers (`--ar 9:16`)

Make one master, then swap the artwork for each Short:

> A vertical minimalist background, deep navy blue (#0B1426) gradient, a thin glowing amber (#FFB020) timeline line running
> vertically down the center with small tick marks, a soft amber glow at the top third, fine film grain, the middle and
> bottom thirds left empty for text and video, no text, no letters, no numbers

---

## Checklist: what to generate first (before launch on 15 Dec)

- [ ] A1 emblem → profile picture plus the A3 watermark export
- [ ] A2 banner
- [ ] A5 thumbnail master
- [ ] A6 ledger card plus the A7 stamps
- [ ] A8 end screen
- [ ] Trailer thumbnail (A and B versions)
- [ ] EP01 thumbnail (A and B versions) plus the 5 EP01 illustration scenes
- [ ] EP02 thumbnail (A and B versions)
- [ ] A4 pillar icons (for playlists and the banner, can wait until week 2)
