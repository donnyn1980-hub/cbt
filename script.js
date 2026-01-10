let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API = 'https://cbt.donnyn1980.workers.dev';
const id = (e) => document.getElementById(e);

// Loader Logic [cite: 3, 46]
const setLoader = (show, text = "Memproses...") => {
    id('loader').style.display = show ? 'flex' : 'none';
    id('loader-text').innerText = text;
};

// Tahap 1: Login [cite: 22, 66]
async function login() {
    setLoader(true, "Memverifikasi Akun...");
    const payload = { nisn: id('nisn').value, password: id('pass').value, token: id('token').value };
    try {
        const r = await fetch(`${API}/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const d = await r.json();
        setLoader(false);
        if (d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
            showInfo();
        } else alert(d.msg);
    } catch (e) { setLoader(false); alert("Gagal terhubung ke server."); }
}

// Halaman Konfirmasi [cite: 27, 52, 71]
function showInfo() {
    id('p-login').classList.remove('active');
    id('p-info').classList.add('active');
    id('info-content').innerHTML = `
        <h2>Konfirmasi Data</h2>
        <p>Halo, <b>${u.nama}</b> (${u.kelas}), Anda akan mengerjakan Ujian dengan rincian sebagai berikut:</p>
        <div style="background:#f0f7ff; padding:15px; border-radius:10px; margin:15px 0;">
            <p><b>Mata Pelajaran:</b> ${ex.mata_pelajaran}</p>
            <p><b>Guru Pengampu:</b> ${ex.nama_guru}</p>
            <p><b>Jumlah Soal:</b> ${ex.total}</p>
            <p><b>Durasi:</b> ${ex.durasi} Menit</p>
        </div>
        <button class="btn btn-blue" onclick="startUjian()">MULAI UJIAN SEKARANG</button>
    `;
}

// Tahap 2: Sinkronisasi Soal [cite: 28, 72, 73]
async function startUjian() {
    setLoader(true, "Mengambil Soal...");
    try {
        const r = await fetch(`${API}/get-soal?token=${ex.token}`);
        qs = await r.json();
        setLoader(false);
        tIn = new Date().toISOString();
        isLive = true;
        id('p-info').classList.remove('active');
        id('p-quiz').classList.add('active');
        runTimer(ex.durasi * 60); // [cite: 32, 76]
        render();
    } catch (e) { setLoader(false); alert("Gagal mengambil soal."); }
}

function runTimer(sec) {
    tInt = setInterval(() => {
        if (sec <= 0) { clearInterval(tInt); finish(); }
        id('timer').innerText = `SISA WAKTU: ${Math.floor(sec/60)}:${sec%60 < 10 ? '0' : ''}${sec%60}`;
        sec--;
    }, 1000);
}

// Render Soal [cite: 33, 56, 77]
function render() {
    const s = qs[cur];
    let h = `<div class="card">`;
    if (s.stimulus) h += `<div class="stimulus">${s.stimulus}</div>`; // Abaikan jika kosong [cite: 56]
    if (s.img_link && s.img_link !== "-") h += `<img src="${s.img_link}" style="width:100%; border-radius:10px; margin-bottom:15px;">`;
    h += `<p><b>Soal ${cur+1}:</b> ${s.butir_soal}</p>`;
    
    ['a', 'b', 'c', 'd', 'e'].forEach(opt => {
        const val = s[`opsi_${opt}`];
        if (val && val !== "-") {
            const isSel = ans[s.rowid] === opt;
            h += `<button class="opt-btn ${isSel?'selected':''}" onclick="setAns('${s.rowid}', '${opt}')">${opt.toUpperCase()}. ${val}</button>`;
        }
    });
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
}

function setAns(rid, opt) {
    ans[rid] = opt; // Menggunakan rowid sebagai kunci [cite: 34, 78]
    render();
}

function updateGrid() {
    id('nav-grid').innerHTML = qs.map((s, i) => `<div class="box ${ans[s.rowid]?'done':''} ${i===cur?'now':''}" onclick="cur=${i};render()">${i+1}</div>`).join('');
    id('nav-buttons').innerHTML = `
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn" style="background:#666; color:white;" onclick="cur=Math.max(0, cur-1);render()">KEMBALI</button>
            ${cur === qs.length - 1 ? `<button class="btn btn-blue" style="background:var(--success)" onclick="preFinish()">KIRIM JAWABAN</button>` : `<button class="btn btn-blue" onclick="cur=Math.min(qs.length-1, cur+1);render()">LANJUT</button>`}
        </div>`;
}

function preFinish() { if(confirm("Kirim seluruh jawaban?")) finish(); }

// Tahap 3: Finalisasi [cite: 35, 79, 80]
async function finish() {
    setLoader(true, "Mengunggah Hasil...");
    clearInterval(tInt);
    isLive = false;
    const body = {
        siswa: u, infoUjian: ex, jawabanSiswa: ans, fraud: fraud,
        wkt_masuk: tIn, wkt_submit: new Date().toLocaleString('id-ID'),
        wkt_digunakan: `${Math.floor((new Date() - new Date(tIn))/60000)} Menit`
    };
    try {
        const r = await fetch(`${API}/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
        setLoader(false);
        // Pesan selesai sesuai pedoman [cite: 87]
        id('p-quiz').innerHTML = `
            <div class="container" style="text-align:center; padding-top:100px;">
                <i class="fas fa-check-circle" style="font-size:80px; color:var(--success)"></i>
                <h2>Proses Ujian Selesai</h2>
                <p>Terima kasih telah mengikuti ujian dengan jujur.</p>
                <p><b>Semoga mendapatkan hasil yang terbaik!</b></p>
                <button class="btn btn-blue" style="width:200px; margin-top:20px;" onclick="location.reload()">KELUAR</button>
            </div>`;
    } catch (e) { setLoader(false); alert("Gagal mengirim jawaban."); }
}

// Fraud Detection Logic [cite: 19, 62, 63]
document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++;
        if (fraud >= 10) document.body.className = 'warn-r';
        else if (fraud >= 5) document.body.className = 'warn-y';
    }
});
