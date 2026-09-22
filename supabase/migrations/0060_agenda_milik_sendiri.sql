-- =====================================================================
-- K-Space V2 — Pembuat agenda boleh mengurus agendanya sendiri
--
-- Policy di 0059 hanya memberi kuasa kepada CEO/Manager dan Leader atas
-- unitnya. Akibatnya orang yang membuat sebuah agenda tidak bisa
-- membetulkan jamnya sendiri — ia harus meminta Manager untuk salah
-- ketik yang ia buat sendiri, dan pada akhirnya kalender dibiarkan
-- keliru karena merepotkan.
--
-- Pembuatnya kini boleh menyunting dan menghapus agendanya. Yang tidak
-- berubah: hanya yang berwenang yang bisa membuatnya sejak awal.
-- =====================================================================

create policy agenda_ubah_sendiri on agenda
  for update
  using (dibuat_oleh = auth.uid())
  with check (dibuat_oleh = auth.uid());

create policy agenda_hapus_sendiri on agenda
  for delete
  using (dibuat_oleh = auth.uid());
