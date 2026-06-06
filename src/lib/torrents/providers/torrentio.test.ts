import { describe, expect, it, vi } from "vitest";

import { TorrentioProvider } from "./torrentio";

function mockJson(body: unknown, opts: { status?: number } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return vi.fn().mockResolvedValue(
    new Response(text, {
      status: opts.status ?? 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("TorrentioProvider", () => {
  it("returns 'empty' when streams array is empty", async () => {
    const fetch = mockJson({ streams: [] });
    vi.stubGlobal("fetch", fetch);
    const r = await new TorrentioProvider().search("tt0000001");
    expect(r.status).toBe("empty");
    expect(r.torrents).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("parses seeders, size, source, quality from the emoji-delimited title", async () => {
    const fetch = mockJson({
      streams: [
        {
          name: "Torrentio\n1080p",
          title:
            "Project.Hail.Mary.2026.1080p.WEB-DL.HDR.x265-CMRG\n👤 852 💾 5.4 GB ⚙️ 1337x",
          infoHash: "AAAA1234",
        },
      ],
    });
    vi.stubGlobal("fetch", fetch);
    const r = await new TorrentioProvider().search("tt12042730");
    expect(r.status).toBe("success");
    expect(r.torrents).toHaveLength(1);
    const t = r.torrents[0];
    expect(t.infoHash).toBe("aaaa1234");
    expect(t.seeders).toBe(852);
    expect(t.sizeBytes).toBe(5_400_000_000);
    expect(t.source).toBe("1337x");
    expect(t.quality).toBe("1080p");
    expect(t.isHdr).toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns 'error' on non-2xx", async () => {
    const fetch = mockJson("oops", { status: 502 });
    vi.stubGlobal("fetch", fetch);
    const r = await new TorrentioProvider().search("tt0000001");
    expect(r.status).toBe("error");
    expect(r.httpStatus).toBe(502);
    vi.unstubAllGlobals();
  });

  it("returns 'error' on network failure without throwing", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", fetch);
    const r = await new TorrentioProvider().search("tt0000001");
    expect(r.status).toBe("error");
    expect(r.error).toContain("ECONNRESET");
    vi.unstubAllGlobals();
  });
});
