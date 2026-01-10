class CBTSystem {
    constructor() {
        // State management - SESUAI DATABASE ANDA
        this.currentPanel = 'p-login';
        this.userData = null;        // {nisn, nama, kelas, jenjang}
        this.examData = null;        // {token, mata_pelajaran, nama_guru, durasi}
        this.questions = [];         // Array dari bank_soal
        this.currentQuestionIndex = 0;
        this.userAnswers = {};       // {rowid: jawaban}
        this.markedQuestions = new Set();
        this.cheatCount = 0;
        this.examStarted = false;
        this.examFinished = false;
        this.autoSaveInterval = null;
        this.countdownInterval = null;
        this.timerInterval = null;
        this.timeLeft = 0;
        this.isFullscreen = false;
        this.correctAnswers = {};    // Simpan kunci jawaban untuk koreksi
        
        // DOM Elements
        this.elements = {};
        
        // Initialize
        this.init();
    }
    
    async init() {
        this.cacheElements();
        this.bindEvents();
        this.setupCheatDetection();
        this.generateCaptcha();
        await this.simulateLoading();
        this.showToast('Sistem CBT siap digunakan', 'success');
    }
    
    cacheElements() {
        // Panels
        this.elements.panels = {
            login: document.getElementById('p-login'),
            info: document.getElementById('p-info'),
            quiz: document.getElementById('p-quiz')
        };
        
        // Loader
        this.elements.loader = document.getElementById('loader');
        this.elements.loaderText = document.getElementById('loader-text');
        this.elements.progressBar = document.querySelector('.progress');
        
        // Login elements - NISN BUKAN NISH
        this.elements.login = {
            nisn: document.getElementById('nisn'),
            password: document.getElementById('password'),
            token: document.getElementById('token'),
            togglePassword: document.getElementById('toggle-password'),
            captchaDisplay: document.getElementById('captcha-display'),
            captchaRefresh: document.getElementById('captcha-refresh'),
            captchaInput: document.getElementById('captcha-input'),
            btnLogin: document.getElementById('btn-login'),
            loginError: document.getElementById('login-error')
        };
        
        // Info elements
        this.elements.info = {
            countdownTimer: document.getElementById('countdown-timer'),
            studentName: document.getElementById('student-name'),
            studentClass: document.getElementById('student-class'),
            examSubject: document.getElementById('exam-subject'),
            examTeacher: document.getElementById('exam-teacher'),
            examTotal: document.getElementById('exam-total'),
            examDuration: document.getElementById('exam-duration'),
            btnStartExam: document.getElementById('btn-start-exam'),
            btnBackLogin: document.getElementById('btn-back-login')
        };
        
        // Quiz elements
        this.elements.quiz = {
            timer: document.getElementById('timer'),
            currentSubject: document.getElementById('current-subject'),
            cheatCount: document.getElementById('cheat-count'),
            cheatWarning: document.getElementById('cheat-warning'),
            btnMarkReview: document.getElementById('btn-mark-review'),
            btnFullscreen: document.getElementById('btn-fullscreen'),
            questionGrid: document.getElementById('question-grid'),
            answeredCount: document.getElementById('answered-count'),
            totalCount: document.getElementById('total-count'),
            markedCount: document.getElementById('marked-count'),
            questionNumber: document.getElementById('question-number'),
            questionStatus: document.getElementById('question-status'),
            stimulus: document.getElementById('stimulus'),
            questionImage: document.getElementById('question-image'),
            questionText: document.getElementById('question-text'),
            options: document.getElementById('options'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            btnSubmit: document.getElementById('btn-submit')
        };
        
        // Modal elements
        this.elements.modal = {
            overlay: document.getElementById('submit-modal'),
            modalTotal: document.getElementById('modal-total'),
            modalAnswered: document.getElementById('modal-answered'),
            modalMarked: document.getElementById('modal-marked'),
            modalUnanswered: document.getElementById('modal-unanswered'),
            btnConfirmSubmit: document.getElementById('btn-confirm-submit'),
            btnCancelSubmit: document.getElementById('btn-cancel-submit'),
            modalClose: document.querySelector('.modal-close')
        };
        
        // Toast
        this.elements.toast = document.getElementById('toast');
    }
    
    bindEvents() {
        // Login events
        this.elements.login.togglePassword.addEventListener('click', () => {
            const type = this.elements.login.password.type === 'password' ? 'text' : 'password';
            this.elements.login.password.type = type;
            this.elements.login.togglePassword.innerHTML = type === 'password' ? 
                '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
        
        this.elements.login.captchaRefresh.addEventListener('click', () => this.generateCaptcha());
        this.elements.login.btnLogin.addEventListener('click', () => this.handleLogin());
        
        // Enter key for login
        this.elements.login.nisn.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        this.elements.login.password.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        this.elements.login.token.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        this.elements.login.captchaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        // Info events
        this.elements.info.btnStartExam.addEventListener('click', () => this.startExam());
        this.elements.info.btnBackLogin.addEventListener('click', () => this.switchPanel('p-login'));
        
        // Quiz events
        this.elements.quiz.btnMarkReview.addEventListener('click', () => this.toggleMarkReview());
        this.elements.quiz.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
        this.elements.quiz.btnPrev.addEventListener('click', () => this.navigateQuestion(-1));
        this.elements.quiz.btnNext.addEventListener('click', () => this.navigateQuestion(1));
        this.elements.quiz.btnSubmit.addEventListener('click', () => this.showSubmitModal());
        
        // Modal events
        this.elements.modal.btnConfirmSubmit.addEventListener('click', () => this.submitExam());
        this.elements.modal.btnCancelSubmit.addEventListener('click', () => this.hideModal());
        this.elements.modal.modalClose.addEventListener('click', () => this.hideModal());
        
        // Auto-save answers
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.examStarted && !this.examFinished) {
                this.recordCheatAttempt('Tab switch detected');
            }
        });
    }
    
    setupCheatDetection() {
        // Detect right-click
        document.addEventListener('contextmenu', (e) => {
            if (this.examStarted && !this.examFinished) {
                e.preventDefault();
                this.recordCheatAttempt('Right-click attempted');
                return false;
            }
        });
        
        // Detect keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.examStarted || this.examFinished) return;
            
            // Prevent F5, Ctrl+R, Ctrl+Shift+R, F11, F12
            if (e.key === 'F5' || 
                (e.ctrlKey && e.key === 'r') || 
                (e.ctrlKey && e.shiftKey && e.key === 'R') ||
                e.key === 'F11' || 
                e.key === 'F12') {
                e.preventDefault();
                this.recordCheatAttempt(`Key ${e.key} pressed`);
            }
        });
        
        // Detect copy-paste
        document.addEventListener('copy', (e) => {
            if (this.examStarted && !this.examFinished) {
                e.preventDefault();
                this.recordCheatAttempt('Copy attempted');
            }
        });
        
        document.addEventListener('paste', (e) => {
            if (this.examStarted && !this.examFinished) {
                e.preventDefault();
                this.recordCheatAttempt('Paste attempted');
            }
        });
    }
    
    async simulateLoading() {
        this.showLoader('Memuat sistem...');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            this.elements.progressBar.style.width = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    this.hideLoader();
                }, 500);
            }
        }, 200);
    }
    
    showLoader(text = 'Memuat...') {
        this.elements.loaderText.textContent = text;
        this.elements.loader.style.display = 'flex';
    }
    
    hideLoader() {
        this.elements.loader.style.display = 'none';
    }
    
    generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let captcha = '';
        for (let i = 0; i < 6; i++) {
            captcha += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.currentCaptcha = captcha;
        this.elements.login.captchaDisplay.textContent = captcha;
        this.elements.login.captchaInput.value = '';
    }
    
    validateCaptcha() {
        const input = this.elements.login.captchaInput.value.toUpperCase();
        return input === this.currentCaptcha;
    }
    
    async handleLogin() {
        const nisn = this.elements.login.nisn.value.trim();
        const password = this.elements.login.password.value.trim();
        const token = this.elements.login.token.value.trim().toUpperCase();
        
        // Validasi input
        if (!nisn || !password || !token) {
            this.showError('Semua field harus diisi');
            return;
        }
        
        // Validasi NISN: 10 digit angka
        if (!/^\d{10}$/.test(nisn)) {
            this.showError('NISN harus 10 digit angka');
            return;
        }
        
        // Validasi Token: 6-8 karakter alfanumerik
        if (!/^[A-Z0-9]{6,8}$/.test(token)) {
            this.showError('Token harus 6-8 karakter (huruf/angka)');
            return;
        }
        
        if (!this.validateCaptcha()) {
            this.showError('Kode CAPTCHA salah');
            this.generateCaptcha();
            return;
        }
        
        this.showLoader('Memverifikasi data siswa...');
        
        try {
            // Simulasi API call ke Worker
            const response = await this.mockLoginAPI(nisn, password, token);
            
            if (response.success) {
                this.userData = response.user;
                this.examData = response.exam;
                this.questions = response.questions || [];
                
                // Simpan kunci jawaban untuk koreksi nanti
                this.correctAnswers = {};
                this.questions.forEach(q => {
                    this.correctAnswers[q.rowid] = q.kunci_jawaban;
                });
                
                // Update info panel
                this.updateInfoPanel();
                this.switchPanel('p-info');
                
                // Start countdown
                this.startCountdown();
                
                this.showToast('Login berhasil, mempersiapkan ujian...', 'success');
            } else {
                this.showError(response.message);
                this.generateCaptcha();
            }
        } catch (error) {
            this.showError('Terjadi kesalahan saat login');
            console.error('Login error:', error);
        } finally {
            this.hideLoader();
        }
    }
    
    async mockLoginAPI(nisn, password, token) {
        // Simulasi delay network
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock data untuk demo - SESUAI STRUKTUR DATABASE ANDA
        const mockUsers = {
            '1234567890': { 
                nisn: '1234567890',          // NISN 10 digit
                password: 'password123',     // Password dari tabel data_siswa
                nama: 'Budi Santoso',        // Nama dari tabel data_siswa
                kelas: 'XII IPA 1',          // Kelas dari tabel data_siswa
                jenjang: 'xii'               // Jenjang dari tabel data_siswa
            },
            '0987654321': {
                nisn: '0987654321',
                password: 'test123',
                nama: 'Siti Aminah',
                kelas: 'XI IPS 2',
                jenjang: 'xi'
            }
        };
        
        const mockExams = {
            'ABC123': {
                token: 'ABC123',
                status: '1',                    // Status aktif
                mata_pelajaran: 'Matematika Peminatan',
                nama_guru: 'Dr. Ahmad Wijaya, M.Pd',
                durasi: 120                     // Menit
            },
            'DEF456': {
                token: 'DEF456',
                status: '1',
                mata_pelajaran: 'Fisika',
                nama_guru: 'Dra. Rina Hartati',
                durasi: 90
            }
        };
        
        const user = mockUsers[nisn];
        const exam = mockExams[token];
        
        if (!user) {
            return { success: false, message: 'NISN tidak ditemukan' };
        }
        
        if (user.password !== password) {
            return { success: false, message: 'Password salah' };
        }
        
        if (!exam) {
            return { success: false, message: 'Token ujian tidak valid' };
        }
        
        if (exam.status !== '1') {
            return { success: false, message: 'Ujian tidak aktif' };
        }
        
        // Generate mock questions sesuai struktur bank_soal
        const questions = this.generateMockQuestions(token);
        
        return {
            success: true,
            user: {
                nisn: user.nisn,
                nama: user.nama,
                kelas: user.kelas,
                jenjang: user.jenjang
            },
            exam: exam,
            questions: questions
        };
    }
    
    generateMockQuestions(token) {
        // Generate 25 soal mock sesuai struktur bank_soal
        const questions = [];
        const totalQuestions = 25;
        
        for (let i = 1; i <= totalQuestions; i++) {
            const hasStimulus = i % 5 === 0;
            const hasImage = i % 7 === 0;
            
            questions.push({
                rowid: i,                           // ID unik sesuai bank_soal
                No: i,                              // Urutan soal
                stimulus: hasStimulus ? `Stimulus untuk soal nomor ${i}:<br><br>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.` : '',
                butir_soal: `Soal nomor ${i}: Berapakah hasil dari ${i} × ${i} jika ${i} adalah bilangan bulat positif?`,
                opsi_a: `${i * i}`,                 // Jawaban A
                opsi_b: `${i * i + 1}`,             // Jawaban B
                opsi_c: `${i * i - 1}`,             // Jawaban C
                opsi_d: `${i + i}`,                 // Jawaban D
                opsi_e: 'Tidak ada jawaban benar',  // Jawaban E
                img_link: hasImage ? `https://picsum.photos/400/200?random=${i}` : '',
                kunci_jawaban: 'A'                  // Kunci jawaban
            });
        }
        
        return questions;
    }
    
    updateInfoPanel() {
        this.elements.info.studentName.textContent = this.userData.nama;
        this.elements.info.studentClass.textContent = this.userData.kelas;
        this.elements.info.examSubject.textContent = this.examData.mata_pelajaran;
        this.elements.info.examTeacher.textContent = this.examData.nama_guru;
        this.elements.info.examTotal.textContent = `${this.questions.length} soal`;
        this.elements.info.examDuration.textContent = `${this.examData.durasi} menit`;
    }
    
    startCountdown() {
        let countdown = 5;
        this.elements.info.countdownTimer.textContent = countdown;
        
        this.countdownInterval = setInterval(() => {
            countdown--;
            this.elements.info.countdownTimer.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(this.countdownInterval);
                this.startExam();
            }
        }, 1000);
    }
    
    startExam() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.timeLeft = this.examData.durasi * 60; // Convert to seconds
        this.examStarted = true;
        this.userAnswers = {};
        this.markedQuestions.clear();
        
        // Initialize quiz
        this.initializeQuiz();
        this.switchPanel('p-quiz');
        this.startTimer();
        this.startAutoSave();
        
        // Show first question
        this.showQuestion(0);
        
        this.showToast('Ujian dimulai! Semangat!', 'info');
    }
    
    initializeQuiz() {
        // Update quiz header
        this.elements.quiz.currentSubject.textContent = this.examData.mata_pelajaran;
        this.elements.quiz.totalCount.textContent = this.questions.length;
        
        // Generate question grid
        this.generateQuestionGrid();
        
        // Update timer display
        this.updateTimerDisplay();
    }
    
    generateQuestionGrid() {
        this.elements.quiz.questionGrid.innerHTML = '';
        
        this.questions.forEach((question, index) => {
            const box = document.createElement('div');
            box.className = 'box unanswered';
            box.textContent = index + 1;
            box.dataset.index = index;
            box.dataset.rowid = question.rowid;
            
            box.addEventListener('click', () => {
                this.showQuestion(index);
            });
            
            this.elements.quiz.questionGrid.appendChild(box);
        });
    }
    
    showQuestion(index) {
        if (index < 0 || index >= this.questions.length) return;
        
        this.currentQuestionIndex = index;
        const question = this.questions[index];
        
        // Update UI
        this.elements.quiz.questionNumber.textContent = `Soal #${index + 1}`;
        
        const isAnswered = this.userAnswers[question.rowid] !== undefined;
        const isMarked = this.markedQuestions.has(question.rowid);
        
        this.elements.quiz.questionStatus.innerHTML = `
            <span class="status-badge">
                ${isAnswered ? 'Terjawab' : 'Belum dijawab'}
                ${isMarked ? ' • Ditandai' : ''}
            </span>
        `;
        
        // Update stimulus
        if (question.stimulus && question.stimulus.trim() !== '') {
            this.elements.stimulus.innerHTML = question.stimulus;
            this.elements.stimulus.style.display = 'block';
        } else {
            this.elements.stimulus.style.display = 'none';
        }
        
        // Update image
        this.elements.questionImage.innerHTML = '';
        if (question.img_link && question.img_link.trim() !== '') {
            const img = document.createElement('img');
            img.src = question.img_link;
            img.alt = `Gambar soal ${index + 1}`;
            img.onload = () => {
                this.elements.questionImage.style.display = 'block';
            };
            img.onerror = () => {
                this.elements.questionImage.innerHTML = '<p><i>Gambar tidak dapat dimuat</i></p>';
                this.elements.questionImage.style.display = 'block';
            };
            this.elements.questionImage.appendChild(img);
        } else {
            this.elements.questionImage.style.display = 'none';
        }
        
        // Update question text
        this.elements.questionText.innerHTML = `<p>${question.butir_soal}</p>`;
        
        // Update options
        this.elements.options.innerHTML = '';
        const options = [
            { id: 'A', text: question.opsi_a },
            { id: 'B', text: question.opsi_b },
            { id: 'C', text: question.opsi_c },
            { id: 'D', text: question.opsi_d },
            { id: 'E', text: question.opsi_e }
        ];
        
        const currentAnswer = this.userAnswers[question.rowid];
        
        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = `option ${currentAnswer === option.id ? 'selected' : ''}`;
            optionDiv.dataset.value = option.id;
            
            optionDiv.innerHTML = `
                <div class="option-letter">${option.id}</div>
                <div class="option-text">${option.text}</div>
            `;
            
            optionDiv.addEventListener('click', () => {
                this.selectAnswer(question.rowid, option.id);
            });
            
            this.elements.options.appendChild(optionDiv);
        });
        
        // Update navigation buttons
        this.elements.quiz.btnPrev.disabled = index === 0;
        this.elements.quiz.btnNext.disabled = index === this.questions.length - 1;
        
        // Update question grid highlight
        this.updateQuestionGrid();
    }
    
    selectAnswer(rowid, answer) {
        this.userAnswers[rowid] = answer;
        
        // Update UI
        const optionDivs = this.elements.options.querySelectorAll('.option');
        optionDivs.forEach(div => {
            div.classList.toggle('selected', div.dataset.value === answer);
        });
        
        // Update question grid
        this.updateQuestionGrid();
        this.updateStats();
        
        // Auto-save
        this.autoSaveAnswers();
    }
    
    updateQuestionGrid() {
        const boxes = this.elements.quiz.questionGrid.querySelectorAll('.box');
        
        boxes.forEach((box, index) => {
            const rowid = parseInt(box.dataset.rowid);
            box.className = 'box';
            
            if (index === this.currentQuestionIndex) {
                box.classList.add('now');
            }
            
            if (this.userAnswers[rowid] !== undefined) {
                box.classList.add('answered');
            } else {
                box.classList.add('unanswered');
            }
            
            if (this.markedQuestions.has(rowid)) {
                box.classList.add('marked');
            }
        });
    }
    
    updateStats() {
        const answered = Object.keys(this.userAnswers).length;
        const marked = this.markedQuestions.size;
        
        this.elements.quiz.answeredCount.textContent = answered;
        this.elements.quiz.markedCount.textContent = marked;
    }
    
    navigateQuestion(direction) {
        const newIndex = this.currentQuestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.questions.length) {
            this.showQuestion(newIndex);
        }
    }
    
    toggleMarkReview() {
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const rowid = currentQuestion.rowid;
        
        if (this.markedQuestions.has(rowid)) {
            this.markedQuestions.delete(rowid);
            this.showToast('Soal tidak lagi ditandai', 'info');
        } else {
            this.markedQuestions.add(rowid);
            this.showToast('Soal ditandai untuk review', 'info');
        }
        
        this.updateQuestionGrid();
        this.updateStats();
    }
    
    startTimer() {
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.autoSubmitExam();
            }
            
            // Warning colors
            const timerElement = this.elements.quiz.timer;
            if (this.timeLeft <= 300) { // 5 minutes left
                timerElement.style.color = '#f56565';
            } else if (this.timeLeft <= 600) { // 10 minutes left
                timerElement.style.color = '#f6ad55';
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.elements.quiz.timer.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.autoSaveAnswers();
        }, 30000); // Every 30 seconds
    }
    
    autoSaveAnswers() {
        if (!this.examStarted || this.examFinished) return;
        
        // Simulate saving to localStorage
        const saveData = {
            nisn: this.userData.nisn,
            token: this.examData.token,
            answers: this.userAnswers,
            marked: Array.from(this.markedQuestions),
            timeLeft: this.timeLeft,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('cbt_auto_save', JSON.stringify(saveData));
        
        // Show auto-save notification occasionally
        if (Math.random() > 0.7) {
            this.showToast('Jawaban otomatis tersimpan', 'info');
        }
    }
    
    showSubmitModal() {
        const total = this.questions.length;
        const answered = Object.keys(this.userAnswers).length;
        const marked = this.markedQuestions.size;
        const unanswered = total - answered;
        
        this.elements.modal.modalTotal.textContent = total;
        this.elements.modal.modalAnswered.textContent = answered;
        this.elements.modal.modalMarked.textContent = marked;
        this.elements.modal.modalUnanswered.textContent = unanswered;
        
        this.elements.modal.overlay.classList.add('active');
    }
    
    hideModal() {
        this.elements.modal.overlay.classList.remove('active');
    }
    
    async submitExam() {
        this.hideModal();
        this.showLoader('Mengirim jawaban ke server...');
        
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Calculate score based on kunci_jawaban
            let score = 0;
            this.questions.forEach(question => {
                const userAnswer = this.userAnswers[question.rowid];
                if (userAnswer === question.kunci_jawaban) {
                    score++;
                }
            });
            
            this.examFinished = true;
            clearInterval(this.timerInterval);
            clearInterval(this.autoSaveInterval);
            
            // Clear auto-save data
            localStorage.removeItem('cbt_auto_save');
            
            // Tentukan tabel nilai berdasarkan jenjang
            const nilaiTable = `nilai_${this.userData.jenjang}`;
            
            // Simpan ke database (simulasi)
            console.log(`INSERT INTO ${nilaiTable} (nisn, token, score) VALUES ('${this.userData.nisn}', '${this.examData.token}', ${score})`);
            
            // Show result
            setTimeout(() => {
                this.hideLoader();
                alert(`✅ Ujian Selesai!\n\n📊 Hasil Ujian:\nNama: ${this.userData.nama}\nKelas: ${this.userData.kelas}\nMata Pelajaran: ${this.examData.mata_pelajaran}\n\n🎯 Nilai: ${score}/${this.questions.length}\n📈 Persentase: ${Math.round((score / this.questions.length) * 100)}%\n\nTerima kasih telah mengikuti ujian.`);
                this.resetSystem();
            }, 1000);
            
        } catch (error) {
            this.hideLoader();
            this.showError('Gagal mengirim jawaban. Silakan coba lagi.');
        }
    }
    
    autoSubmitExam() {
        if (!this.examFinished) {
            this.showToast('Waktu habis! Jawaban akan dikirim otomatis.', 'warning');
            this.submitExam();
        }
    }
    
    recordCheatAttempt(reason) {
        this.cheatCount++;
        
        // Update UI
        this.elements.quiz.cheatCount.textContent = this.cheatCount;
        this.elements.quiz.cheatWarning.style.display = 'flex';
        
        // Visual warnings sesuai spesifikasi
        if (this.cheatCount >= 10) {
            document.body.classList.add('warn-r');
            document.body.classList.remove('warn-y');
            this.showToast('⚠️ PERINGATAN SERIUS: 10x Kecurangan terdeteksi!', 'error');
        } else if (this.cheatCount >= 5) {
            document.body.classList.add('warn-y');
            document.body.classList.remove('warn-r');
            this.showToast('⚠️ Peringatan: 5x Kecurangan terdeteksi', 'warning');
        }
        
        // Log cheat attempt
        console.log(`[CHEAT] ${reason}. Count: ${this.cheatCount}`);
        
        // In real system, send to server: INSERT INTO cheat_logs (nisn, token, reason)
    }
    
    toggleFullscreen() {
        if (!this.isFullscreen) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
            this.isFullscreen = true;
            this.elements.quiz.btnFullscreen.innerHTML = '<i class="fas fa-compress"></i>';
            this.showToast('Mode layar penuh diaktifkan', 'info');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.isFullscreen = false;
            this.elements.quiz.btnFullscreen.innerHTML = '<i class="fas fa-expand"></i>';
            this.showToast('Mode layar penuh dinonaktifkan', 'info');
        }
    }
    
    switchPanel(panelName) {
        // Hide all panels
        Object.values(this.elements.panels).forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Show target panel
        const panelKey = panelName.replace('p-', '');
        this.elements.panels[panelKey].classList.add('active');
        this.currentPanel = panelName;
        
        // Reset CAPTCHA when going back to login
        if (panelName === 'p-login') {
            this.generateCaptcha();
            this.elements.login.captchaInput.value = '';
        }
    }
    
    showError(message) {
        this.elements.login.loginError.textContent = message;
        this.elements.login.loginError.style.display = 'block';
        
        setTimeout(() => {
            this.elements.login.loginError.style.display = 'none';
        }, 5000);
    }
    
    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        
        // Set type-based styling
        toast.className = `toast ${type}`;
        
        // Set icon based on type
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        
        toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        toast.classList.add('show');
        
        // Auto hide
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    resetSystem() {
        // Reset all state
        this.userData = null;
        this.examData = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.markedQuestions.clear();
        this.cheatCount = 0;
        this.examStarted = false;
        this.examFinished = false;
        this.timeLeft = 0;
        this.correctAnswers = {};
        
        // Clear intervals
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        
        // Reset UI
        this.elements.login.nisn.value = '';
        this.elements.login.password.value = '';
        this.elements.login.token.value = '';
        this.elements.login.captchaInput.value = '';
        
        // Reset visual warnings
        document.body.className = '';
        
        // Switch to login panel
        this.switchPanel('p-login');
        this.generateCaptcha();
        
        this.showToast('Sistem telah direset, silakan login kembali', 'info');
    }
}

// Initialize the CBT system when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cbtSystem = new CBTSystem();
});
