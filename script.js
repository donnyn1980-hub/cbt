let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;

const id = (e) => document.getElementById(e);
const toggleLoader = (v) => id('loader').style.display = v ? 'flex' : 'none';

// Tahap 1: Inisiasi & Login [cite: 22, 66]
async function login() {
    const payload = { nisn: id('nisn').value, password: id('pass').value, token: id('token').value };
    if(!payload.nisn || !payload.token) return alert("Harap lengkapi semua data!");
    
    toggleLoader(true);
    try {
        const r = await fetch('https://cbt.donnyn1980.workers.dev/login', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload) 
        }); // [cite: 23, 67]
        const d = await r.json();
        toggleLoader(false);

        if(d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal; // [cite: 25, 26, 69, 70]
            id('p-login').classList.remove('active'); 
            id('p-info').classList.add('active'); // [cite: 27, 71]
            
            // Render Konfirmasi Data sesuai draf [cite: 52]
            id('info-render-area').innerHTML = `
                <h3 style="margin-top:0">Konfirmasi Data Peserta</h3>
                <div style="text-align:left; line-height:1.8; margin-bottom:20px;">
                    <p>Halo, <b>${u.nama}</b> (${u.kelas}), Anda akan mengerjakan Ujian dengan rincian sebagai berikut:</p>
                    <ul style="list-style:none; padding:0;">
                        <li><i class="fas fa-book-open"></i> Mata Pelajaran: <b>${ex.mata_pelajaran}</b></li>
                        <li><i class="fas fa-user-tie"></i> Guru Pengampu: <b>${ex.nama_guru}</b></li>
                        <li><i class="fas fa-list-ol"></i> Jumlah Soal: <b>${ex.total} Butir</b></li>
                        <li><i class="fas fa-clock"></i> Alokasi Waktu: <b>${ex.durasi} Menit</b></li>
                    </ul>
                </div>
            `;
        } else {
            alert("Akses Ditolak: " + d.msg);
        }
    } catch(e) { toggleLoader(false); alert("Kesalahan sinkronisasi server!"); }
}

// Tahap 2: Sinkronisasi Soal & Timer [cite: 28, 72]
async function start() {
    toggleLoader(true);
    try {
        const r = await fetch(`https://cbt.donnyn1980.workers.dev/get-soal?token=${ex.token}`); // [cite: 29, 73, 74]
        qs = await r.json(); 
        tIn = new Date(); 
        isLive = true;
        toggleLoader(false);

        if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        
        id('p-info').classList.remove('active'); 
        id('p-quiz').classList.add('active');
        runTimer(ex.durasi * 60); // [cite: 32, 76]
        render();
    } catch(e) { toggleLoader(false); alert("Gagal memuat bank soal!"); }
}

// Keamanan: Deteksi Pindah Tab [cite: 19, 62, 63]
document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++;
        if(fraud >= 10) document.body.className = 'warn-r';
        else if(fraud >= 5) document.body.className = 'warn-y';
    }
});

function runTimer(sec) {
    tInt = setInterval(() => {
        let m = Math.floor(sec/60), s = sec%60;
        id('timer').innerText = `SISA WAKTU: ${m}:${s<10?'0':''}${s}`;
        if(--sec < 0) { clearInterval(tInt); autoFinish(); } // [cite: 36, 80]
    }, 1000);
}

