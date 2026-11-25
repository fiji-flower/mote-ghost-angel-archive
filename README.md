# NACREVOID · Ghost Angel Archive

An editable, build-free artist site for Petal Lucent. The GitHub download contains the site files at its top level. In the hosted development checkout, the same files live in `dist/`.

## Open it

Extract the GitHub ZIP and open `index.html` in a browser. The site uses relative paths and ships with its artwork, display font, and 3D viewer. For a local HTTP preview, run `python -m http.server 8000` in the directory containing `index.html`, then open `http://localhost:8000`.

## Put it on GitHub Pages

1. Create a new repository in your GitHub account.
2. Extract the ZIP. Use **Add file → Upload files** and upload the extracted files and the complete `assets` folder. Place `index.html` at the top level. Commit to your default branch.
3. In **Settings → Pages**, choose **Deploy from a branch**, select your default branch and **/(root)**, and save.
4. Open the site URL shown in Pages when deployment finishes. Future commits to that branch publish your edits.

[GitHub Pages publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Edit the site

| Change | File |
| --- | --- |
| Price, number of slots, artist credit, series, portrait/card size, illustration time, booking destination | `collection.js` |
| Character names, numbered records, captions, artwork paths, image descriptions, and credits | `collection.js` |
| Offer inclusions, exclusions, permanent page copy, and headings | `index.html` |
| Palette, type, chrome finish, glass, breakpoints, and gallery layout | `styles.css` |
| Images and display font | `assets/` |
| The rotating sculpture and its lighting | `mote-viewer.js` |
| Gallery behavior, availability display, character details, and brief export | `archive.js` |

In GitHub, open the file, choose the pencil to edit, then commit. Keep quoted values and their surrounding commas in `collection.js`.

## The first commission release

The initial price is **$55 USD** for one original digital ghost-angel illustration. Each order delivers a **2,400 × 3,000 px portrait PNG** and a **1,500 × 2,100 px numbered collector-card PNG**. The card reuses the portrait and adds the character name and one line of lore.

The buyer chooses one palette and one motif. One small sketch-stage change is included. The **two-hour illustration cap covers both the portrait and card work, including the adjustment**. Suggested studio split: 15 minutes to sketch, 65 to complete the portrait, 15 for the small adjustment, and 25 to lay out and export both files. Agree on a delivery date individually when confirming a slot.

The release covers personal digital use. Physical products, shipping, source files, extra characters or poses, multiple styles, elaborate scenes, additional revisions, and commercial rights fall outside the offer.

### Open or close bookings

`artistEmail` and `bookingUrl` start empty. Visitors can copy or download a local brief. The site collects no money and sends no request on their behalf. Typing in the form stays in the current page until the visitor copies, downloads, or explicitly contacts the studio.

To open inquiries, set your public `artistEmail` or a full HTTPS `bookingUrl` in `collection.js`. A booking link takes precedence when both are filled. On the shop-link path the visitor can copy the brief into your booking page; on the email path the site opens an addressed draft with the brief filled in. A visitor sends the message themselves. Confirm the scope, timing, and payment manually through your preferred service.

The three initial slots are marked `"available"`. With contact unset, their public label reads **Planned**. Set the next slot to `"claimed"` when you personally confirm an order, then commit the file. Once every slot is claimed, the contact link closes and visitors can still keep a brief. There is no automatic reservation or inventory synchronization.

### Add the next collectible

1. Put an image in `assets/`. A square WebP or JPEG around 800 px or larger works well. Use a unique lowercase filename.
2. Duplicate an object in the `entries` array in `collection.js` and keep its separating comma. Assign a unique archive ID and update the name, image, alt text, story, palette, signature detail, and credit.
3. Keep Moté under `Founder` and use `Family` for new relatives. New group names automatically get their own filter. Each record appears once. The site loads six records per batch as visitors scroll. A Load more control also supports keyboard navigation.
4. Give each fulfilled commission its own unique number in your studio records. Add a buyer’s character to the public family gallery only with their permission.

## Artwork and controls

Moté’s sculpted icon takes its sleeping eyelids, fabric form, and raised halo from Petal Lucent’s hand-sewn ghost. The family tableau and six gallery portraits are AI-assisted visual studies for the archive. Replace any study with your own finished work and update its credit in `collection.js`. The website distinguishes these plush-like studies from the digital drawing commission.

Drag the 3D Moté to turn it. With the sculpture focused, use the left/right arrow keys to turn, Home to restore the front view, and Space to pause or resume. It respects the device’s reduced-motion preference. On a phone, open the navigation to reach the motion control. Gallery records and commission briefs support keyboard operation and Escape to close.

The desktop rail stays pinned while the three-column gallery scrolls. At narrow phone widths the archive uses two columns and the rail becomes a compact fixed header.
