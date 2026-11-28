/* Edit this file on GitHub to update the drop and add ghosts.
   Each entry is one archive record. See README.md for the fields. */
window.MOTE_ARCHIVE = {
  series: "First Light",
  artist: "Petal Lucent",
  offer: {
    priceUSD: 55,
    // One entry per ghost in this release. Use "available" or "claimed".
    // Update this only after confirming an order.
    slots: ["available", "available", "available"],
    // Set either a full https:// booking link or a public artist email to open orders.
    bookingUrl: "https://ko-fi.com/s/2df1ab1b45",
    artistEmail: "",
    // The Cloudflare Worker that keeps a copy of each transmission. Leave empty to turn saving off.
    ritualApi: "https://mote-ghost-angel-archive.1133annasun.workers.dev",
    // How many shared transmissions the wall shows at most.
    wallLimit: 9
  },
  entries: [
    {
      id: "GA-000", name: "Moté", group: "Founder", kind: "Founding ghost",
      image: "assets/mote.webp", tone: "mint",
      // The hand-sewn original, shown whole in a framed print on the card and in the panel.
      realImage: "assets/ghost-angel-mote.jpg",
      realAlt: "Moté, the hand-sewn original, photographed from above with her pink wings spread on a dark table, wire halo and pink flower at her brow.",
      alt: "An ivory ghost with sleepy stitched eyes and a crooked silver halo in a pale mint setting.",
      story: "Before there was a family, there was a scrap of pale fabric, two sleepy stitched eyes, and a halo held on by hand. Moté is the little ghost who started the archive.",
      detail: "Hand-wrapped halo", palette: "Pearl mint",
    },
    {
      id: "GA-001", name: "Velvet Static", group: "Family", kind: "Ghost angel",
      image: "assets/velvet-static.webp", tone: "lilac",
      alt: "A lilac velvet spirit wearing silver hardware and violet bows in a purple miniature set.",
      story: "She naps inside an unplugged amplifier. Put your ear against the velvet and you can hear the last song she loved.",
      detail: "Silver studs", palette: "Ultraviolet",
      credit: "AI-assisted ghost-family concept study."
    },
    {
      id: "GA-002", name: "Blush Racket", group: "Family", kind: "Ghost angel",
      image: "assets/blush-racket.webp", tone: "rose",
      alt: "A rose-pink ghost with small wings and a punk halo in a pink thorn garden.",
      story: "She kept the safety pin from her first show. It holds her favorite wing together and hums whenever someone plays the wrong chord with conviction.",
      detail: "Keepsake safety pin", palette: "Rose chrome",
      credit: "AI-assisted ghost-family concept study."
    },
    {
      id: "GA-003", name: "Halo Drift", group: "Family", kind: "Ghost angel",
      image: "assets/halo-drift.webp", tone: "ice",
      alt: "A pale blue spirit with a silver orbit and soft fins in an icy blue setting.",
      story: "Her halo follows the tide. Every low moon it brings back one little thing somebody thought the sea had swallowed.",
      detail: "Loose silver orbit", palette: "Tide glass",
      credit: "AI-assisted ghost-family concept study."
    },
    {
      id: "GA-004", name: "Thistle Hush", group: "Family", kind: "Ghost angel",
      image: "assets/thistle-hush.webp", tone: "smoke",
      alt: "A smoky gray ghost in dark velvet with lilac lace and purple thistles.",
      story: "Her corner of the garden is reserved for unfinished goodbyes. Leave a loose thread there and she will tie it into a bow by morning.",
      detail: "Thistle lace", palette: "Smoky plum",
      credit: "AI-assisted ghost-family concept study."
    },
    {
      id: "GA-005", name: "Pearl Flare", group: "Family", kind: "Ghost angel",
      image: "assets/pearl-flare.webp", tone: "pearl",
      alt: "A warm pearlescent ghost with tiny ruffled wings against a champagne-colored set.",
      story: "She saves the few seconds of gold that land on a bedroom wall before sunset. There is always enough for one more visitor.",
      detail: "Ruffled winglets", palette: "Champagne opal",
      credit: "AI-assisted ghost-family concept study."
    }
  ]
};
