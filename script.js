const autoFinish = async () => {
    showLoader(true, "Mengirim Nilai...");
    if(tInt) clearInterval(tInt);
    isLive = false;
    
    let jml_benar = 0;
    const sorted = [...qs].sort((x, y) => x.id - y.id);
    const logAns = sorted.map(q => {
        const userA = ans[q.id] || "-";
        // Normalisasi spasi untuk akurasi pengecekan
        if(userA.toString().trim() === q.key.toString().trim()) jml_benar++;
        return userA;
    }).join('|');

    const nilaiSiswa = (jml_benar / qs.length) * 100;

    const body = {
        nisn: u.nisn,
        nama: u.nama,
        nama_guru: ex.nama_guru,
        mapel: ex.mapel,
        kelas: u.kelas,
        jenjang: ex.jenjang,
        nilai: nilaiSiswa.toFixed(2),
        jml_curang: fraud,
        jml_benar: jml_benar,
        jml_salah: qs.length - jml_benar,
        wkt_masuk: new Date(tIn).toLocaleString('id-ID'),
        wkt_submit: new Date().toLocaleString('id-ID'),
        wkt_digunakan: `${Math.floor((new Date() - new Date(tIn)) / 60000)} Menit`,
        jawaban: logAns
    };

    try {
        const res = await fetch(`${API_URL}/submit`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body) 
        });
        
        const responseData = await res.json();
        
        if(res.ok && responseData.success) { 
            alert("Jawaban Berhasil Terkirim!");
            localStorage.clear(); 
            location.reload(); 
        } else {
            console.error("Detail Error Server:", responseData);
            alert("Gagal simpan: " + (responseData.message || "Respon server tidak valid"));
        }
    } catch(e) { 
        console.error("Network Error:", e);
        alert("Gagal terhubung ke server untuk mengirim nilai!"); 
    } finally {
        showLoader(false);
    }
};
