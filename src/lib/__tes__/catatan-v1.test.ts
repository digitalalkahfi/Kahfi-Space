import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bacaCatatan, kategoriCatatanV1 } from "@/lib/catatan-v1";

test("catatan lama: pribadi, kategori dipetakan, DRM jadi rapat, lampiran tautan saja", () => {
  assert.equal(kategoriCatatanV1("lainnya", "DRM 22 September 2026"), "rapat");
  assert.equal(kategoriCatatanV1("lainnya", "Ide"), "lainnya");
  assert.equal(kategoriCatatanV1("sop", "Templat"), "sop");
  const { siap, tertahan } = bacaCatatan([
    {
      id: "n1",
      title: "5 Jenis dokumen di bawah SOP",
      content: "isi",
      authorId: "u_kholid",
      category: "dokumentasi",
      division: "manajemen",
      isPinned: true,
      visibility: "private",
      attachments: [
        { src: "https://x/a.jpg", name: "a.png", type: "image" },
        { src: "bukan", type: "image" },
      ],
      createdAt: "2026-09-08T06:39:39Z",
      updatedAt: "2026-09-08T06:39:39Z",
    },
    { id: "n2", title: "", content: "", authorId: "u_x" },
  ]);
  assert.equal(tertahan.length, 1);
  assert.equal(siap.length, 1);
  assert.equal(siap[0].kategori, "dokumentasi");
  assert.equal(siap[0].disematkan, true);
  assert.deepEqual(siap[0].lampiran, ["https://x/a.jpg"]);
  assert.equal(siap[0].pemilikLama, "u_kholid");
});

test("data ekspor sungguhan 25 Sep: 6 catatan terbaca, 4 di antaranya rapat", (t) => {
  let isi: Record<string, unknown>;
  try {
    isi = JSON.parse(
      readFileSync(
        "/Users/kholidfath_/Downloads/alkahfi-backup-2026-09-25.json",
        "utf8",
      ),
    ).data;
  } catch {
    t.skip("berkas backup tidak ada di mesin ini");
    return;
  }
  const catatan = bacaCatatan(isi["notes:all"] as unknown[]);
  assert.equal(catatan.siap.length, 6);
  assert.equal(catatan.siap.filter((c) => c.kategori === "rapat").length, 4);
});
