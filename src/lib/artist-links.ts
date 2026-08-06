// Per-artist outbound links for the timetable's artist boxes.
//
// Static reference data on purpose: artist identities don't change during the
// festival, so this needs neither a DB column nor an /admin field. An artist added
// later via /admin simply has no links until an entry is added here.
//
// Sourcing rules, so this stays trustworthy when extended:
//   - instagram: taken from that artist's own page on vodafoneparedesdecoura.com.
//   - spotify: the artist's Spotify page, verified by EXACT name match. Spotify IDs
//     are opaque and cannot be derived from a name — never guess one.
//   - An artist with no verified link for a platform is simply omitted here. Never
//     substitute a search URL, and never link a similarly-named artist: searching
//     "Wu Lyf" surfaces "Wu-Lu", a completely different act. Wu Lyf genuinely has no
//     Spotify presence and no Instagram on the festival site, so it has no entry at
//     all and correctly renders with just the star.
export interface ArtistLinks {
  spotify?: string;
  instagram?: string;
}

export const ARTIST_LINKS: Record<string, ArtistLinks> = {
  "A Garota Não": {
    spotify: "https://open.spotify.com/artist/7uCICyVlZh7EL1y4QLbNi0",
    instagram: "https://www.instagram.com/a_garota_nao/",
  },
  "Aldous Harding": {
    spotify: "https://open.spotify.com/artist/3lmR0qMiGuoIF9UC54egcG",
    instagram: "https://www.instagram.com/aldousharding/",
  },
  "Amyl and the Sniffers": {
    spotify: "https://open.spotify.com/artist/3NqV2DJoAWsjl787bWaHW7",
    instagram: "https://www.instagram.com/amylandthesniffers/",
  },
  "Bassvictim": {
    spotify: "https://open.spotify.com/artist/7f8ydynRRnrJBqWxevKLcM",
    instagram: "https://www.instagram.com/bassvictim/",
  },
  "Benjamin Clementine": {
    spotify: "https://open.spotify.com/artist/7zHIrsSBL7A0gEJfzv1m7z",
    instagram: "https://www.instagram.com/benjaminclementine/",
  },
  "Bloc Party": {
    spotify: "https://open.spotify.com/artist/3MM8mtgFzaEJsqbjZBSsHJ",
    instagram: "https://www.instagram.com/thisisblocparty/",
  },
  "CMAT": {
    spotify: "https://open.spotify.com/artist/3VBNIRx1LxVdRqOiPgkLwv",
    instagram: "https://www.instagram.com/cmatbaby/",
  },
  "Capitão Fausto": {
    spotify: "https://open.spotify.com/artist/5CoXKGQeOWgWi8koTZh07b",
    instagram: "https://www.instagram.com/capitaofausto/",
  },
  "Carolina Durante": {
    spotify: "https://open.spotify.com/artist/2BVE7Pqd8kxv9xEsuvoJoE",
    instagram: "https://www.instagram.com/carolinadurante_/",
  },
  "Cate Le Bon": {
    spotify: "https://open.spotify.com/artist/0LZac5VicY19QLaIUvIB0G",
    instagram: "https://www.instagram.com/catelebon/",
  },
  "Dame Area": {
    spotify: "https://open.spotify.com/artist/1Cmtis0NcKGTvAnovenEJl",
    instagram: "https://www.instagram.com/dame_area_/",
  },
  "First Breath After Coma + Salvador Sobral": {
    spotify: "https://open.spotify.com/artist/0h6a6g2SHlGGabD0gEHIht",
    instagram: "https://www.instagram.com/_firstbreathaftercoma_/",
  },
  "Friko": {
    spotify: "https://open.spotify.com/artist/5HViQsHNdOovxKa420CPGR",
    instagram: "https://www.instagram.com/friko4u/",
  },
  "Getdown Services": {
    spotify: "https://open.spotify.com/artist/4OTD2AbOu5iBqSWk3NfwG5",
    instagram: "https://www.instagram.com/getdown_services/",
  },
  "Greg Freeman": {
    spotify: "https://open.spotify.com/artist/7naOvlP3zuvwVn7hiSeGwJ",
    instagram: "https://www.instagram.com/oldgraig/",
  },
  "Hermanos Gutiérrez": {
    spotify: "https://open.spotify.com/artist/73mSg0dykFyhvU96tb5xQV",
    instagram: "https://www.instagram.com/hermanosgutierrez/",
  },
  "Horsegirl": {
    spotify: "https://open.spotify.com/artist/2FDvUb4YgyUPpmnm1ILPra",
    instagram: "https://www.instagram.com/horsegirlmusic/",
  },
  "Hudson Freeman": {
    spotify: "https://open.spotify.com/artist/6k3W2iGuRZrhUnfVZOMQo8",
    instagram: "https://www.instagram.com/thehuddog/",
  },
  "Joana Alegre": {
    spotify: "https://open.spotify.com/artist/3cNMSW7AIN2WILAlRBU2cX",
    instagram: "https://www.instagram.com/joanaalegre.music/",
  },
  "Joy Orbison": {
    spotify: "https://open.spotify.com/artist/0aIpJqqTLf683ojWREc5lg",
    instagram: "https://www.instagram.com/joy_orbison_/",
  },
  "Julia Mestre": {
    spotify: "https://open.spotify.com/artist/1FnGKreDca8xq3juSi5hAE",
    instagram: "https://www.instagram.com/julia_mestre/",
  },
  "Kneecap": {
    spotify: "https://open.spotify.com/artist/1ZVACPeq7ccGCoUXwtafUU",
    instagram: "https://www.instagram.com/kneecap32/",
  },
  "Kurt Vile & The Violators": {
    spotify: "https://open.spotify.com/artist/5gspAQIAH8nJUrMYgXjCJ2",
    instagram: "https://www.instagram.com/kurtvile/",
  },
  "M.I.A.": {
    spotify: "https://open.spotify.com/artist/0QJIPDAEDILuo8AIq3pMuU",
    instagram: "https://www.instagram.com/miamatangi/",
  },
  "Marie Davidson DJ Set": {
    spotify: "https://open.spotify.com/artist/7xJVICbAWizNBKBD3mRWjF",
    instagram: "https://www.instagram.com/mariedavidson.official/",
  },
  "Maruja": {
    spotify: "https://open.spotify.com/artist/71ISXR7gtIq5E2AdI3jGf0",
    instagram: "https://www.instagram.com/marujaofficial/",
  },
  "Meute": {
    spotify: "https://open.spotify.com/artist/1z5xbcOeFRQXBVDpvRPh8H",
    instagram: "https://www.instagram.com/meute_official/",
  },
  "Milhanas": {
    spotify: "https://open.spotify.com/artist/4NbHlXvmfisJ4e9tNkTqgC",
    instagram: "https://www.instagram.com/milhanas_/",
  },
  "Miramar": {
    spotify: "https://open.spotify.com/artist/24TB8EwgYv2C6fTQlXZgUM",
    instagram: "https://www.instagram.com/miramar_official/",
  },
  "Noiserv": {
    spotify: "https://open.spotify.com/artist/2DLUyAtFcP1bEOd8l6ZMys",
    instagram: "https://www.instagram.com/noiserv/",
  },
  "Noko Woi": {
    spotify: "https://open.spotify.com/artist/1kr1EWcFC1tCEvRGKxAFbl",
    instagram: "https://www.instagram.com/nokowoi/",
  },
  "Pale Jay": {
    spotify: "https://open.spotify.com/artist/7H3z77VbkJcCcFilmKqKNM",
    instagram: "https://www.instagram.com/palejaymusic/",
  },
  "Patrick Watson": {
    spotify: "https://open.spotify.com/artist/7bPs6jf983f0bjRAt1yxDM",
    instagram: "https://www.instagram.com/patrickwatsonofficial/",
  },
  "Prostitute": {
    spotify: "https://open.spotify.com/artist/7fY4LrglQCCiDGUpz4ts47",
    instagram: "https://www.instagram.com/attempted.martyr/",
  },
  "Rita Cortezão": {
    spotify: "https://open.spotify.com/artist/08QvPdlVvNNRGd5jxZcIYk",
  },
  "Ryan Davis and the Roadhouse Band": {
    spotify: "https://open.spotify.com/artist/7Ah0xZVyWfAL3Vd7OVvKuo",
    instagram: "https://www.instagram.com/technique_street/",
  },
  "Salvador Sobral e André Santos": {
    spotify: "https://open.spotify.com/artist/0GfYO21pue5u0sVEYk9HZO",
    instagram: "https://www.instagram.com/salvadorsobral.music/",
  },

  "Show Me The Body": {
    spotify: "https://open.spotify.com/artist/5jh7sgXW2njALiIh0aPXjB",
    instagram: "https://www.instagram.com/showmethebody/",
  },
  "Sophia Stel": {
    spotify: "https://open.spotify.com/artist/18w9tq3c2x11niEFNYqeex",
    instagram: "https://www.instagram.com/insignificantfunds/",
  },
  "Strawberry Guy": {
    spotify: "https://open.spotify.com/artist/1AbJ2cmwK400LSvdvBL5Jc",
    instagram: "https://www.instagram.com/strawberry_guy/",
  },
  "Terraplana": {
    spotify: "https://open.spotify.com/artist/0mOiRg1cqDkCESsFozsuZU",
    instagram: "https://www.instagram.com/trrpln/",
  },
  "The Horrors": {
    spotify: "https://open.spotify.com/artist/7EFB09NxZrMi9pGlOnuBpd",
    instagram: "https://www.instagram.com/thehorrors/",
  },
  "Thundercat": {
    spotify: "https://open.spotify.com/artist/4frXpPxQQZwbCu3eTGnZEw",
    instagram: "https://www.instagram.com/thundercatmusic/",
  },
  "Tomode": {
    spotify: "https://open.spotify.com/artist/5Q5iKvamaJt7Gz1Bz1JRGA",
    instagram: "https://www.instagram.com/tomodemusic/",
  },
  "Underworld": {
    spotify: "https://open.spotify.com/artist/1PXHzxRDiLnjqNrRn2Xbsa",
    instagram: "https://www.instagram.com/Underworld/",
  },
  "University": {
    spotify: "https://open.spotify.com/artist/2TDMep1IfMAASZxbC5FAo5",
    instagram: "https://www.instagram.com/abandcalleduniversity/",
  },
  "Vendredi Sur Mer": {
    spotify: "https://open.spotify.com/artist/0wuuYZFptujAsRthrdea2B",
    instagram: "https://www.instagram.com/vendredisurmer_/",
  },
  "Westside Cowboy": {
    spotify: "https://open.spotify.com/artist/5LfO4rbJarBvHjB34mU9m2",
    instagram: "https://www.instagram.com/westsidecowboyyy/",
  },
  "Wet Leg": {
    spotify: "https://open.spotify.com/artist/2TwOrUcYnAlIiKmVQkkoSZ",
    instagram: "https://www.instagram.com/wetlegband/",
  },

  // ---------------------------------------------------------------------------
  // Not yet linked. Diogo maintains these by hand.
  //
  // To add one: uncomment the artist's block and paste the real URL(s), then
  // delete whichever of the two lines you have no link for. Rules that keep this
  // data trustworthy — the test suite enforces all four:
  //   - Spotify must be the artist's page: https://open.spotify.com/artist/<id>
  //   - Instagram must be https://www.instagram.com/<handle>/
  //   - Strip any ?utm_source=… / ?si=… tracking suffix before pasting.
  //   - Never link a similarly-named artist just to fill the slot. Searching
  //     "Wu Lyf" on Spotify surfaces "Wu-Lu", a completely different act. If
  //     there's no genuine match, leave it commented — one icon is correct, a
  //     wrong icon is not.
  // ---------------------------------------------------------------------------
  // "Alex Moon": { spotify: "", instagram: "" },
  "Armanda": { instagram: "https://www.instagram.com/armanda_lx/" },
  "Asa Cobra": { spotify: "https://open.spotify.com/artist/7t1PK0gwL5AIFw52ilNGBL", instagram: "https://www.instagram.com/asacobramusic/" },
  "Colinas": { spotify: "https://open.spotify.com/artist/0ahNf03N7IXcOmeafsdcgj", instagram: "https://www.instagram.com/xcolinasx/" },
  // "Consulta Aberta": { spotify: "", instagram: "" },
  // "DJ Shake a Leg": { spotify: "", instagram: "" },
  "Dupplo": { instagram: "https://www.instagram.com/dupplomusic/" },
  "Francisco AP": { instagram: "https://www.instagram.com/francisco_ap/" },
  "Gin Party Soundsystem": { instagram: "https://www.instagram.com/ginpartysoundsystem/" },
  "Halfpipe Records": { spotify: "https://open.spotify.com/artist/3EagGxqQ99hKSaFYwSMxxu" },
  "Hetta": { spotify: "https://open.spotify.com/artist/0RyfKQoHpko3ddSQyW2zFL", instagram: "https://www.instagram.com/hetta____/" },
  // "Humor à Primeira Vista": { spotify: "", instagram: "" },
  // James Keating: co-founder of Quarto Mundo, Porto's "deep listening" bar/
  // session (confirmed via press coverage) — a selector/curator, not an
  // artist with a discography, so no Spotify artist page exists. No festival
  // page either. Found an Instagram handle (@jkeat6) that plausibly matches
  // but couldn't verify it's actually him with confidence — left commented
  // rather than risk linking the wrong James Keating.
  // "James Keating": { spotify: "", instagram: "" },
  "Janeiro": {
    spotify: "https://open.spotify.com/artist/6XkMchHBuVhvBzCOyKIlJ0",
    instagram: "https://www.instagram.com/janeiromusic/",
  },
  "La Familia Gitana": { spotify: "https://open.spotify.com/artist/1lEY6QtxvnNuSEOkJfCBE2", instagram: "https://www.instagram.com/la_familia_gitana/" },
  "Maria Luiza Jobim": { spotify: "https://open.spotify.com/artist/0UBAjVKUJGkde9EeaoEyTM", instagram: "https://www.instagram.com/marialuizajobim/" },
  "Miguel Marôco": {
    spotify: "https://open.spotify.com/artist/0g5A7iVLIbfx6nXLecA1aE",
    instagram: "https://www.instagram.com/themaroco/",
  },
  "Nunca Mates o Mandarim": {
    spotify: "https://open.spotify.com/artist/1mXzaPO6UaW47RaHKVJ1UZ",
    instagram: "https://www.instagram.com/nuncamatesomandarim/",
  },
  // Two same-named Spotify artists exist ("PLAKA", 80 monthly listeners, no
  // socials linked; "Plaka", 4 monthly listeners, linked to instagram.com/
  // plaka_rua) and NEITHER matches Diogo's confirmed instagram.com/plaka_sound
  // — so which one is actually this act can't be verified. Instagram only.
  "Plaka": { instagram: "https://www.instagram.com/plaka_sound/" },
  // "Posto Emissor": { spotify: "", instagram: "" },
  "Quarto Mundo": { instagram: "https://www.instagram.com/_quartomundo/" },
  "Rufia Terno": { instagram: "https://www.instagram.com/rufiaterno/" },
  "Sofia Araújo": { instagram: "https://www.instagram.com/sofiaaraujowi/" },
  "Sounzstore": { instagram: "https://www.instagram.com/sounzstore/" },
  "Summer of Hate": { spotify: "https://open.spotify.com/artist/5yGpqacLZRqrWc93E6CxiB", instagram: "https://www.instagram.com/summer.of.hate/" },
  "Sérgio & Os Assessores Com Amigos": { spotify: "https://open.spotify.com/artist/2q9ET2kJQY4J3bGaIWt6Uz", instagram: "https://www.instagram.com/sergio.godinho.oficial/" },
  "Trol2000": { instagram: "https://www.instagram.com/trol2000/" },
  "Wu Lyf": { instagram: "https://www.instagram.com/wulyf_archive/" },
};

/**
 * Links for an artist, or an empty object when we have none. Matching is exact on
 * the stored artistName first, then falls back to a trimmed/case-insensitive match
 * so a stray capitalisation difference from /admin doesn't silently drop the icons.
 */
export function getArtistLinks(artistName: string): ArtistLinks {
  const direct = ARTIST_LINKS[artistName];
  if (direct) return direct;
  const needle = artistName.trim().toLowerCase();
  for (const [name, links] of Object.entries(ARTIST_LINKS)) {
    if (name.toLowerCase() === needle) return links;
  }
  return {};
}
