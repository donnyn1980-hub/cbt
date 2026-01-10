/**
 * CORE CLIENT SCRIPT - CBT SNIPER PRO
 */

// Global App State
let STATE = {
    user: {},
    exam: {},
    questions: [],
    answers: {},
    currentIndex: 0,
    fraudCount: 0,
    startTime: null,
    timerId: null,
    isExamLive: false
};

const BASE_URL = 'https://cbt.donnyn1980.workers.dev';

// Utils
const $ = (id) => document.getElementById(id);
const toggleLoader = (show, text) => {
    $('loader').style.display = show ? 'flex' : 'none';
    if(text) $('loader-text').innerText = text;
};

// TAHAP 1: LOGIN
async function handleLogin() {
    const nisn = $('nisn').value.trim();
    const pass = $('pass').value;
    const token = $('token').value.trim();

    if(!nisn || !pass || !token) return alert("Harap isi semua field login.");

    toggleLoader(true, "Memvalidasi Kredensial...");

    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nisn, password: pass, token })
        });
        const data = await response.json();
        toggleLoader(false);

        if(data.success) {
            STATE.user = data.siswa;
            STATE.exam = data.infoUjian;
            STATE.exam.totalSoal = data.totalSoal;
            renderConfirmationPage();
        } else {
            alert(data.msg);
        }
    } catch (err) {
        toggleLoader(false);
        alert("Gagal terhubung ke Worker. Pastikan Worker aktif.");
    }
}

function renderConfirmationPage() {
    $('p-login').classList.remove('active');
    $('p-info').classList.add('active');

    $('info-render-area').innerHTML = `
        <h2 style="color:var(--brand); border-bottom: 2px solid #eee; padding-bottom: 0.5rem;">Konfirmasi Ujian</h2>
        <div style="font-size: 1.1rem; line-height: 1.8; margin-top: 1.5rem;">
            Halo, <strong>${STATE.user.nama}</strong> (${STATE.user.kelas}), <br>
            Anda akan mengerjakan Ujian dengan rincian sebagai berikut:
            <ul style="list-style: none; padding: 0; margin-top: 1rem;">
                <li><i class="fas fa-book"></i> Mata Pelajaran: <strong>${STATE.exam.mata_pelajaran}</strong></li>
                <li><i class="fas fa-user-tie"></i> Guru Pengampu: <strong>${STATE.exam.nama_guru}</strong></li>
                <li><i class="fas fa-list-ol"></i> Jumlah Soal: <strong>${STATE.exam.totalSoal} Butir</strong></li>
                <li><i class="fas fa-clock"></i> Alokasi Waktu: <strong>${STATE.exam.durasi} Menit</strong></li>
            </ul>
        </div>
    `;
}

// TAHAP 2: FETCH SOAL & START
async function fetchSoalAndStart() {
    toggleLoader(true, "Sinkronisasi Paket Soal...");
    try {
        const response = await fetch(`${BASE_URL}/get-soal?token=${STATE.exam.token}`);
        STATE.questions = await response.json();
        toggleLoader(false);

        if(STATE.questions.length === 0) return alert("Soal tidak ditemukan untuk token ini.");
        
        initiateQuizMode();
    } catch (err) {
        toggleLoader(false);
        alert("Gagal sinkronisasi soal.");
    }
}

function initiateQuizMode() {
    STATE.startTime = new Date().toISOString();
    STATE.isExamLive = true;
    
    $('p-info').classList.remove('active');
    $('p-quiz').classList.add('active');

    $('user-display-name').innerText = STATE.user.nama;
    $('user-display-kelas').innerText = STATE.user.kelas;

    startCountdown(parseInt(STATE.exam.durasi) * 60);
    renderQuestion();
}

