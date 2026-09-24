/**
 * Warna lencana tiap peran — satu tempat, supaya kartu anggota dan bagan
 * struktur menyebut peran yang sama dengan warna yang sama.
 */
import type { Peran } from "@/lib/types";

export const GAYA_PERAN: Record<Peran, string> = {
  CEO: "bg-primary text-primary-foreground",
  Manager: "bg-info-fill text-info-text",
  Leader: "bg-accentmuted-fill text-accentmuted-text",
  "Co-Leader": "bg-accentmuted-fill text-accentmuted-text",
  Staff: "bg-muted text-muted-foreground",
  Finance: "bg-ok-fill text-ok-text",
};
