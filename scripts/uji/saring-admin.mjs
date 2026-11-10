/**
 * Uji logika saringan di portal admin (/order/admin).
 *
 * Fungsi `normal` dan `saring` di bawah adalah SALINAN dari PortalAdmin.tsx.
 * Itu kelemahan yang disadari: kalau logika di komponen diubah dan salinan
 * ini tidak, uji tetap hijau padahal perilakunya berbeda. Kompensasinya:
 * fungsi aslinya kecil dan sudah diberi komentar "jangan diubah tanpa
 * menyesuaikan scripts/uji/saring-admin.mjs".
 *
 * Pakai: node scripts/uji/saring-admin.mjs   (server harus jalan di :3000)
 */
const B = process.env.BASE ?? "http://localhost:3000";
let lulus = 0, gagal = 0;
const cek = (n, s, d = "") => { s ? (lulus++, console.log(`  LULUS  ${n}${d?" — "+d:""}`)) : (gagal++, console.log(`  GAGAL  ${n}${d?" — "+d:""}`)); };

// Fungsi yang sama persis dengan PortalAdmin.tsx
function normal(t){return t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function saring(menu, namaKategori, cari, kategori, status){
  const kata = normal(cari);
  return menu.filter((m)=>{
    if (kategori!=="semua" && m.kategori_id!==kategori) return false;
    if (status==="ada" && !m.tersedia) return false;
    if (status==="habis" && m.tersedia) return false;
    if (!kata) return true;
    const isi=[m.nama, m.deskripsi??"", m.kategori_id?(namaKategori.get(m.kategori_id)??""):""];
    return isi.some(t=>normal(t).includes(kata));
  });
}
const {menu} = await (await fetch(B+"/api/order/kasir")).json();
const kat = [...new Map(menu.map(m=>[m.kategori_id,m.kategori_id])).keys()];
const namaKategori = new Map([[1,"Makanan Utama"],[2,"Camilan & Pastry"],[3,"Kopi"],[4,"Non-Kopi"],[5,"Cheese & Milkshake"],[6,"Jus & Dessert"]]);

cek("data menu terbaca", menu.length===126, `${menu.length} item`);
const semua = saring(menu,namaKategori,"","semua","semua");
cek("tanpa saringan = semua menu", semua.length===126);

const kopi = saring(menu,namaKategori,"kopi","semua","semua");
cek("cari 'kopi' menemukan menu", kopi.length>0, `${kopi.length} hasil`);
cek("'kopi' juga menangkap kategori Kopi", kopi.some(m=>namaKategori.get(m.kategori_id)==="Kopi"));

const kapital = saring(menu,namaKategori,"KOPI","semua","semua");
cek("besar/kecil huruf tidak berpengaruh", kapital.length===kopi.length, `${kapital.length} = ${kopi.length}`);
const spasi = saring(menu,namaKategori,"  kopi  ","semua","semua");
cek("spasi di tepi diabaikan", spasi.length===kopi.length);

const ktg = saring(menu,namaKategori,"",3,"semua");
cek("filter kategori Kopi", ktg.length===24, `${ktg.length} menu (harus 24)`);
cek("semua hasil memang kategori 3", ktg.every(m=>m.kategori_id===3));

const habisTotal = menu.filter(m=>!m.tersedia).length;
const habis = saring(menu,namaKategori,"","semua","habis");
cek("filter 'Habis' akurat", habis.length===habisTotal, `${habis.length} dari ${habisTotal}`);
const ada = saring(menu,namaKategori,"","semua","ada");
cek("filter 'Tersedia' akurat", ada.length===126-habisTotal, `${ada.length}`);
cek("ada + habis = total", ada.length+habis.length===126);

const gabung = saring(menu,namaKategori,"ayam",1,"semua");
cek("kata + kategori digabung", gabung.every(m=>m.kategori_id===1)&&gabung.every(m=>normal(m.nama+m.deskripsi).includes("ayam")), `${gabung.length} hasil`);
const kosong = saring(menu,namaKategori,"zzzz","semua","semua");
cek("kata tak ada → hasil kosong", kosong.length===0);

// Hitungan chip per kategori harus sama dengan hasil saringan bila kategori itu dipilih.
let cocok = 0;
for (const [id,nama] of namaKategori) {
  const jml = saring(menu,namaKategori,"",id,"semua").length;
  const chip = saring(menu,namaKategori,"","semua","semua").filter(m=>m.kategori_id===id).length;
  if (jml===chip) cocok++;
}
cek("angka chip = isi tabel untuk 6 kategori", cocok===6, `${cocok}/6`);

// Diakritik
const uji = [{id:1,nama:"Crème Brûlée",deskripsi:"",kategori_id:6,tersedia:true}];
cek("'creme' menemukan 'Crème'", saring(uji,namaKategori,"creme","semua","semua").length===1);
cek("'brûlée' menemukan juga", saring(uji,namaKategori,"brulee","semua","semua").length===1);

console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
if (gagal>0) process.exit(1);
