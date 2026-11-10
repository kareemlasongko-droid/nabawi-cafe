// Uji pilihan menu (sambal/saus/rasa): tepat satu pilihan per item, boleh
// menambah harga, dan pilihan sampai ke dapur + struk kasir.
// Pakai: node scripts/uji/pilihan.mjs   (server harus jalan di :3000)
const BASE=process.env.BASE??"http://localhost:3000"; let lulus=0,gagal=0;
const cek=(n,s,d="")=>{if(s){lulus++;console.log(`  LULUS  ${n}${d?" — "+d:""}`)}else{gagal++;console.log(`  GAGAL  ${n}${d?" — "+d:""}`)}};
const post=(j,o)=>fetch(BASE+j,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(async r=>({status:r.status,data:await r.json().catch(()=>null)}));
(async()=>{
  await post("/api/order/kasir",{aksi:"reset_demo"});
  const sesi="pil-"+Date.now();
  const rb=await post("/api/order/pesanan",{meja:"7",sesi,nama:"Uji Pilihan",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:["Salted Egg"]},{menu_id:23,jumlah:1,catatan:null,pilihan:["Mushroom"]}]});
  cek("pesanan ber-pilihan diterima",rb.status===200,`status ${rb.status}`);
  const it=rb.data?.items??[];
  cek("dua item tidak saling menimpa",it.length===2,`${it.length} item`);
  cek("item 1 simpan Salted Egg",JSON.stringify(it[0]?.pilihan)==='[{"nama":"Salted Egg","tambah":5000}]',JSON.stringify(it[0]?.pilihan));
  cek("item 2 simpan Mushroom",JSON.stringify(it[1]?.pilihan)==='[{"nama":"Mushroom","tambah":0}]',JSON.stringify(it[1]?.pilihan));
  // harga_satuan sudah TERMASUK tambahan (Rice Bowl 50.000 + Salted Egg 5.000).
  cek("tambahan Rp5.000 masuk harga satuan",it[0]?.harga_satuan===55000,`Rp${it[0]?.harga_satuan}`);
  cek("item tanpa tambahan tetap",it[1]?.harga_satuan===55000,`Rp${it[1]?.harga_satuan}`);
  cek("subtotal = jumlah kedua baris",rb.data?.tagihan?.subtotal===110000,`Rp${rb.data?.tagihan?.subtotal}`);
  const salah=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"x",nama:"U",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:["Sambal Nuklir"]}]});
  cek("pilihan tidak dikenal ditolak",salah.status===400,`status ${salah.status}`);
  const objek=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"y",nama:"U",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:{nama:"Salted Egg"}}]});
  cek("pilihan bentuk objek ditolak",objek.status===400,`status ${objek.status}`);
  const bany=await post("/api/order/pesanan",{meja:"7",sesi:sesi+"z",nama:"U",lewatiJamBuka:true,
    items:[{menu_id:3,jumlah:1,catatan:null,pilihan:["Salted Egg","BBQ"]}]});
  cek("dua pilihan sekaligus ditolak",bany.status===400,`status ${bany.status}`);
  const k=await fetch(BASE+"/api/order/kasir").then(r=>r.json());
  const adaPilihan=k.menu.filter(m=>Array.isArray(m.pilihan)&&m.pilihan.length>0).length;
  cek("menu ber-pilihan di kasir",adaPilihan>=4,`${adaPilihan} menu`);
  console.log(`\n═══ ${lulus} lulus, ${gagal} gagal ═══`);
  if(gagal>0) process.exit(1);
})();
