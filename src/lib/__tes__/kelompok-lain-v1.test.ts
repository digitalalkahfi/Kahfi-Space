import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bacaAgenda, jenisAgendaV1 } from "@/lib/agenda-v1";
import { bacaLms } from "@/lib/lms-v1";
import { bacaMasalah, ringkasWhy, statusMasalahV1 } from "@/lib/masalah-v1";
import { bacaMasukan, judulMasukan } from "@/lib/masukan-v1";
import {
  bacaPengumuman,
  paragrafPengumuman,
  slugPengumuman,
} from "@/lib/pengumuman-v1";
import { bacaSampel } from "@/lib/sampel-v1";
import { jamV1, potong, tautanV1 } from "@/lib/teks-v1";

test("alat teks: jam, tautan, dan pemotongan yang tidak memutus kata", () => {
  assert.equal(jamV1("9:05"), "09:05");
  assert.equal(jamV1("19:30"), "19:30");
  assert.equal(jamV1("25:00"), null);
  assert.equal(jamV1(""), null);
  assert.equal(tautanV1("https://zoom.us/j/1"), "https://zoom.us/j/1");
  assert.equal(tautanV1("zoom.us/j/1"), null);
  assert.equal(potong("satu dua tiga empat", 12), "satu dua");
  assert.equal(potong("pendek", 12), "pendek");
});

test("pengumuman: judul dibersihkan, slug unik per id lama, isi per paragraf", () => {
  const { siap, tertahan } = bacaPengumuman([
    {
      id: "mtr2vke6buv5i",
      title: "📢 *PENGUMUMAN TIM*",
      content: "*📢 INFO*\n\nBaris kedua.\n\n\nBaris ketiga.",
      authorId: "u1",
      createdAt: "2026-09-07T10:08:36.606Z",
    },
    { id: "kosong", title: "", content: "" },
  ]);
  assert.equal(tertahan.length, 1);
  assert.equal(siap.length, 1);
  assert.equal(siap[0].judul, "PENGUMUMAN TIM");
  assert.equal(siap[0].slug, "pengumuman-tim-6buv5i");
  assert.equal(siap[0].ringkasan, "📢 INFO");
  assert.deepEqual(siap[0].isi, ["*📢 INFO*", "Baris kedua.", "Baris ketiga."]);
  // Judul yang sama dari id lain tidak bertabrakan.
  assert.notEqual(slugPengumuman("Pengumuman Tim", "abc123"), siap[0].slug);
  assert.deepEqual(paragrafPengumuman("   "), ["(Pengumuman lama tanpa isi.)"]);
});

test("agenda: jadwal yang sudah disalin kalender lama tidak dibawa dua kali, catatannya ikut", () => {
  const { siap } = bacaAgenda({
    "calendar:all": [
      {
        id: "cal1",
        date: "2026-06-04",
        time: "09:00",
        endTime: "",
        type: "piket_grup",
        title: "Piket Grup — Azka",
        description: "Piket grup",
        attendeeNames: ["Azka"],
        createdById: "u_azka",
        migratedFromSchedule: true,
      },
      {
        id: "cal2",
        date: "2026-06-15",
        time: "19:30",
        endTime: "21:00",
        type: "meeting",
        title: "Meeting dengan Dosen",
        location: "https://zoom.us/launch/jc/1",
        description: "Tautan rapat",
        attendeeNames: ["Kholid", "Azka"],
        createdById: "u_kholid",
      },
    ],
    "schedule:all": [
      {
        id: "sch1",
        date: "2026-06-04",
        time: "09:00",
        type: "piket_grup",
        notes: "Meeting bersama leader affiliator",
        adminId: "u_azka",
      },
      {
        id: "sch2",
        date: "2026-06-03",
        time: "19:00",
        type: "piket_grup",
        notes: "Meeting bersama manager",
        adminId: "u_azka",
        adminName: "Azka",
      },
    ],
  });
  assert.equal(siap.length, 3);
  const piket = siap.find((a) => a.idLama === "cal1");
  assert.match(piket?.keterangan ?? "", /Meeting bersama leader affiliator/);
  assert.match(piket?.keterangan ?? "", /Peserta: Azka/);
  assert.equal(piket?.jenis, "lainnya");
  const rapat = siap.find((a) => a.idLama === "cal2");
  assert.equal(rapat?.jenis, "rapat");
  assert.equal(rapat?.jamMulai, "19:30");
  assert.equal(rapat?.jamSelesai, "21:00");
  assert.equal(rapat?.lokasi, "https://zoom.us/launch/jc/1");
  const sisa = siap.find((a) => a.idLama === "sch2");
  assert.equal(sisa?.sumber, "schedule:all");
  assert.equal(sisa?.judul, "Piket grup — Azka");
  assert.equal(sisa?.dibuatOleh, "u_azka");
  assert.equal(jenisAgendaV1("training"), "pelatihan");
});

