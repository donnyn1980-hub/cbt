let u = {}, ex = {}, qs = [], ans = {}, cur = 0, fraud = 0, tIn, tInt, isLive = false;
const API_URL = 'https://cbt.donnyn1980.workers.dev';

const id = (e) => document.getElementById(e);

const driveConvert = (url) => {
    if (!url || url === "-" || url.trim() === "") return null;
    let fileId = "";
    if (url.includes("/file/d/")) fileId = url.split("/file/d/")[1].split("/")[0];
    else if (url.includes("id=")) fileId = url.split("id=")[1].split("&")[0];
    return fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : url;
};

const saveSession = () => {
    localStorage.setItem('cbt_session', JSON.stringify({ ans, fraud, cur, tIn, u, ex, qs, isLive }));
};

const loadSession = () => {
    const data = localStorage.getItem('cbt_session');
    if (data) {
        Object.assign(window, JSON.parse(data));
        if (isLive) {
            id('p-login').classList.remove('active'); id('p-quiz').classList.add('active');
            render(); runTimer((ex.durasi * 60) - Math.floor((new Date().getTime() - new Date(tIn).getTime()) / 1000));
        } else { initApp(); id('p-login').classList.add('active'); }
    } else { initApp(); id('p-login').classList.add('active'); }
};

const initApp = () => {
    id('login-root').innerHTML = `
        <div class="card" style="max-width:400px; margin: auto;">
            <h2 style="text-align:center; color: var(--primary)">CBT LOGIN</h2>
            <input type="text" id="nisn" placeholder="NISN" style="margin-bottom:10px">
            <input type="password" id="pass" placeholder="Password" style="margin-bottom:10px">
            <input type="text" id="token" placeholder="Token Ujian" style="margin-bottom:10px">
            <button class="btn btn-blue" onclick="login()">MASUK</button>
        </div>`;
};

window.login = async () => {
    const n = id('nisn').value, p = id('pass').value, t = id('token').value;
    const r = await fetch(`${API_URL}/login`, { method: 'POST', body: JSON.stringify({ nisn: n, password: p, token: t }) });
    const d = await r.json();
    if(d.success) {
        u = d.siswa; ex = d.infoUjian; ex.total = d.totalSoal;
        id('p-login').classList.remove('active'); id('p-info').classList.add('active');
        id('info-root').innerHTML = `
            <div class="card">
                <h2>Selamat Datang, ${u.nama} (${u.kelas})</h2>
                <p>Anda akan mengerjakan Ujian dengan rincian sebagai berikut :</p>
                <div style="background:#e7f1ff; padding:15px; border-radius:8px; line-height: 1.1; margin-bottom:15px">
                    <p><b>Mata Pelajaran:</b> ${ex.mapel}</p>
                    <p><b>Guru Pengampu:</b> ${ex.nama_guru}</p>
                    <p><b>Durasi:</b> ${ex.durasi} Menit</p>
                    <p><b>Jumlah Soal:</b> ${ex.total}</p>
                </div>
                <button class="btn btn-blue" onclick="start()">SAYA MENGERTI & MULAI</button>
            </div>`;
    } else alert("Akses Ditolak!");
};

window.start = async () => {
    const r = await fetch(`${API_URL}/get-soal?token=${ex.token}`);
    qs = await r.json(); tIn = new Date(); isLive = true;
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
    let h = `<div class="card">
        ${s.st ? `<div class="stimulus">${s.st}</div>` : ''}
        ${imgUrl ? `<img src="${imgUrl}" class="soal-img">` : ''}
        <p><b>Soal ${cur+1}:</b> ${s.q}</p>`;

    if(s.tp === 'Kategori') {
        const baris = s.q.split(';');
        h += `<table><tr><th>Item</th><th>${s.kat[0]}</th><th>${s.kat[1]}</th></tr>`;
        baris.forEach((txt, i) => {
            let a = (ans[s.id] || "").split(',');
            if(a.length !== baris.length) a = new Array(baris.length).fill("");
            h += `<tr><td style="text-align:left">${txt}</td>
            <td onclick="saveKat(${s.id},${i},'A',${baris.length})" style="cursor:pointer">
                <span class="ceklis">${a[i]=='A'?'✓':''}</span>
            </td>
            <td onclick="saveKat(${s.id},${i},'B',${baris.length})" style="cursor:pointer">
                <span class="ceklis">${a[i]=='B'?'✓':''}</span>
            </td></tr>`;
        });
        h += `</table>`;
    } else {
        const typ = s.tp === 'MCMA' ? 'checkbox' : 'radio';
        const curA = (ans[s.id] || "").split(',');
        h += `<div class="option-wrapper">`;
        s.opt.forEach(o => {
            const sel = curA.includes(o.orig);
            h += `<div class="opt-btn ${sel?'selected':''}" onclick="selectOpt(this, '${typ}', ${s.id}, '${s.tp}')">
                <input type="${typ}" name="q_${s.id}" value="${o.orig}" ${sel?'checked':''}> ${o.text}
            </div>`;
        });
        h += `</div>`;
    }
    id('display-soal').innerHTML = h + `</div>`;
    updateGrid();
};