function render() {
    const s = qs[cur];
    let h = `<div class="card quiz-card">`;
    
    // Stimulus (Abaikan jika kosong) [cite: 56]
    if(s.st && s.st.trim() !== "" && s.st !== "-") h += `<div class="stimulus">${s.st}</div>`;
    
    // Gambar dari img_link [cite: 33, 77]
    if(s.img && s.img.trim() !== "" && s.img !== "-") h += `<img src="${s.img}" onerror="this.style.display='none'">`;
    
    h += `<p style="font-size:1.1rem; margin-bottom:20px;"><b>No ${cur+1}:</b> ${s.q}</p>`; // [cite: 13, 56]

    // Render berdasarkan Tipe Soal [cite: 43, 89]
    if(s.tp === 'Kategori') {
        const baris = s.q.split(';');
        h += `<table><tr><th>Kasus</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
        baris.forEach((txt, i) => {
            let curAnsArr = ans[s.rowid] ? ans[s.rowid].split(',') : new Array(baris.length).fill(""); // [cite: 34, 78]
            h += `<tr><td style="text-align:left">${txt}</td>
            <td><input type="radio" name="k_${s.rowid}_${i}" value="A" ${curAnsArr[i]=='A'?'checked':''} onchange="saveKat(${s.rowid},${i},'A',${baris.length})"></td>
            <td><input type="radio" name="k_${s.rowid}_${i}" value="B" ${curAnsArr[i]=='B'?'checked':''} onchange="saveKat(${s.rowid},${i},'B',${baris.length})"></td></tr>`;
        });
        h += `</table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        const curVal = ans[s.rowid] || "";
        s.opt.forEach(o => {
            const isC = curVal.split(',').includes(o.orig) ? 'checked' : '';
            h += `<label class="option-item"><input type="${typ}" name="q_${s.rowid}" value="${o.orig}" ${isC} onchange="saveAns(${s.rowid},'${s.tp}')"> ${o.text}</label>`;
        });
    }
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
}

window.saveAns = (rowid, tipe) => {
    const vals = Array.from(document.querySelectorAll(`input[name="q_${rowid}"]:checked`)).map(i => i.value);
    if(vals.length > 0) ans[rowid] = vals.sort().join(','); 
    else delete ans[rowid];
    
    updateGrid();
    if(tipe === 'Sederhana' && vals.length > 0) {
        setTimeout(() => { if(cur < qs.length - 1) move(1); }, 600);
    }
}

window.saveKat = (rowid, idx, val, total) => {
    let a = (ans[rowid] || "").split(',');
    if(a.length !== total) a = new Array(total).fill("");
    a[idx] = val;
    ans[rowid] = a.join(',');
    updateGrid();
}

function updateGrid() {
    const g = id('nav-grid'); g.innerHTML = '';
    let countDone = 0;
    qs.forEach((s, i) => {
        let cls = 'box' + (ans[s.rowid] ? ' done' : '') + (i === cur ? ' now' : ''); // [cite: 17, 18, 60, 61]
        if(ans[s.rowid]) countDone++;
        g.innerHTML += `<div class="${cls}" onclick="cur=${i};render()">${i+1}</div>`;
    });
    id('btn-finish').style.display = (countDone === qs.length) ? 'block' : 'none';
}

window.move = (step) => { cur += step; if(cur<0) cur=0; if(cur>=qs.length) cur=qs.length-1; render(); }

function preFinish() { if(confirm("Kirim semua jawaban sekarang? Data tidak bisa diubah lagi.")) autoFinish(); }

// Tahap 3: Finalisasi & Penyimpanan Permanen [cite: 35, 79]
async function autoFinish() {
    clearInterval(tInt); isLive = false; toggleLoader(true);
    let b = 0;
    
    // Hitung nilai di sisi client sebelum kirim (sesuai draf 1 kunci = 1 betul) [cite: 84, 85]
    const sorted = [...qs].sort((x, y) => x.rowid - y.rowid);
    const logAns = sorted.map(q => {
        const userA = ans[q.rowid] || "-";
        if(userA.replace(/\s/g,'') === q.key.replace(/\s/g,'')) b++;
        return userA;
    }).join('|');

    const tOut = new Date();
    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mata_pelajaran, 
        kelas: u.kelas, jenjang: u.jenjang, nilai: (b/qs.length)*100, 
        jml_curang: fraud, jml_benar: b, jml_salah: qs.length - b,
        wkt_masuk: tIn.toLocaleString(), wkt_submit: tOut.toLocaleString(),
        wkt_digunakan: `${Math.floor((tOut-tIn)/60000)} Menit`, jawaban: logAns // [cite: 86]
    };

    try {
        const response = await fetch('https://cbt.donnyn1980.workers.dev/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        toggleLoader(false);
        if(response.ok) {
            alert(`Proses ujian sudah selesai. Terimakasih ${u.nama}, semoga mendapatkan hasil yang terbaik.`); // [cite: 87]
            location.reload();
        } else {
            alert("Gagal menyimpan ke database!");
        }
    } catch(e) { toggleLoader(false); alert("Masalah koneksi database!"); }
}