test("masalah: 5-Why diringkas tanpa pengulangan, status dan dampak dipetakan", () => {
  assert.equal(
    ringkasWhy({
      root: "beres",
      why1: "beres",
      why2: "Beres",
      corrective: "x",
    }),
    "Akar masalah: beres",
  );
  const { siap } = bacaMasalah([
    {
      id: "p1",
      title: "Akun Apis Kena Banned",
      status: "resolved",
      urgency: "kritis",
      division: "internal",
      relatedType: "creator",
      description: "Kena pelanggaran.",
      rootCause: {
        root: "spam",
        why1: "spam",
        corrective: "diganti akun baru",
        preventive: "",
      },
      reportedById: "u_siti",
      resolvedById: "u_kholid",
      resolvedAt: "2026-09-11T01:50:06.334Z",
      createdAt: "2026-09-10T01:54:55.616Z",
    },
    {
      id: "p2",
      title: "Lupa absen",
      status: "open",
      urgency: "sedang",
      division: "mcn",
      rootCause: null,
    },
  ]);
  assert.equal(siap[0].status, "selesai");
  assert.equal(siap[0].dampak, "tinggi");
  assert.equal(siap[0].unitKode, "affiliator");
  assert.match(siap[0].konteks, /Terkait: creator/);
  assert.match(siap[0].konteks, /Urgensi di sistem lama: kritis/);
  assert.match(siap[0].konteks, /Akar masalah: spam/);
  assert.equal(siap[0].solusi, "diganti akun baru");
  assert.equal(siap[1].status, "baru");
  assert.equal(siap[1].unitKode, "mcn");
  // Judul pendek dipanjangkan supaya lolos batas aplikasi (≥10 huruf).
  assert.ok(siap[1].judul.length >= 10);
  assert.equal(statusMasalahV1("dianalisis"), "diproses");
});

test("masukan: judul dari kalimat pertama, lampiran dan balasan ikut", () => {
  assert.ok(judulMasukan("Bug.").length >= 10);
  const { siap } = bacaMasukan([
    {
      id: "f1",
      type: "lainnya",
      status: "selesai",
      page: "Anggota Tim",
      userId: "u_siti",
      message:
        "Akun Hersanda belum dipindahkan ke Divisi Affiliate. Tolong dicek.",
      images: ["https://x.supabase.co/storage/v1/object/public/photos/a.jpg"],
      replies: [
        {
          id: "r1",
          text: "Sudah dipindahkan",
          userId: "u_kholid",
          createdAt: "2026-07-18T08:00:00Z",
        },
        { id: "r2", text: "", userId: "u_kholid" },
      ],
      createdAt: "2026-07-18T07:00:00Z",
    },
  ]);
  assert.equal(siap[0].jenis, "saran");
  assert.equal(siap[0].status, "selesai");
  assert.equal(
    siap[0].judul,
    "Akun Hersanda belum dipindahkan ke Divisi Affiliate.",
  );
  assert.match(siap[0].isi, /Lampiran \(penyimpanan sistem lama\)/);
  assert.match(siap[0].isi, /Jenis di sistem lama: lainnya/);
  assert.equal(siap[0].komentar.length, 1);
  assert.equal(siap[0].halaman, "Anggota Tim");
});

test("sampel: kode dibakukan, penerima jadi pemegang, pindaian ikut kodenya", () => {
  const { sampel, pindai } = bacaSampel({
    "sampel:all": [
      {
        id: "SMP-260915-0001",
        kode: "smp-260915-0001",
        nama: "Jas pria",
        kategori: "Fashion",
        token: "YH22NABS",
        penerimaId: "u_siti",
        createdById: "u_kholid",
        createdAt: "2026-09-15T01:46:39.550Z",
        tanggalDatang: "2026-09-15",
        linkProduk: ["bukan tautan", "https://shop.tiktok.com/x"],
      },
    ],
    "sampel-usage:all": [
      {
        id: "2026-09-11-a",
        usedAt: "2026-09-11T01:48:07.303Z",
        userId: "u_kholid",
        sampelKode: "SMP-260911-0001",
      },
    ],
  });
  assert.equal(sampel[0].kode, "SMP-260915-0001");
  assert.equal(sampel[0].pemegang, "u_siti");
  assert.equal(sampel[0].linkProduk, "https://shop.tiktok.com/x");
  assert.match(sampel[0].catatan, /Token lama: YH22NABS/);
  assert.equal(pindai[0].kode, "SMP-260911-0001");
  assert.equal(pindai[0].oleh, "u_kholid");
});

