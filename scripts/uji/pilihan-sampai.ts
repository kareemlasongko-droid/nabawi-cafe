/**
 * Uji: apakah pilihan/add-on benar-benar SAMPAI ke layar yang membutuhkan?
 *
 * Kenapa berkas ini ada — dan kenapa uji sebelumnya tidak menangkap
 * masalahnya:
 *
 * Uji `pilihan.mjs` memeriksa respons POST /api/order/pesanan. Di situ
 * `pilihan` ADA, jadi uji hijau. Yang tidak diperiksa adalah respons
 * /api/order/dapur dan /api/order/pelayan — dan di dua tempat itu route
 * membangun ulang objek item dan LUPA menyalin `pilihan`. Akibatnya di
 * layar dapur kolom saus tidak pernah muncul, padahal seluruh fitur
 * dibangun justru untuk itu.
 *
 * Pelajarannya: menguji "data tersimpan" tidak sama dengan menguji
 * "data sampai". Setiap endpoint yang punya pembaca sendiri harus diuji
 * sendiri.
 *
 * Jalankan (server menyala):
 *   node --experimental-strip-types --import ./scripts/uji/ts-hook.mjs \
 *        scripts/uji/pilihan-sampai.ts
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
let lulus = 0;
let gagal = 0;
const cek = (nama: string, syarat: boolean, detail = "") => {
  if (syarat) {
    lulus++;
    console.log(`  LULUS  ${nama}${detail ? " — " + detail : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${detail ? " — " + detail : ""}`);
  }
};

const post = (j: string, o: unknown) =>
  fetch(BASE + j, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(o),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

const patch = (j: string, o: unknown) =>
  fetch(BASE + j, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(o),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

await post("/api/order/kasir", { aksi: "reset_demo" });

// Pesanan dengan add-on + catatan, supaya terlihat keduanya tidak tertukar.
const r = await post("/api/order/pesanan", {
  meja: "9",
  sesi: "sampai-" + Date.now(),
  nama: "Tamu AddOn",
  lewatiJamBuka: true,
  items: [
    { menu_id: 3, jumlah: 1, catatan: "tanpa bawang", pilihan: ["Salted Egg"] },
    { menu_id: 59, jumlah: 2, catatan: null, pilihan: ["Caramel"] },
  ],
});
cek("pesanan dibuat", r.status === 200, `status ${r.status}`);
const id = r.data?.pesanan?.id;

console.log("\n── 1. Respons pembuatan pesanan ──");
cek("item 1 menyimpan add-on", r.data?.items?.[0]?.pilihan?.[0]?.nama === "Salted Egg");
cek("item 2 menyimpan add-on", r.data?.items?.[1]?.pilihan?.[0]?.nama === "Caramel");
cek("item tanpa add-on tidak dikarang", r.data?.items?.[1]?.pilihan?.length === 1);

await patch("/api/order/status", { id, ke: "diterima" });

console.log("\n── 2. /api/order/dapur (papan dapur) ──");
const dapur = await (await fetch(BASE + "/api/order/dapur")).json();
const tiket = (dapur.tiket ?? []).find((t: { id: number }) => t.id === id);
cek("tiket sampai ke dapur", Boolean(tiket));
const itemDapur = tiket?.items ?? [];
cek(
  "add-on sampai ke dapur",
  itemDapur[0]?.pilihan?.[0]?.nama === "Salted Egg",
  JSON.stringify(itemDapur[0]?.pilihan)
);
cek("add-on item kedua juga", itemDapur[1]?.pilihan?.[0]?.nama === "Caramel");
cek("catatan tetap terpisah dari add-on", itemDapur[0]?.catatan === "tanpa bawang");
cek("jumlah tetap benar", itemDapur[1]?.jumlah === 2);

await patch("/api/order/status", { id, ke: "diproses" });
await patch("/api/order/status", { id, ke: "siap" });

console.log("\n── 3. /api/order/pelayan (layar antar) ──");
const pelayan = await (await fetch(BASE + "/api/order/pelayan")).json();
const siap = (pelayan.siap ?? []).find((p: { id: number }) => p.id === id);
cek("pesanan siap sampai ke pelayan", Boolean(siap));
cek(
  "add-on sampai ke pelayan",
  siap?.items?.[0]?.pilihan?.[0]?.nama === "Salted Egg",
  JSON.stringify(siap?.items?.[0]?.pilihan)
);

console.log("\n── 4. Menu tanpa add-on tidak berubah bentuk ──");
await post("/api/order/kasir", { aksi: "reset_demo" });
const polos = await post("/api/order/pesanan", {
  meja: "9",
  sesi: "polos-" + Date.now(),
  nama: "Tamu",
  lewatiJamBuka: true,
  items: [{ menu_id: 1, jumlah: 1, catatan: null, pilihan: [] }],
});
cek("pesanan tanpa add-on berhasil", polos.status === 200);
cek("pilihan berupa array kosong, bukan undefined", Array.isArray(polos.data?.items?.[0]?.pilihan), JSON.stringify(polos.data?.items?.[0]?.pilihan));
await patch("/api/order/status", { id: polos.data?.pesanan?.id, ke: "diterima" });
const dapur2 = await (await fetch(BASE + "/api/order/dapur")).json();
const tiket2 = (dapur2.tiket ?? []).find((t: { id: number }) => t.id === polos.data?.pesanan?.id);
cek("dapur tetap menerima array kosong", Array.isArray(tiket2?.items?.[0]?.pilihan));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal > 0) process.exit(1);

export {};
