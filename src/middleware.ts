import type { NextRequest } from "next/server";
import { segarkanSesi } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return segarkanSesi(request);
}

export const config = {
  matcher: [
    /*
     * Semua jalur kecuali berkas statis dan gambar — menyegarkan sesi di
     * permintaan aset hanya membuang waktu tanpa manfaat.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
