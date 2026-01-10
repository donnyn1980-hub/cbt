let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;

const id = (e) => document.getElementById(e);
const toggleLoader = (v) => id('loader').style.display = v ? 'flex' : 'none';

// Tahap 1: Login & Inisiasi [cite: 22, 66]
async function login() {
    const payload = { nisn: id('nisn').value, password: id('pass').value, token: id('token').value };
    toggleLoader(true);
    
    try {
        const r = await fetch('https://cbt.donnyn1980.workers.dev/login', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload) 
        });
        const d = await r.json();
        toggleLoader(false);

        if(d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
            id('p-login').classList.remove('active'); 
            id('p-info').classList.add('active');
            
            // Render sesuai draf [cite: 52]
            id('info-render-area').innerHTML = `
                <h3>Konfirmasi Data Peserta</h3>
                <p>Halo, <b>${u.nama}</b> (${u.kelas}), Anda akan mengerjakan Ujian dengan rincian sebagai berikut:</p>
                <ul>
                    <li>Mata Pelajaran: <b>${ex.mata_pelajaran}</b></li>
                    <li>Guru Pengampu: <b>${ex.nama_guru}</b></li>
                    <li>Jumlah Soal: <b>${ex.total} Butir</b></li>
                    <li>Alokasi Waktu: <b>${ex.durasi} Menit</b></li>
                </ul>
            `;
        } else alert("Akses Ditolak: " + d.msg);
    } catch(e) { toggleLoader(false); alert("Error koneksi database!"); }
}

// Tahap 2: Sinkronisasi Soal [cite: 28, 72]
async function start() {
    toggleLoader(true);
    try {
        const r = await fetch(`https://cbt.donnyn1980.workers.dev/get-soal?token=${ex.token}`);
        qs = await r.json(); 
        tIn = new Date(); 
        isLive = true;
        toggleLoader(false);

        if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        
        id('p-info').classList.remove('active'); 
        id('p-quiz').classList.add('active');
        runTimer(ex.durasi * 60); // [cite: 32, 76]
        render();
    } catch(e) { toggleLoader(false); alert("Gagal sinkronisasi soal!"); }
}

// Deteksi Kecurangan 
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
        if(--sec < 0) { clearInterval(tInt); autoFinish(); }
    }, 1000);
}

function render() {
    const s = qs[cur];
    let h = `<div class="card">`;
    if(s.st && s.st !== "-") h += `<div class="stimulus">${s.st}</div>`; // [cite: 56]
    if(s.img && s.img !== "-") h += `<img src="${s.img}" style="max-width:100%">`;
    
    h += `<p><b>No ${cur+1}:</b> ${s.q}</p>`;
    
    // Logika Tipe Soal: Sniper Logic
    if(s.tp === 'Kategori') {
        const baris = s.q.split(';');
        h += `<table><tr><th>Kasus</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
        baris.forEach((txt, i) => {
            let curAnsArr = ans[s.id] ? ans[s.id].split(',') : new Array(baris.length).fill("");
            const val = curAnsArr[i] || "";
            h += `<tr><td>${txt}</td>
            <td><input type="radio" name="k_${s.id}_${i}" value="A" ${val=='A'?'checked':''} onchange="saveKat(${s.id},${i},'A',${baris.length})"></td>
            <td><input type="radio" name="k_${s.id}_${i}" value="B" ${val=='B'?'checked':''} onchange="saveKat(${s.id},${i},'B',${baris.length})"></td></tr>`;
        });
        h += `</table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        const curVal = ans[s.id] || "";
        s.opt.forEach(o => {
            const isC = curVal.split(',').includes(o.orig) ? 'checked' : '';
            h += `<label class="option-item"><input type="${typ}" name="q_${s.id}" value="${o.orig}" ${isC} onchange="saveAns(${s.id},'${s.tp}')"> ${o.text}</label>`;
        });
    }
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
}

window.saveAns = (id_soal, tipe) => {
    const inputs = document.querySelectorAll(`input[name="q_${id_soal}"]:checked`);
    const vals = Array.from(inputs).map(i => i.value);
    if(vals.length > 0) ans[id_soal] = vals.sort().join(',');
    else delete ans[id_soal];
    updateGrid();
    if(tipe === 'Sederhana' && vals.length > 0) setTimeout(() => { if(cur < qs.length - 1) move(1); }, 600);
}

window.saveKat = (id_soal, idx, val, total) => {
    let a = (ans[id_soal] || "").split(',');
    if(a.length !== total) a = new Array(total).fill("");
    a[idx] = val;
    ans[id_soal] = a.join(',');
    updateGrid();
}

function updateGrid() {
    const g = id('nav-grid'); g.innerHTML = '';
    let countDone = 0;
    qs.forEach((s, i) => {
        let cls = 'box';
        if(ans[s.id]) { cls += ' done'; countDone++; } // [cite: 17, 60]
        if(i === cur) cls += ' now'; // [cite: 18, 61]
        g.innerHTML += `<div class="${cls}" onclick="cur=${i};render()">${i+1}</div>`;
    });
    id('btn-finish').style.display = (countDone === qs.length) ? 'block' : 'none';
}

window.move = (step) => { cur += step; if(cur<0) cur=0; if(cur>=qs.length) cur=qs.length-1; render(); }

function preFinish() { if(confirm("Kirim jawaban sekarang?")) autoFinish(); }

// Tahap 3: Finalisasi & Simpan [cite: 35, 79]
async function autoFinish() {
    clearInterval(tInt); isLive = false; toggleLoader(true);
    let b = 0;
    const sorted = [...qs].sort((x, y) => x.id - y.id);
    const logAns = sorted.map(q => {
        const userA = ans[q.id] || "-";
        if(userA.replace(/\s/g,'') === q.key.replace(/\s/g,'')) b++;
        return userA;
    }).join('|');

    const tOut = new Date();
    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mata_pelajaran, 
        kelas: u.kelas, jenjang: u.jenjang, nilai: (b/qs.length)*100, // [cite: 85]
        jml_curang: fraud, jml_benar: b, jml_salah: qs.length - b,
        wkt_masuk: tIn.toLocaleString(), wkt_submit: tOut.toLocaleString(),
        wkt_digunakan: `${Math.floor((tOut-tIn)/60000)} Menit`, jawaban: logAns
    };

    try {
        await fetch('https://cbt.donnyn1980.workers.dev/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        toggleLoader(false);
        // Pesan penutup sesuai draf [cite: 87]
        alert(`Ujian Selesai! Terimakasih ${u.nama}, semoga mendapatkan hasil yang terbaik.`);
        location.reload();
    } catch(e) { toggleLoader(false); alert("Gagal mengirim data!"); }
}
