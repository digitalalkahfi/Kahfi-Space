"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { masuk } from "@/app/actions/auth";
import type { Hasil } from "@/lib/data/hasil";

function TombolMasuk() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="tekan-halus sentuh-nyaman h-12 w-full rounded-full text-[13px] font-semibold"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogIn className="size-4" />
      )}
      {pending ? "Memeriksa…" : "Masuk"}
    </Button>
  );
}

/** Form masuk email & kata sandi. */
export function FormMasuk({ lanjut }: { lanjut: string }) {
  const [hasil, kirim] = useActionState<Hasil | null, FormData>(masuk, null);

  return (
    <form action={kirim} className="space-y-3">
      <input type="hidden" name="lanjut" value={lanjut} />

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-[13px] leading-[18px] font-semibold"
        >
          Email kantor
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nama@alkahfi.co.id"
          className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="sandi"
          className="text-[13px] leading-[18px] font-semibold"
        >
          Kata sandi
        </label>
        <input
          id="sandi"
          name="sandi"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      {hasil && !hasil.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
        >
          {hasil.pesan}
        </p>
      ) : null}

      <TombolMasuk />
    </form>
  );
}