function startCountdown(seconds) {
    let timeLeft = seconds;
    STATE.timerId = setInterval(() => {
        if(timeLeft <= 0) {
            clearInterval(STATE.timerId);
            autoSubmit();
            return;
        }
        timeLeft--;
        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;
        $('timer').innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
}

// RENDER LOGIC
function renderQuestion() {
    const q = STATE.questions[STATE.currentIndex];
    let html = `<div class="question-container">`;

    if(q.stimulus && q.stimulus.trim() !== "") {
        html += `<div class="stimulus-box">${q.stimulus}</div>`;
    }

    if(q.img_link && q.img_link !== "-" && q.img_link.trim() !== "") {
        html += `<img src="${q.img_link}" style="max-width:100%; border-radius:10px; margin-bottom:1.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
    }

    html += `<h2 style="margin-bottom: 2rem;">${STATE.currentIndex + 1}. ${q.butir_soal}</h2>`;

    ['a','b','c','d','e'].forEach(char => {
        const textOpsi = q[`opsi_${char}`];
        if(textOpsi && textOpsi !== "-" && textOpsi.trim() !== "") {
            const activeClass = STATE.answers[q.rowid] === char ? 'selected' : '';
            html += `
                <div class="option-btn ${activeClass}" onclick="handleSelectAnswer('${q.rowid}', '${char}')">
                    <div class="opt-char">${char.toUpperCase()}</div>
                    <div class="opt-text">${textOpsi}</div>
                </div>
            `;
        }
    });

    html += `</div>`;
    $('display-soal').innerHTML = html;
    updateSidebarNav();
}

function handleSelectAnswer(rowid, char) {
    STATE.answers[rowid] = char;
    renderQuestion();
}

function updateSidebarNav() {
    let gridHtml = '';
    STATE.questions.forEach((q, idx) => {
        const statusClass = STATE.answers[q.rowid] ? 'done' : '';
        const currentClass = STATE.currentIndex === idx ? 'active-soal' : '';
        gridHtml += `<div class="box-num ${statusClass} ${currentClass}" onclick="jumpTo(${idx})">${idx + 1}</div>`;
    });
    $('nav-grid').innerHTML = gridHtml;

    $('btn-prev').disabled = STATE.currentIndex === 0;
    
    const isLast = STATE.currentIndex === STATE.questions.length - 1;
    const nextBtn = $('btn-next');
    if(isLast) {
        nextBtn.innerText = "FINISH & SUBMIT";
        nextBtn.classList.replace('btn-primary', 'btn-success');
        nextBtn.onclick = confirmFinish;
    } else {
        nextBtn.innerText = "SOAL SELANJUTNYA";
        nextBtn.classList.replace('btn-success', 'btn-primary');
        nextBtn.onclick = goNext;
    }
}

function jumpTo(idx) { STATE.currentIndex = idx; renderQuestion(); }
function goNext() { if(STATE.currentIndex < STATE.questions.length -1) { STATE.currentIndex++; renderQuestion(); } }
function goPrev() { if(STATE.currentIndex > 0) { STATE.currentIndex--; renderQuestion(); } }

// TAHAP 3: SUBMIT
function confirmFinish() {
    if(confirm("Apakah Anda yakin ingin mengakhiri ujian? Jawaban tidak dapat diubah setelah ini.")) {
        autoSubmit();
    }
}

async function autoSubmit() {
    STATE.isExamLive = false;
    clearInterval(STATE.timerId);
    toggleLoader(true, "Mengirim Hasil ke Server...");

    const finishTime = new Date().toLocaleString('id-ID');
    const usedTime = `${Math.floor((new Date() - new Date(STATE.startTime)) / 60000)} Menit`;

    const dataPackage = {
        siswa: STATE.user,
        infoUjian: STATE.exam,
        jawabanSiswa: STATE.answers,
        fraud: STATE.fraudCount,
        wkt_masuk: STATE.startTime,
        wkt_submit: finishTime,
        wkt_digunakan: usedTime
    };

    try {
        const response = await fetch(`${BASE_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataPackage)
        });
        const result = await response.json();
        toggleLoader(false);

        if(result.success) {
            renderFinalPage();
        } else {
            alert("Kesalahan Server: " + result.error);
        }
    } catch (err) {
        toggleLoader(false);
        alert("Gagal mengirim jawaban. Coba klik kirim ulang.");
    }
}

function renderFinalPage() {
    $('p-quiz').innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:80vh; text-align:center;">
            <div class="card" style="padding: 4rem; max-width: 600px; border-radius: 20px;">
                <i class="fas fa-check-circle" style="font-size: 6rem; color: var(--success); margin-bottom: 2rem;"></i>
                <h1 style="color: var(--brand);">Proses Ujian Selesai</h1>
                <p style="font-size: 1.2rem; color: #555;">Terima kasih telah mengikuti ujian dengan jujur.</p>
                <p style="font-size: 1.4rem; font-weight: bold; margin-top: 2rem;">Semoga mendapatkan hasil yang terbaik!</p>
                <button class="btn-main" style="margin-top: 3rem; width: 250px;" onclick="location.reload()">KEMBALI KE BERANDA</button>
            </div>
        </div>
    `;
}

// SECURITY LOGIC (FRAUD DETECTION)
document.addEventListener("visibilitychange", () => {
    if (STATE.isExamLive && document.hidden) {
        STATE.fraudCount++;
        if (STATE.fraudCount >= 10) {
            document.body.className = 'warn-r';
        } else if (STATE.fraudCount >= 5) {
            document.body.className = 'warn-y';
        }
    }
});
