import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallBanner } from "./InstallBanner";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function mockNavigator({
  userAgent,
  platform = "",
  maxTouchPoints = 0,
  standalone,
}: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}) {
  vi.stubGlobal("navigator", {
    ...window.navigator,
    userAgent,
    platform,
    maxTouchPoints,
    ...(standalone !== undefined ? { standalone } : {}),
  });
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

async function renderResolved() {
  render(<InstallBanner />);
  // The component renders null until its mount effect resolves detection;
  // wait for that resolution before asserting on content.
  await waitFor(() => {
    expect(document.body.textContent).not.toBe("");
  });
}

describe("InstallBanner", () => {
  it("renders nothing when matchMedia reports standalone display mode", async () => {
    mockNavigator({ userAgent: ANDROID_UA });
    mockMatchMedia(true);
    const { container } = render(<InstallBanner />);
    // Give the mount effect a tick to resolve, then assert nothing rendered.
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when navigator.standalone (iOS) is true", async () => {
    mockNavigator({ userAgent: IOS_UA, standalone: true });
    mockMatchMedia(false);
    const { container } = render(<InstallBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only iOS instructions for an iPhone user agent", async () => {
    mockNavigator({ userAgent: IOS_UA });
    mockMatchMedia(false);
    await renderResolved();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByText(/Install app/)).not.toBeInTheDocument();
  });

  it("shows iOS instructions for the iPadOS 13+ MacIntel + touch quirk", async () => {
    mockNavigator({ userAgent: DESKTOP_UA.replace("Windows NT 10.0; Win64; x64", "Macintosh"), platform: "MacIntel", maxTouchPoints: 5 });
    mockMatchMedia(false);
    await renderResolved();
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByText(/Install app/)).not.toBeInTheDocument();
  });

  it("shows only Android instructions for an Android user agent", async () => {
    mockNavigator({ userAgent: ANDROID_UA });
    mockMatchMedia(false);
    await renderResolved();
    expect(screen.getByText(/Install app/)).toBeInTheDocument();
    expect(screen.queryByText(/tap Share/)).not.toBeInTheDocument();
  });

  it("shows both instruction sets for an unrecognized (desktop) user agent", async () => {
    mockNavigator({ userAgent: DESKTOP_UA });
    mockMatchMedia(false);
    await renderResolved();
    expect(screen.getByText(/tap Share/)).toBeInTheDocument();
    expect(screen.getByText(/Install app/)).toBeInTheDocument();
  });

  it("dismissing hides the banner, persists, and stays hidden on a fresh render", async () => {
    mockNavigator({ userAgent: ANDROID_UA });
    mockMatchMedia(false);
    const user = userEvent.setup();
    await renderResolved();

    await user.click(screen.getByRole("button", { name: "Dismiss install instructions" }));
    expect(screen.queryByText(/Install app/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("pdc26:installBannerDismissed")).toBe("true");

    const { container } = render(<InstallBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("does not throw when window.matchMedia is undefined", async () => {
    mockNavigator({ userAgent: ANDROID_UA });
    vi.stubGlobal("matchMedia", undefined);
    await renderResolved();
    expect(screen.getByText(/Install app/)).toBeInTheDocument();
  });
});
