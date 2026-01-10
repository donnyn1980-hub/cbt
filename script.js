let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API_URL = 'https://cbt.donnyn1980.workers.dev';
const id = (e) => document.getElementById(e);

const driveConvert = (url) => {
    if (!url || url === "-" || url.trim() === "") return null;
    let fId = "";
    if (url.includes("/file/d/")) fId = url.split("/file/d/")[1].split("/")[0];
    else if (url.includes("id=")) fId = url.split("id=")[1].split("&")[0];
    return fId ? `https://lh3.googleusercontent.com/d/${fId}` : url;
};

const saveSession = () => localStorage.setItem('cbt_sniper_v2_final', JSON.stringify({ u, ex, qs, ans, cur, fraud, tIn, isLive }));

const loadSession = () => {
    const stored = localStorage.getItem('cbt_sniper_v2_final');
    if (stored) {
        const s = JSON.parse(stored); Object.assign(window, s);
        if (isLive) {
            id('p-login').classList.remove('active'); id('p-quiz').classList.add('active');
            render(); runTimer((ex.durasi * 60) - Math.floor((new Date() - new Date(tIn)) / 1000));
        } else if (u && u.nama) { showWelcome(); } else { initApp(); }
    } else { initApp(); }
};

const initApp = () => {
    id('p-login').classList.add('active');
    id('login-root').innerHTML = `<div class="card" style="max-width:400px; margin: auto;">
        <h2 style="text-align:center; color: var(--primary)">CBT LOGIN</h2>
        <input type="text" id="nisn" placeholder="NISN" style="margin-bottom:15px">
        <input type="password" id="pass" placeholder="Password" style="margin-bottom:15px">
        <input type="text" id="token" placeholder="Token Ujian" style="margin-bottom:15px">
        <button class="btn btn-blue" onclick="login()">MASUK</button></div>`;
};

window.login = async () => {
    const n = id('nisn').value, p = id('pass').value, t = id('token').value;
    const r = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nisn: n, password: p, token: t }) });
    const d = await r.json();
    if(d.success) { u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal; saveSession(); showWelcome(); } 
    else alert("Login Gagal! Pastikan NISN/Pass benar dan Ujian berstatus aktif (1).");
};

const showWelcome = () => {
    id('p-login').classList.remove('active'); id('p-info').classList.add('active');
    id('info-root').innerHTML = `<div class="card">
        <h2 style="color:var(--primary)">Selamat Datang, ${u.nama}</h2>
        <div style="background:#e7f1ff; padding:20px; border-radius:12px; margin-bottom:20px">
            <p><b>Mata Pelajaran:</b> ${ex.mata_pelajaran}</p><p><b>Guru:</b> ${ex.nama_guru}</p>
            <p><b>Durasi:</b> ${ex.durasi} Menit</p><p><b>Jumlah Soal:</b> ${ex.total}</p>
        </div>
        <button class="btn btn-blue" onclick="start()">MULAI UJIAN</button></div>`;
};

window.start = async () => {
    const r = await fetch(`${API_URL}/get-soal?token=${ex.token}`);
    qs = await r.json(); tIn = new Date().toISOString(); isLive = true;
    id('p-info').classList.remove('active'); id('p-quiz').classList.add('active');
    saveSession(); runTimer(ex.durasi * 60); render();
};

const runTimer = (sec) => {
    tInt = setInterval(() => {
        if (sec <= 0) { clearInterval(tInt); autoFinish(); }
        id('timer').innerText = `SISA WAKTU: ${Math.floor(sec/60)}:${sec%60<10?'0':''}${sec%60}`;
        sec--;
    }, 1000);
};