window.selectOpt = (el, typ, idS, tpS) => {
    const inp = el.querySelector('input');
    if(typ === 'radio') {
        document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected'); inp.checked = true;
    } else {
        inp.checked = !inp.checked; el.classList.toggle('selected');
    }
    const v = Array.from(document.querySelectorAll(`input[name="q_${idS}"]:checked`)).map(i => i.value);
    ans[idS] = v.sort().join(','); saveSession(); updateGrid();
    if(tpS === 'Sederhana') setTimeout(() => move(1), 500);
};

window.saveKat = (idS, idx, val, tot) => {
    let a = (ans[idS] || "").split(',');
    if(a.length !== tot) a = new Array(tot).fill("");
    a[idx] = val; ans[idS] = a.join(',');
    saveSession(); render();
};

const updateGrid = () => {
    id('nav-grid').innerHTML = qs.map((s, i) => {
        const ok = ans[s.id] && ans[s.id].split(',').filter(x=>x).length > 0;
        return `<div class="box ${ok?'done':''} ${i===cur?'now':''}" onclick="cur=${i};render()">${i+1}</div>`;
    }).join('');
    id('nav-buttons').innerHTML = `<button class="btn" onclick="move(-1)">KEMBALI</button>
    <button class="btn btn-blue" onclick="${cur===qs.length-1?'preFinish()':'move(1)'}">${cur===qs.length-1?'KIRIM':'LANJUT'}</button>`;
};

window.move = (step) => { let n = cur + step; if(n >= 0 && n < qs.length) { cur = n; render(); } };
window.preFinish = () => { if(confirm("Kirim jawaban?")) autoFinish(); };

const autoFinish = async () => {
    clearInterval(tInt); isLive = false;
    let totalPoinKunci = 0, totalPoinBenar = 0;

    qs.forEach(q => {
        const kunci = q.key.split(',').filter(x=>x);
        const user = (ans[q.id] || "").split(',').filter(x=>x);
        totalPoinKunci += kunci.length;
        kunci.forEach(k => { if(user.includes(k)) totalPoinBenar++; });
    });

    const body = {
        nisn: u.nisn, nama: u.nama, nama_guru: ex.nama_guru, mapel: ex.mapel, kelas: u.kelas,
        jenjang: ex.jenjang || "X", nilai: ((totalPoinBenar/totalPoinKunci)*100).toFixed(2),
        jml_curang: fraud, jml_benar: totalPoinBenar, jml_salah: totalPoinKunci - totalPoinBenar,
        wkt_masuk: new Date(tIn).toLocaleString('id-ID'), wkt_submit: new Date().toLocaleString('id-ID'),
        wkt_digunakan: `${Math.floor((new Date()-new Date(tIn))/60000)} Menit`, 
        jawaban: qs.map(q => ans[q.id] || "-").join('|')
    };

    const res = await fetch(`${API_URL}/submit`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    if((await res.json()).success) { localStorage.clear(); location.reload(); }
};

document.addEventListener("visibilitychange", () => {
    if (isLive && document.hidden) {
        fraud++; saveSession();
        document.body.className = fraud >= 10 ? 'warn-r' : (fraud >= 5 ? 'warn-y' : '');
    }
});

loadSession();
