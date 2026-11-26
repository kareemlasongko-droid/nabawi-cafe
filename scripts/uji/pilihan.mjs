// Uji pilihan menu (sambal/saus/rasa): tepat satu pilihan per item, boleh
// menambah harga, dan pilihan sampai ke dapur + struk kasir.
// Pakai: node scripts/uji/pilihan.mjs   (server harus jalan di :3000)
const BASE=process.env.BASE??"http://localhost:3000"; let lulus=0,gagal=0;
const cek=(n,s,d="")=>{if(s){lulus++;console.log(`  LULUS  ${n}${d?" — "+d:""}`)}else{gagal++;console.log(`  GAGAL  ${n}${d?" — "+d:""}`)}};
const post=(j,o)=>fetch(BASE+j,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(async r=>({status:r.status,data:await r.json().catch(()=>null)}));
(async()=>{
  await post("/api/order/kasir",{aksi:"reset_demo"});

  /*
    ── HARGA DIAMBIL DARI SERVER, BUKAN DITULIS DI SINI ────────────────

    Versi lama mengunci angka: "Salted Egg +5.000", "Mushroom +0",
    "harga_satuan 55.000", "subtotal 110.000". Semua itu benar pada satu
    titik waktu, lalu migrasi `20261103000200_isi_pilihan_menu.sql`
    mengubah tambahan beberapa pilihan menjadi berbayar (+4.000).

    Sejak itu uji ini gagal TIGA cek sekaligus dengan pesan yang terbaca
    seperti bug harga — padahal yang berubah hanya daftar harga, dan
    perhitungan server tetap benar.

    Sekarang uji membaca menu lebih dulu, memilih DUA menu yang benar-benar
    punya pilihan, lalu membandingkan hasilnya dengan harga yang baru saja
    dibacanya. Uji ini jadi menguji ARITMATIKA (tambahan ikut terhitung di
    harga satuan dan subtotal), bukan menguji daftar harga.
  */
  // Katalog LENGKAP (harga + daftar pilihan) ada di rute kasir;
  // `/menu/tersedia` hanya membawa status tersedia/habis.
  const katalog=await fetch(BASE+"/api/order/kasir").then(r=>r.json());
  const daftar=katalog.menu??[];
  const berPilihan=daftar.filter(m=>Array.isArray(m.pilihan)&&m.pilihan.length>0);

  if(berPilihan.length<2){
    cek("ada minimal dua menu ber-pilihan untuk diuji",false,`${berPilihan.length} menu`);
      if(gagal>0) process.exit(1);
    return;
  }

  const pilih=(m)=>{
    const opsi=m.pilihan;
    // Satu pilihan yang berbayar dan satu yang gratis, bila ada — keduanya
    // harus muncul di harga satuan.
    return opsi.find(o=>(o.tambah??0)>0)??opsi[0];
  };
  const m1=berPilihan[0], m2=berPilihan[1];
  const o1=pilih(m1), o2=pilih(m2);
  const sesi="pil-"+Date.now();

  const rb=await post("/api/order/pesanan",{meja:"7",sesi,nama:"Uji Pilihan",no_wa:"081200000002",lewatiJamBuka:true,
    items:[{menu_id:m1.id,jumlah:1,catatan:null,pilihan:[o1.nama]},{menu_id:m2.id,jumlah:1,catatan:null,pilihan:[o2.nama]}]});
  cek("pesanan ber-pilihan diterima",rb.status===200,`status ${rb.status}`);
  const it=rb.data?.items??[];
  cek("dua item tidak saling menimpa",it.length===2,`${it.length} item`);
  cek(`item 1 simpan ${o1.nama}`,JSON.stringify(it[0]?.pilihan)===JSON.stringify([{nama:o1.nama,tambah:o1.tambah??0}]),JSON.stringify(it[0]?.pilihan));
  cek(`item 2 simpan ${o2.nama}`,JSON.stringify(it[1]?.pilihan)===JSON.stringify([{nama:o2.nama,tambah:o2.tambah??0}]),JSON.stringify(it[1]?.pilihan));
  // harga_satuan sudah TERMASUK tambahan pilihan.
  const harap1=m1.harga+(o1.tambah??0), harap2=m2.harga+(o2.tambah??0);
  cek("tambahan pilihan masuk harga satuan",it[0]?.harga_satuan===harap1,`Rp${it[0]?.harga_satuan}, harusnya Rp${harap1}`);
  cek("item kedua juga membawa tambahannya",it[1]?.harga_satuan===harap2,`Rp${it[1]?.harga_satuan}, harusnya Rp${harap2}`);
  cek("subtotal = jumlah kedua baris",rb.data?.tagihan?.subtotal===harap1+harap2,`Rp${rb.data?.tagihan?.subtotal}, harusnya Rp${harap1+harap2}`);
  const salah=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"x",nama:"U",no_wa:"081200000002",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:["Sambal Nuklir"]}]});
  cek("pilihan tidak dikenal ditolak",salah.status===400,`status ${salah.status}`);
  const objek=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"y",nama:"U",no_wa:"081200000002",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:{nama:"Salted Egg"}}]});
  cek("pilihan bentuk objek ditolak",objek.status===400,`status ${objek.status}`);
  const bany=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"z",nama:"U",no_wa:"081200000002",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:["Salted Egg","BBQ"]}]});
  cek("dua pilihan sekaligus ditolak",bany.status===400,`status ${bany.status}`);
  const k=await fetch(BASE+"/api/order/kasir").then(r=>r.json());
  const adaPilihan=k.menu.filter(m=>Array.isArray(m.pilihan)&&m.pilihan.length>0).length;
  cek("menu ber-pilihan di kasir",adaPilihan>=4,`${adaPilihan} menu`);

  /*
    Pesanan uji dibatalkan sebelum keluar.

    Uji ini harus membuat pesanan sungguhan untuk memeriksa pilihan, tetapi
    pesanan yang ditinggalkan dalam status "menunggu bayar" ikut terhitung
    di ringkasan kasir — dan `riwayat:http` membaca angka itu dari database
    yang sama. Uji yang tidak membersihkan jejaknya membuat uji lain gagal
    dengan selisih tepat satu pesanan.
  */
  if(rb.data?.pesanan?.id){
    await fetch(BASE+"/api/order/status",{method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:rb.data.pesanan.id,ke:"dibatalkan",alasan:"pembersihan uji pilihan"})});
  }

  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  if(gagal>0) process.exit(1);
})();
