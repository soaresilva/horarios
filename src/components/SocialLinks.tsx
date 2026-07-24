const LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/bolachasorg/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: "Spotify playlist",
    href: "https://open.spotify.com/playlist/0ipDB0aTeg11GQqSfDm7wM",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 15c3-1.5 7-1.5 10 0" />
        <path d="M6.5 11.5c4-2 8.5-2 12 0" />
        <path d="M6 8c4.5-2.2 9.5-2.2 14 0" />
      </svg>
    ),
  },
];

export function SocialLinks() {
  return (
    <div className="flex items-center gap-2.5">
      {LINKS.map((link) => (
        <a
          key={link.name}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.name}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <span className="block h-4 w-4">{link.icon}</span>
        </a>
      ))}
    </div>
  );
}
