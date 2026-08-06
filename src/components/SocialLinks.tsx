import { Instagram, Spotify } from "@/components/icons";

const LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/bolachasorg/",
    icon: <Instagram className="h-4 w-4" />,
  },
  {
    name: "Spotify playlist",
    href: "https://open.spotify.com/playlist/0ipDB0aTeg11GQqSfDm7wM",
    icon: <Spotify className="h-4 w-4" />,
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
          className="text-zinc-500 transition-colors hover:text-accent"
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}
