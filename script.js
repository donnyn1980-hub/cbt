let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API_URL = 'https://cbt.donnyn1980.workers.dev';

const id = (e) => document.getElementById(e);

const showLoader = (show, text = "Harap Tunggu...") => {
    id('loader').style.display = show ? 'flex' : 'none';
    id('loader-text').innerText = text;
};

const driveConvert = (url) => {
    if (!url || url === "-" || url.trim() === "") return null;
    if (url.includes("drive.google.com")) {
        let fileId = "";
        try {
            if (url.includes("/file/d/")) {
                fileId = url.split("/file/d/")[1].split("/")[0].split("?")[0];
            } else if (url.includes("id=")) {
                fileId = url.split("id=")[1].split("&")[0];
            }
            if (fileId) {
                // HTTPS + Format googleusercontent (Stabil di Mobile)
                return `https://googleusercontent.com/profile/picture/0{fileId}=w800-iv1`;
            }
        } catch (e) { console.error("Converter Drive Error"); }
    }
    return url;
};

const initApp = () => {
    id('login-root').innerHTML = `
        <div class="card" style="max-width:400px; margin: 50px auto;">
            <h2 style="text-align:center; color: var(--primary)">LOGIN UJIAN</h2>
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

window.login = async () => {
    const nisn = id('nisn').value, pass = id('pass').value, tok = id('token').value;
    if(!nisn || !pass || !tok) return alert("Harap isi semua kolom!");

    showLoader(true, "Memverifikasi Password...");
    try {
        const r = await fetch(`${API_URL}/login`, { method: 'POST', body: JSON.stringify({ nisn, password: pass, token: tok }) });
        const d = await r.json();
        if(d.success) {
            u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
            id('p-login').classList.remove('active'); id('p-info').classList.add('active');
            id('info-root').innerHTML = `
                <div class="card">
                    <h3>Halo, ${u.nama}</h3>
                    <p style="line-height:1.8">Mata Pelajaran: <b>${ex.mapel}</b><br>Kelas: ${u.kelas}<br>Guru: ${ex.nama_guru}<br>Jumlah: ${ex.total} Soal<br>Durasi: ${ex.durasi} Menit</p>
                    <button class="btn btn-blue" onclick="start()">MULAI UJIAN</button>
                </div>
            `;
        } else alert("NISN, Password, atau Token salah!");
    } catch(e) { alert("Server error!"); }
    finally { showLoader(false); }
};

window.start = async () => {
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    showLoader(true, "Mengambil Soal...");
    const r = await fetch(`${API_URL}/get-soal?token=${ex.token}`);
    qs = await r.json(); tIn = new Date(); isLive = true;
    id('p-info').classList.remove('active'); id('p-quiz').classList.add('active');
    showLoader(false);
    runTimer(ex.durasi * 60); render();
};

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
        ${imgUrl ? `<img src="${imgUrl}" class="soal-img" alt="Gambar Soal" loading="lazy">` : ''}
        <p style="font-size:17px"><b>Soal ${cur+1}:</b> ${s.q}</p>`;
    
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
    updateGrid();
    if(tipe === 'Sederhana' && vals.length > 0) setTimeout(() => { if(cur < qs.length-1) move(1); }, 600);
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

window.move = (step) => { 
    const next = cur + step;
    if(next >= 0 && next < qs.length) { cur = next; render(); }
};

window.preFinish = () => { if(confirm("Kirim jawaban sekarang?")) autoFinish(); };

const autoFinish = async () => {
    clearInterval(tInt); isLive = false;
    showLoader(true, "Mengirim Jawaban...");
    let b = 0;
    const sorted = [...qs].sort((x, y) => x.id - y.id);
    const logAns = sorted.map(q => {
        const userA = ans[q.id] || "-";
        if(userA.replace(/\s/g,'') === q.key.replace(/\s/g,'')) b++;
        return userA;
    }).join('|');

    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mapel, kelas: u.kelas, jenjang: ex.jenjang,
        nilai: (b/qs.length)*100, jml_curang: fraud, jml_benar: b, jml_salah: qs.length - b,
        wkt_masuk: tIn.toLocaleString(), wkt_submit: new Date().toLocaleString(),
        wkt_digunakan: `${Math.floor((new Date()-tIn)/60000)} Menit`, jawaban: logAns
    };

    try {
        const res = await fetch(`${API_URL}/submit`, { method: 'POST', body: JSON.stringify(body) });
        if(res.ok) { alert("Jawaban berhasil dikirim!"); location.reload(); }
    } catch(e) { alert("Gagal mengirim jawaban!"); }
    finally { showLoader(false); }
};

document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++;
        document.body.className = fraud >= 10 ? 'warn-r' : (fraud >= 5 ? 'warn-y' : '');
    }
});

initApp();