const render = () => {
    const s = qs[cur], imgUrl = driveConvert(s.img);
    let h = `<div class="card">${s.st ? `<div class="stimulus">${s.st}</div>` : ''}
        ${imgUrl ? `<img src="${imgUrl}" class="soal-img">` : ''}
        <p style="font-size:18px"><b>Soal ${cur+1}:</b> ${s.q}</p>`;

    if(s.tp === 'Kategori') {
        h += `<table><tr><th>Item</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
        s.q.split(';').forEach((txt, i) => {
            let a = (ans[s.id] || "").split(','); if(a.length !== s.q.split(';').length) a = new Array(s.q.split(';').length).fill("");
            h += `<tr><td style="text-align:left">${txt}</td>
            <td onclick="saveKat(${s.id},${i},'A',${s.q.split(';').length})"><span class="ceklis">${a[i]=='A'?'✓':''}</span></td>
            <td onclick="saveKat(${s.id},${i},'B',${s.q.split(';').length})"><span class="ceklis">${a[i]=='B'?'✓':''}</span></td></tr>`;
        });
        h += `</table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        const curA = (ans[s.id] || "").split(',');
        h += `<div class="option-wrapper">`;
        s.opt.forEach(o => {
            const sel = curA.includes(o.orig);
            h += `<div class="opt-btn ${sel?'selected':''}" onclick="selectOpt(this, '${typ}', ${s.id}, '${s.tp}')">
                <input type="${typ}" name="q_${s.id}" value="${o.orig}" ${sel?'checked':''}> <span><b>${o.orig}.</b> ${o.text}</span></div>`;
        });
        h += `</div>`;
    }
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
};

window.selectOpt = (el, typ, idS, tpS) => {
    const inp = el.querySelector('input');
    if(typ === 'radio') { document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected')); el.classList.add('selected'); inp.checked = true; }
    else { inp.checked = !inp.checked; el.classList.toggle('selected'); }
    const v = Array.from(document.querySelectorAll(`input[name="q_${idS}"]:checked`)).map(i => i.value);
    ans[idS] = v.sort().join(','); saveSession(); updateGrid();
    if((tpS === 'Sederhana' || tpS === 'Sederhana Berkelompok') && v.length > 0) setTimeout(() => move(1), 600);
};

window.saveKat = (idS, idx, val, tot) => {
    let a = (ans[idS] || "").split(','); if(a.length !== tot) a = new Array(tot).fill("");
    a[idx] = val; ans[idS] = a.join(','); saveSession(); render();
    if(a.every(x => x !== "")) setTimeout(() => move(1), 600);
};

const updateGrid = () => {
    id('nav-grid').innerHTML = qs.map((s, i) => `<div class="box ${(ans[s.id] || "").length > 0?'done':''} ${i===cur?'now':''}" onclick="cur=${i};render();saveSession()">${i+1}</div>`).join('');
    id('nav-buttons').innerHTML = `<div style="display:flex; gap:10px"><button class="btn btn-gray" onclick="move(-1)">KEMBALI</button>
        ${cur === qs.length - 1 ? `<button class="btn btn-success" onclick="preFinish()">KIRIM</button>` : `<button class="btn btn-blue" onclick="move(1)">LANJUT</button>`}</div>`;
};

window.move = (step) => { let n = cur + step; if(n >= 0 && n < qs.length) { cur = n; render(); saveSession(); } };
window.preFinish = () => { if(confirm("Kirim jawaban?")) autoFinish(); };

const autoFinish = async () => {
    clearInterval(tInt); isLive = false;
    const body = { siswa: u, infoUjian: ex, jawabanSiswa: ans, fraud, wkt_masuk: tIn, wkt_submit: new Date().toLocaleString('id-ID'), wkt_digunakan: `${Math.floor((new Date() - new Date(tIn)) / 60000)} Menit` };
    const res = await fetch(`${API_URL}/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if((await res.json()).success) { localStorage.removeItem('cbt_sniper_v2_final'); location.reload(); }
};

document.addEventListener("visibilitychange", () => { if (isLive && document.hidden) { fraud++; saveSession(); document.body.className = fraud >= 10 ? 'warn-r' : (fraud >= 5 ? 'warn-y' : ''); } });
loadSession();
