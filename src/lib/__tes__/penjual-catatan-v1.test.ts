import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bacaCatatan, kategoriCatatanV1 } from "@/lib/catatan-v1";
import { bacaPenjual, kunciToko } from "@/lib/penjual-v1";

test("seller lama: komisi jadi persen, kontak bukan nomor ke catatan, toko ganda digabung", () => {
  const { siap, tertahan } = bacaPenjual([
    {
      id: "s1",
      name: "Sandi",
      shopName: "torch id",
      phone: "08562223257",
      status: "aktif",
      category: "Bag ",
      commission: "10%",
      note: "",
      managerId: "u_fajar",
      createdAt: "2026-06-03T00:00:00Z",
    },
    {
      id: "s2",
      name: "Sandi",
      shopName: "Torch.id",
      phone: " 856-2223-257",
      status: "aktif",
      category: "Bag",
      commission: "",
      note: "Proses pencarian kreator",
      managerId: "u_fajar",
      createdAt: "2026-08-28T00:00:00Z",
    },
    {
      id: "s3",
      name: "简凌城",
      shopName: "SAMIDAHUM",
      phone: "Lark",
      status: "aktif",
      category: "Fashion",
      commission: "8",
      note: "",
      managerId: "u_fajar",
      createdAt: "2026-06-13T00:00:00Z",
    },
    {
      id: "s4",
      name: "-",
      shopName: "ERQUEEN STORE",
      phone: "855-5976-6445",
      status: "prospek",
      category: "Fashion",
      commission: "12%",
      note: "",
      managerId: "u_fajar",
      createdAt: "2026-06-05T00:00:00Z",
    },
    { id: "s5", shopName: "x", status: "aktif" },
  ]);
  assert.equal(tertahan.length, 1);
  assert.equal(kunciToko("Torch.id"), kunciToko("torch id"));
  const torch = siap.find((p) => kunciToko(p.namaToko) === "torchid");
  assert.ok(torch);
  // Yang terakhir dicatat jadi acuan; komisi kosong diisi dari entri lama.
  assert.equal(torch.idLama, "s2");
  assert.equal(torch.namaToko, "Torch.id");
  assert.equal(torch.komisiPersen, 10);
  assert.deepEqual(torch.digabung, ["s1"]);
  assert.equal(torch.dibuatPada, "2026-06-03T00:00:00Z");
  const sami = siap.find((p) => p.namaToko === "SAMIDAHUM");
  assert.equal(sami?.telepon, "");
  assert.match(sami?.catatan ?? "", /Kontak lewat: Lark/);
  assert.equal(sami?.komisiPersen, 8);
  const erqueen = siap.find((p) => p.namaToko === "ERQUEEN STORE");
  assert.equal(erqueen?.namaKontak, "");
  assert.equal(erqueen?.status, "prospek");
  assert.equal(erqueen?.komisiPersen, 12);
  assert.equal(siap.length, 3);
});

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

test("data ekspor sungguhan 25 Sep: 12 seller jadi 11 toko, 6 catatan terbaca", (t) => {
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
  const penjual = bacaPenjual(isi["sellers:all"] as unknown[]);
  assert.equal(penjual.siap.length, 11);
  assert.equal(penjual.siap.filter((p) => p.digabung.length > 0).length, 1);
  const catatan = bacaCatatan(isi["notes:all"] as unknown[]);
  assert.equal(catatan.siap.length, 6);
  assert.equal(catatan.siap.filter((c) => c.kategori === "rapat").length, 4);
});
