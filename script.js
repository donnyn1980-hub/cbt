let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API_URL = 'https://cbt.donnyn1980.workers.dev';

const id = (e) => document.getElementById(e);

// --- 1. RENDER UI AWAL ---
const initApp = () => {
    id('login-root').innerHTML = `
        <div class="card" style="max-width:400px; margin:auto">
            <h2 style="text-align:center">LOGIN UJIAN</h2>
            <div class="input-group"><input type="text" id="nisn" placeholder="NISN"></div>
            <div class="input-group">
                <input type="password" id="pass" placeholder="Password">
                <i class="fa fa-eye toggle-pass" onclick="togglePass()"></i>
            </div>
            <div class="input-group"><input type="text" id="token" placeholder="Token"></div>
            <button class="btn btn-blue" onclick="login()">MASUK</button>
        </div>
    `;
};

window.togglePass = () => {
    const p = id('pass');
    p.type = p.type === 'password' ? 'text' : 'password';
};

// --- 2. LOGIKA GOOGLE DRIVE CONVERTER ---
const driveConvert = (url) => {
    if (!url || url === "-" || url.trim() === "") return null;
    
    // Jika link berasal dari Google Drive
    if (url.includes("drive.google.com")) {
        let fileId = "";
        
        try {
            if (url.includes("/file/d/")) {
                // Format: https://drive.google.com/file/d/ID_FILE/view
                fileId = url.split("/file/d/")[1].split("/")[0].split("?")[0];
            } else if (url.includes("id=")) {
                // Format: https://drive.google.com/open?id=ID_FILE
                fileId = url.split("id=")[1].split("&")[0];
            }
            
            if (fileId) {
                // Gunakan thumbnail link (lebih stabil untuk render di aplikasi web)
                return `https://lh3.googleusercontent.com/u/0/d/${fileId}`;
            }
        } catch (e) {
            console.error("Gagal konversi link Drive:", e);
        }
    }
    return url; // Kembalikan URL asli jika bukan drive atau gagal konversi
};

// --- 3. LOGIN & START ---
window.login = async () => {
    const payload = { nisn: id('nisn').value, password: id('pass').value, token: id('token').value };
    const r = await fetch(`${API_URL}/login`, { method: 'POST', body: JSON.stringify(payload) });
    const d = await r.json();
    if(d.success) {
        u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
        id('p-login').classList.remove('active'); id('p-info').classList.add('active');
        id('info-root').innerHTML = `
            <div class="card">
                <h3>Halo, ${u.nama}</h3>
                <p>Mapel: ${ex.mapel}<br>Kelas: ${u.kelas}<br>Guru: ${ex.nama_guru}<br>Durasi: ${ex.durasi} Menit</p>
                <button class="btn btn-blue" onclick="start()">MULAI UJIAN</button>
            </div>
        `;
    } else alert("Data Salah!");
};

window.start = async () => {
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    const r = await fetch(`${API_URL}/get-soal?token=${ex.token}`);
    qs = await r.json(); tIn = new Date(); isLive = true;
    id('p-info').classList.remove('active'); id('p-quiz').classList.add('active');
    runTimer(ex.durasi * 60); render();
};

// --- 4. CORE ENGINE ---
const runTimer = (sec) => {
    tInt = setInterval(() => {
        let m = Math.floor(sec/60), s = sec%60;
        id('timer').innerText = `SISA WAKTU: ${m}:${s<10?'0':''}${s}`;
        if(--sec < 0) { clearInterval(tInt); autoFinish(); }
    }, 1000);
};

