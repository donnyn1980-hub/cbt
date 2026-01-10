let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API_URL = 'https://cbt.donnyn1980.workers.dev';

const id = (e) => document.getElementById(e);

// Keamanan: Disable Inspect Element (F12, Ctrl+Shift+I, Ctrl+U)
document.onkeydown = (e) => {
    if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false;
};

const showLoader = (show, text = "Harap Tunggu...") => {
    id('loader').style.display = show ? 'flex' : 'none';
    id('loader-text').innerText = text;
};

const driveConvert = (url) => {
    if (!url || url === "-" || url.trim() === "") return null;
    if (url.includes("drive.google.com")) {
        let fileId = "";
        try {
            if (url.includes("/file/d/")) fileId = url.split("/file/d/")[1].split("/")[0].split("?")[0];
            else if (url.includes("id=")) fileId = url.split("id=")[1].split("&")[0];
            if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
        } catch (e) { console.error("Drive Convert Error"); }
    }
    return url;
};

const saveSession = () => {
    const session = { ans, fraud, cur, tIn, u, ex, qs, isLive };
    localStorage.setItem('cbt_session', JSON.stringify(session));
};

const loadSession = () => {
    const data = localStorage.getItem('cbt_session');
    if (data) {
        const s = JSON.parse(data);
        ans = s.ans; fraud = s.fraud; cur = s.cur; tIn = s.tIn;
        u = s.u; ex = s.ex; qs = s.qs; isLive = s.isLive;
        if (isLive) {
            id('p-login').classList.remove('active');
            id('p-quiz').classList.add('active');
            render();
            const now = new Date().getTime();
            const startT = new Date(tIn).getTime();
            const elapsed = Math.floor((now - startT) / 1000);
            runTimer((ex.durasi * 60) - elapsed);
        } else {
            initApp();
            id('p-login').classList.add('active');
        }
    } else {
        initApp();
        id('p-login').classList.add('active');
    }
};

const initApp = () => {
    id('login-root').innerHTML = `
        <div class="card" style="max-width:400px; margin: 40px auto;">
            <h2 style="text-align:center; color: var(--primary)">CBT LOGIN</h2>
            <div class="input-group"><input type="text" id="nisn" placeholder="NISN"></div>
            <div class="input-group">
                <input type="password" id="pass" placeholder="Password">
                <i class="fa fa-eye toggle-pass" onclick="togglePass()"></i>
            </div>
            <div class="input-group"><input type="text" id="token" placeholder="Token Ujian"></div>
            <button class="btn btn-blue" onclick="login()">MASUK</button>
        </div>
    `;
};

window.togglePass = () => {
    const p = id('pass');
    p.type = p.type === 'password' ? 'text' : 'password';
};

window.login = async () => {
    const nisnVal = id('nisn').value;
    const passVal = id('pass').value;
    const tokVal = id('token').value;

    if(!nisnVal || !passVal || !tokVal) return alert("Lengkapi data login!");

    showLoader(true, "Memverifikasi...");
    try {
        const r = await fetch(`${API_URL}/login`, { 
            method: 'POST', 
            body: JSON.stringify({ nisn: nisnVal, password: passVal, token: tokVal }) 
        });
        const d = await r.json();
        if(d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
            id('p-login').classList.remove('active'); id('p-info').classList.add('active');
            id('info-root').innerHTML = `
                <div class="card">
                    <h3>Halo, ${u.nama}</h3>
                    <p>Mapel: ${ex.mapel} | Durasi: ${ex.durasi} Menit</p>
                    <button class="btn btn-blue" onclick="start()">MULAI UJIAN</button>
                </div>
            `;
        } else {
            alert("Akses Ditolak! NISN, Password, atau Token salah.");
        }
    } catch(e) { alert("Kesalahan koneksi server!"); }
    showLoader(false);
};

window.start = async () => {
    showLoader(true, "Memuat Soal...");
    try {
        const r = await fetch(`${API_URL}/get-soal?token=${ex.token}`);
        qs = await r.json(); tIn = new Date(); isLive = true;
        id('p-info').classList.remove('active'); id('p-quiz').classList.add('active');
        saveSession();
        runTimer(ex.durasi * 60); render();
    } catch(e) { alert("Gagal memuat soal!"); }
    showLoader(false);
};

