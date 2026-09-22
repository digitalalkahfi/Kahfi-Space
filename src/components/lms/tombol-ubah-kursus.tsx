"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogUbahKursus } from "@/components/lms/dialog-kursus";
import type { Kursus } from "@/lib/lms";
import type { PilihanOrganisasi } from "@/lib/types";

/** Tombol pembuka dialog ubah kursus; memisahkan state klien dari halaman. */
export function TombolUbahKursus({
  kursus,
  pilihan,
}: {
  kursus: Kursus;
  pilihan: PilihanOrganisasi;
}) {
  const [buka, setBuka] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setBuka(true)}
        className="tekan-halus sentuh-nyaman h-9 shrink-0 rounded-full px-4 text-[11px] font-semibold"
      >
        <Pencil className="size-3.5" />
        Ubah kursus
      </Button>

      <DialogUbahKursus
        kursus={kursus}
        pilihan={pilihan}
        buka={buka}
        onBuka={setBuka}
      />
    </>
  );
}