const render = () => {
    const s = qs[cur];
    const imgUrl = driveConvert(s.img);
    
    let h = `<div class="card">
        ${s.st ? `<div class="stimulus">${s.st}</div>` : ''}
        ${imgUrl ? `<img src="${imgUrl}" class="soal-img" alt="Gambar Soal">` : ''}
        <p><b>No ${cur+1}:</b> ${s.q}</p>`;
    
    if(s.tp === 'Kategori') {
        const baris = s.q.split(';');
        h += `<table><tr><th>Kasus</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
        baris.forEach((txt, i) => {
            let a = (ans[s.id] || "").split(',');
            if(a.length !== baris.length) a = new Array(baris.length).fill("");
            h += `<tr><td style="text-align:left">${txt}</td>
            <td><input type="radio" name="k_${s.id}_${i}" value="A" ${a[i]=='A'?'checked':''} onchange="saveKat(${s.id},${i},'A',${baris.length})"></td>
            <td><input type="radio" name="k_${s.id}_${i}" value="B" ${a[i]=='B'?'checked':''} onchange="saveKat(${s.id},${i},'B',${baris.length})"></td></tr>`;
        });
        h += `</table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        s.opt.forEach(o => {
            const isC = (ans[s.id] || "").split(',').includes(o.orig) ? 'checked' : '';
            h += `<label class="option-item"><input type="${typ}" name="q_${s.id}" value="${o.orig}" ${isC} onchange="saveAns(${s.id},'${s.tp}')"> ${o.text}</label>`;
        });
    }
    id('display-soal').innerHTML = h + `</div>`;
    
    id('nav-buttons').innerHTML = `
        <button class="btn btn-gray" onclick="move(-1)">KEMBALI</button>
        <button id="btn-next" class="btn btn-blue" onclick="move(1)" style="${cur === qs.length-1 ? 'display:none' : ''}">LANJUT</button>
        <button id="btn-finish" class="btn" style="background:var(--success); color:white; display:none" onclick="preFinish()">KIRIM JAWABAN</button>
    `;
    updateGrid();
};

window.saveAns = (id_soal, tipe) => {
    const vals = Array.from(document.querySelectorAll(`input[name="q_${id_soal}"]:checked`)).map(i => i.value);
    ans[id_soal] = vals.sort().join(',');
    updateGrid();
    if(tipe === 'Sederhana') setTimeout(() => { if(cur < qs.length-1) move(1); }, 600);
};

window.saveKat = (id_soal, idx, val, total) => {
    let a = (ans[id_soal] || "").split(',');
    if(a.length !== total) a = new Array(total).fill("");
    a[idx] = val; ans[id_soal] = a.join(',');
    updateGrid();
    if(a.every(x => x !== "")) setTimeout(() => { if(cur < qs.length-1) move(1); }, 600);
};

const updateGrid = () => {
    const g = id('nav-grid'); g.innerHTML = '';
    let done = 0;
    qs.forEach((s, i) => {
        let cls = 'box', isOk = false;
        if(ans[s.id]) {
            if(s.tp === 'Kategori') isOk = ans[s.id].split(',').filter(x=>x!=="").length === s.q.split(';').length;
            else isOk = ans[s.id] !== "";
        }
        if(isOk) { cls += ' done'; done++; }
        if(i === cur) cls += ' now';
        g.innerHTML += `<div class="${cls}" onclick="cur=${i};render()">${i+1}</div>`;
    });
    if(id('btn-finish')) id('btn-finish').style.display = (done === qs.length) ? 'block' : 'none';
};

window.move = (step) => { cur += step; render(); };

window.preFinish = () => { if(confirm("Kirim jawaban?")) autoFinish(); };

const autoFinish = async () => {
    clearInterval(tInt); isLive = false;
    let b = 0;
    const sorted = [...qs].sort((x, y) => x.id - y.id);
    const logAns = sorted.map(q => {
        const userA = ans[q.id] || "-";
        if(userA.replace(/\s/g,'') === q.key.replace(/\s/g,'')) b++;
        return userA;
    }).join('|');

    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mapel, kelas: u.kelas, jenjang: u.jenjang,
        nilai: (b/qs.length)*100, jml_curang: fraud, jml_benar: b, jml_salah: qs.length - b,
        wkt_masuk: tIn.toLocaleString(), wkt_submit: new Date().toLocaleString(),
        wkt_digunakan: `${Math.floor((new Date()-tIn)/60000)} Menit`, jawaban: logAns
    };

    const res = await fetch(`${API_URL}/submit`, { method: 'POST', body: JSON.stringify(body) });
    if(res.ok) { alert("Selesai!"); location.reload(); }
};

// --- 5. SECURITY ---
document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++;
        document.body.className = fraud >= 10 ? 'warn-r' : (fraud >= 5 ? 'warn-y' : '');
    }
});


initApp();