test("LMS: pelajaran jadi modul, pendaftaran jalur jadi pendaftaran kursus, kemajuan tuntas saja", () => {
  const hasil = bacaLms({
    "lms:paths:all": [
      {
        id: "path1",
        title: "On Boarding Affiliator",
        estimatedDays: 7,
        targetDivisions: ["internal"],
        targetJobTitles: ["Affiliator"],
        courses: [{ courseId: "c1", order: 0, required: true }],
      },
    ],
    "lms:courses:all": [
      {
        id: "c1",
        title: "PlayBook Affiliator",
        status: "published",
        priority: "wajib",
        passingScore: 85,
        createdAt: "2026-08-25T00:00:00Z",
        modules: [
          {
            id: "m1",
            title: "Playbook",
            lessons: [
              {
                id: "l1",
                type: "pdf",
                title: "Affiliator Playbook",
                pdfUrl: "https://x/p.pdf",
                pdfName: "p.pdf",
                estimatedMinutes: 75,
              },
              {
                id: "l2",
                type: "video",
                title: "Video pengantar",
                videoUrl: "https://youtu.be/abc",
                estimatedMinutes: 900,
              },
            ],
          },
        ],
      },
    ],
    "lms:library:all": [
      {
        id: "lib1",
        type: "pdf",
        title: "Mega Hook Creator",
        pdfUrl: "https://x/m.pdf",
        status: "published",
        description: "Internal",
      },
    ],
    "lms:enrollments:all": [
      {
        id: "e1",
        pathId: "path1",
        userId: "u1",
        assignedAt: "2026-08-25T08:00:00Z",
        assignedById: "u_kholid",
      },
      { id: "e2", pathId: "hilang", userId: "u2" },
    ],
    "lms:progress:all": [
      {
        id: "u1:l1",
        userId: "u1",
        courseId: "c1",
        lessonId: "l1",
        done: true,
        completedAt: "2026-08-26T07:36:54Z",
      },
      {
        id: "u1:l2",
        userId: "u1",
        courseId: "c1",
        lessonId: "l2",
        done: false,
        percent: 21,
      },
      {
        id: "u3:l1",
        userId: "u3",
        courseId: "c1",
        lessonId: "l1",
        done: true,
        updatedAt: "2026-08-27T00:00:00Z",
      },
    ],
  });
  assert.equal(hasil.kursus.length, 2);
  const k = hasil.kursus[0];
  assert.equal(k.unitKode, "affiliator");
  assert.equal(k.kategori, "On Boarding Affiliator");
  assert.match(k.ringkasan, /Jalur lama: On Boarding Affiliator \(7 hari\)/);
  assert.match(k.ringkasan, /Modul lama: Playbook/);
  assert.equal(k.modul.length, 2);
  assert.equal(k.modul[0].isi, "PDF: https://x/p.pdf (p.pdf)");
  assert.equal(k.modul[1].durasiMenit, 600);
  assert.equal(hasil.kursus[1].judul, "Perpustakaan: Mega Hook Creator");
  assert.equal(hasil.kursus[1].modul[0].isi, "PDF: https://x/m.pdf");
  // e1 → satu pendaftaran kursus; e2 jalurnya hilang; u3 dibuat dari kemajuannya.
  assert.deepEqual(
    hasil.pendaftaran.map((p) => p.idLama),
    ["e1#c1", "kemajuan:u3:l1"],
  );
  assert.equal(hasil.kemajuan.length, 2);
  assert.ok(hasil.catatan.some((c) => c.pesan.includes("setengah jalan")));
  assert.ok(hasil.catatan.some((c) => c.idLama === "e2"));
});

test("data ekspor sungguhan 25 Sep terbaca utuh oleh pembaca kelompok baru", (t) => {
  const jalur = "/Users/kholidfath_/Downloads/alkahfi-backup-2026-09-25.json";
  let isi: Record<string, unknown>;
  try {
    isi = JSON.parse(readFileSync(jalur, "utf8")).data;
  } catch {
    t.skip("berkas backup tidak ada di mesin ini");
    return;
  }
  assert.equal(
    bacaPengumuman(isi["announcements:all"] as unknown[]).siap.length,
    5,
  );
  const agenda = bacaAgenda(isi);
  assert.equal(agenda.siap.length, 5);
  assert.equal(
    agenda.siap.filter((a) => a.sumber === "schedule:all").length,
    0,
  );
  assert.equal(bacaMasalah(isi["problems:all"] as unknown[]).siap.length, 4);
  const masukan = bacaMasukan(isi["feedback:all"] as unknown[]);
  assert.equal(masukan.siap.length, 19);
  assert.equal(
    masukan.siap.reduce((a, m) => a + m.komentar.length, 0),
    17,
  );
  const sampel = bacaSampel(isi);
  assert.equal(sampel.sampel.length, 2);
  assert.equal(sampel.pindai.length, 4);
  const lms = bacaLms(isi);
  assert.equal(lms.kursus.length, 3);
  assert.equal(
    lms.kursus.reduce((a, k) => a + k.modul.length, 0),
    17,
  );
  assert.equal(lms.pendaftaran.length, 40);
  assert.equal(lms.kemajuan.length, 5);
});