const runTimer = (sec) => {
    if(tInt) clearInterval(tInt);
    tInt = setInterval(() => {
        if (sec <= 0) { clearInterval(tInt); autoFinish(); return; }
        let m = Math.floor(sec/60), s = sec%60;
        id('timer').innerText = `SISA WAKTU: ${m}:${s<10?'0':''}${s}`;
        sec--;
    }, 1000);
};

const render = () => {
    const s = qs[cur];
    const imgUrl = driveConvert(s.img);
    let h = `<div class="card">
        ${s.st ? `<div class="stimulus">${s.st}</div>` : ''}
        ${imgUrl ? `<img src="${imgUrl}" class="soal-img" onerror="this.src='https://placehold.co/400x200?text=Gambar+Drive+Dibatasi'">` : ''}
        <p><b>Soal ${cur+1}:</b> ${s.q}</p>`;

    if(s.tp === 'Kategori') {
        const baris = s.q.split(';');
        h += `<table><tr><th>Kategori</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
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
        const curV = ans[s.id] || "";
        s.opt.forEach(o => {
            const isC = curV.split(',').includes(o.orig) ? 'checked' : '';
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
    saveSession(); updateGrid();
    if(tipe === 'Sederhana' && vals.length > 0) setTimeout(() => move(1), 600);
};

window.saveKat = (id_soal, idx, val, total) => {
    let a = (ans[id_soal] || "").split(',');
    if(a.length !== total) a = new Array(total).fill("");
    a[idx] = val; ans[id_soal] = a.join(',');
    saveSession(); updateGrid();
    if(a.every(x => x !== "")) setTimeout(() => move(1), 600);
};

const updateGrid = () => {
    const g = id('nav-grid'); g.innerHTML = '';
    let done = 0;
    qs.forEach((s, i) => {
        let cls = 'box', ok = false;
        if(ans[s.id]) {
            if(s.tp === 'Kategori') ok = ans[s.id].split(',').filter(x=>x).length === s.q.split(';').length;
            else ok = ans[s.id] !== "";
        }
        if(ok) { cls += ' done'; done++; }
        if(i === cur) cls += ' now';
        g.innerHTML += `<div class="${cls}" onclick="cur=${i};render();saveSession()">${i+1}</div>`;
    });
    if(id('btn-finish')) id('btn-finish').style.display = (done === qs.length) ? 'block' : 'none';
};

window.move = (step) => { 
    let n = cur + step; 
    if(n >= 0 && n < qs.length) { cur = n; render(); saveSession(); }
};

window.preFinish = () => { if(confirm("Yakin ingin mengirim jawaban sekarang?")) autoFinish(); };

const autoFinish = async () => {
    showLoader(true, "Mengirim Nilai...");
    let b = 0;
    const sorted = [...qs].sort((x, y) => x.id - y.id);
    const logAns = sorted.map(q => {
        const ua = ans[q.id] || "-";
        if(ua.replace(/\s/g,'') === q.key.replace(/\s/g,'')) b++;
        return ua;
    }).join('|');

    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mapel, kelas: u.kelas, jenjang: ex.jenjang,
        nilai: (b/qs.length)*100, jml_curang: fraud, jml_benar: b, jml_salah: qs.length - b,
        wkt_masuk: new Date(tIn).toLocaleString(), wkt_submit: new Date().toLocaleString(),
        wkt_digunakan: `${Math.floor((new Date()-new Date(tIn))/60000)} Menit`, jawaban: logAns
    };

    try {
        const res = await fetch(`${API_URL}/submit`, { method: 'POST', body: JSON.stringify(body) });
        if(res.ok) { localStorage.clear(); location.reload(); }
        else { alert("Gagal menyimpan nilai!"); }
    } catch(e) { alert("Error saat kirim!"); }
    showLoader(false);
};

document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++; saveSession();
        document.body.style.background = fraud >= 5 ? '#f8d7da' : '#f4f7f9';
    }
});

loadSession();
