import { readFileSync } from "node:fs";
import { aksiTiketDapur, TAHAP_DAPUR, tiketPadaTahap } from "../../app/lib/order/tahap-dapur.ts";

let lulus = 0;
let gagal = 0;
const cek = (nama, kondisi, rincian = "") => {
  if (kondisi) {
    lulus++;
    console.log(`  LULUS  ${nama}${rincian ? ` — ${rincian}` : ""}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${rincian ? ` — ${rincian}` : ""}`);
  }
};

const tiket = [
  { id: 1, status: "menunggu_konfirmasi" },
  { id: 2, status: "diterima" },
  { id: 3, status: "diproses" },
  { id: 4, status: "siap" },
  { id: 5, status: "diantar" },
];
const perTahap = TAHAP_DAPUR.map((tahap) => tiketPadaTahap(tiket, tahap));

console.log("\n── Papan dapur: tiga tahap pada satu layar ──");
cek("papan memiliki tepat tiga tahap", TAHAP_DAPUR.length === 3);
cek("pesanan lunas yang menunggu konfirmasi masuk tahap Baru", perTahap[0].some((t) => t.id === 1));
cek("pesanan diterima kasir masuk tahap Baru", perTahap[0].some((t) => t.id === 2));
cek("tahap Baru mengeluarkan tiket sekali saja", perTahap[0].length === 2);
cek(
  "status menunggu_konfirmasi maju satu langkah ke diterima",
  aksiTiketDapur("menunggu_konfirmasi", TAHAP_DAPUR[0]).ke === "diterima",
);
cek(
  "status menunggu_konfirmasi diberi aksi Terima",
  aksiTiketDapur("menunggu_konfirmasi", TAHAP_DAPUR[0]).label === "Terima",
);
cek("tahap Diproses menampilkan status diproses", perTahap[1].map((t) => t.id).join(",") === "3");
cek("tahap Siap menampilkan status siap", perTahap[2].map((t) => t.id).join(",") === "4");
cek("tiket yang sudah diantar tidak tampil lagi", perTahap.flat().every((t) => t.id !== 5));

const ui = readFileSync(new URL("../../app/components/order/PortalDapur.tsx", import.meta.url), "utf8");
cek("sidebar dapur memakai dua tujuan saja", /kunci: "antrean"[\s\S]*kunci: "menu"/.test(ui));
cek("tiga tahap dirender bersama sebagai grid, bukan tab", ui.includes("TAHAP_DAPUR.map") && !ui.includes("tabAktif"));
cek("halaman Menu punya aksi pulihkan ketersediaan", ui.includes("Aktifkan tersedia") && ui.includes("setTersedia(m.id, !m.tersedia)"));

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal) process.exit(1);
