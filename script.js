let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;

const id = (e) => document.getElementById(e);
const toggleLoader = (v) => id('loader').style.display = v ? 'flex' : 'none';

async function login() {
    const p = { nisn: id('nisn').value, password: id('pass').value, token: id('token').value };
    if(!p.nisn || !p.token) return alert("Lengkapi data!");
    
    toggleLoader(true);
    try {
        const r = await fetch('https://cbt.donnyn1980.workers.dev/login', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(p) 
        });
        const d = await r.json();
        toggleLoader(false);

        if(d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
            id('p-login').classList.remove('active');
            id('p-info').classList.add('active');
            
            // Render Konfirmasi sesuai draf [cite: 9, 52]
            id('info-render-area').innerHTML = `
                <div class="info-grid">
                    <p>Halo, <strong>${u.nama}</strong> (${u.kelas}), Anda akan mengerjakan ujian:</p>
                    <div class="meta-box">
                        <div class="meta-item"><i class="fas fa-book"></i> <span>Mapel:</span> <strong>${ex.mata_pelajaran}</strong></div>
                        <div class="meta-item"><i class="fas fa-user-tie"></i> <span>Guru:</span> <strong>${ex.nama_guru}</strong></div>
                        <div class="meta-item"><i class="fas fa-list-ol"></i> <span>Jumlah:</span> <strong>${ex.total} Soal</strong></div>
                        <div class="meta-item"><i class="fas fa-hourglass-half"></i> <span>Waktu:</span> <strong>${ex.durasi} Menit</strong></div>
                    </div>
                </div>
            `;
        } else alert("Ditolak: " + d.msg);
    } catch(e) { toggleLoader(false); alert("Database Offline!"); }
}

async function start() {
    toggleLoader(true);
    try {
        const r = await fetch(`https://cbt.donnyn1980.workers.dev/get-soal?token=${ex.token}`);
        qs = await r.json(); 
        tIn = new Date(); 
        isLive = true;
        id('user-display').innerText = `${u.nama} | ${ex.mata_pelajaran}`;
        toggleLoader(false);

        if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        id('p-info').classList.remove('active');
        id('p-quiz').classList.add('active');
        runTimer(ex.durasi * 60);
        render();
    } catch(e) { toggleLoader(false); alert("Gagal Sinkronisasi!"); }
}

// Fraud Detection Logic [cite: 19, 62]
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
        id('timer').innerText = `${m}:${s<10?'0':''}${s}`;
        if(--sec < 0) { clearInterval(tInt); autoFinish(); }
    }, 1000);
}

function render() {
    const s = qs[cur];
    let h = `<div class="card quiz-card slide-up">`;
    if(s.st && s.st !== "-") h += `<div class="stimulus">${s.st}</div>`;
    if(s.img && s.img !== "-") h += `<div class="img-wrapper"><img src="${s.img}" alt="Soal"></div>`;
    h += `<div class="q-text">No ${cur+1}: ${s.q}</div>`;

    if(s.tp === 'Kategori') {
        const rows = s.q.split(';');
        h += `<table><thead><tr><th>Kasus</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr></thead><tbody>`;
        rows.forEach((txt, i) => {
            let curA = (ans[s.rowid] || "").split(',');
            h += `<tr><td>${txt}</td>
            <td><input type="radio" name="k_${s.rowid}_${i}" value="A" ${curA[i]=='A'?'checked':''} onchange="saveKat(${s.rowid},${i},'A',${rows.length})"></td>
            <td><input type="radio" name="k_${s.rowid}_${i}" value="B" ${curA[i]=='B'?'checked':''} onchange="saveKat(${s.rowid},${i},'B',${rows.length})"></td></tr>`;
        });
        h += `</tbody></table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        s.opt.forEach(o => {
            const isC = (ans[s.rowid] || "").split(',').includes(o.orig) ? 'checked' : '';
            h += `<label class="option-item">
                    <input type="${typ}" name="q_${s.rowid}" value="${o.orig}" ${isC} onchange="saveAns(${s.rowid},'${s.tp}')">
                    <span>${o.text}</span>
                  </label>`;
        });
    }
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
}

window.saveAns = (rid, tipe) => {
    const v = Array.from(document.querySelectorAll(`input[name="q_${rid}"]:checked`)).map(i => i.value);
    if(v.length > 0) ans[rid] = v.sort().join(','); else delete ans[rid];
    updateGrid();
    if(tipe === 'Sederhana' && v.length > 0) setTimeout(() => move(1), 500);
};

window.saveKat = (rid, idx, val, total) => {
    let a = (ans[rid] || "").split(',');
    if(a.length !== total) a = new Array(total).fill("");
    a[idx] = val; ans[rid] = a.join(',');
    updateGrid();
};

function updateGrid() {
    const g = id('nav-grid'); g.innerHTML = '';
    let done = 0;
    qs.forEach((s, i) => {
        let cls = 'box' + (ans[s.rowid] ? ' done' : '') + (i === cur ? ' now' : '');
        if(ans[s.rowid]) done++;
        g.innerHTML += `<div class="${cls}" onclick="cur=${i};render()">${i+1}</div>`;
    });
    id('btn-finish').style.display = (done === qs.length) ? 'block' : 'none';
}

window.move = (s) => { 
    const next = cur + s;
    if(next >= 0 && next < qs.length) { cur = next; render(); }
};

function preFinish() { if(confirm("Konfirmasi pengiriman jawaban?")) autoFinish(); }

async function autoFinish() {
    clearInterval(tInt); isLive = false; toggleLoader(true);
    let b = 0;
    const log = qs.map(q => {
        const uA = ans[q.rowid] || "-";
        if(uA.trim() === q.key.trim()) b++;
        return uA;
    }).join('|');

    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mata_pelajaran, 
        kelas: u.kelas, jenjang: u.jenjang, nilai: (b/qs.length)*100, 
        jml_curang: fraud, wkt_masuk: tIn.toLocaleString(), 
        wkt_submit: new Date().toLocaleString(), jawaban: log
    };

    try {
        await fetch('https://cbt.donnyn1980.workers.dev/submit', { method: 'POST', body: JSON.stringify(body) });
        toggleLoader(false);
        alert(`Ujian Selesai. Terimakasih ${u.nama}, semoga mendapatkan hasil yang terbaik.`); [cite: 87]
        location.reload();
    } catch(e) { toggleLoader(false); alert("Gagal Simpan!"); }
}
