class CBTSystem {
    constructor() {
        // State management
        this.currentPanel = 'p-login';
        this.userData = null;
        this.examData = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.markedQuestions = new Set();
        this.cheatCount = 0;
        this.examStarted = false;
        this.examFinished = false;
        this.autoSaveInterval = null;
        this.countdownInterval = null;
        this.timerInterval = null;
        this.timeLeft = 0;
        this.isFullscreen = false;
        
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
        
        // Login elements
        this.elements.login = {
            nish: document.getElementById('nish'),
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
        
        // Enter key for login
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.currentPanel === 'p-login') {
                this.handleLogin();
            }
        });
        
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
            
            const forbiddenKeys = ['F5', 'F11', 'F12', 'Escape'];
            const forbiddenCombos = [
                { key: 'r', ctrl: true },
                { key: 'R', ctrl: true },
                { key: 'F5', ctrl: true }
            ];
            
            // Check single keys
            if (forbiddenKeys.includes(e.key)) {
                e.preventDefault();
                this.recordCheatAttempt(`Key ${e.key} pressed`);
            }
            
            // Check combos
            for (const combo of forbiddenCombos) {
                if (e.key === combo.key && 
                   ((combo.ctrl && e.ctrlKey) || !combo.ctrl)) {
                    e.preventDefault();
                    this.recordCheatAttempt(`Shortcut ${e.ctrlKey ? 'Ctrl+' : ''}${e.key} pressed`);
                }
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
    }
    
    validateCaptcha() {
        const input = this.elements.login.captchaInput.value.toUpperCase();
        return input === this.currentCaptcha;
    }
    
    async handleLogin() {
        const nish = this.elements.login.nish.value.trim();
        const password = this.elements.login.password.value.trim();
        const token = this.elements.login.token.value.trim();
        
        // Validasi input
        if (!nish || !password || !token) {
            this.showError('Semua field harus diisi');
            return;
        }
        
        if (!this.validateCaptcha()) {
            this.showError('Kode CAPTCHA salah');
            this.generateCaptcha();
            return;
        }
        
        this.showLoader('Memverifikasi data...');
        
        try {
            // Simulasi API call ke Worker
            const response = await this.mockLoginAPI(nish, password, token);
            
            if (response.success) {
                this.userData = response.user;
                this.examData = response.exam;
                
                // Update info panel
                this.updateInfoPanel();
                this.switchPanel('p-info');
                
                // Start countdown
                this.startCountdown();
                
                this.showToast('Login berhasil', 'success');
            } else {
                this.showError(response.message);
            }
        } catch (error) {
            this.showError('Terjadi kesalahan saat login');
            console.error('Login error:', error);
        } finally {
            this.hideLoader();
        }
    }
    
    async mockLoginAPI(nish, password, token) {
        // Simulasi delay network
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock data untuk demo
        const mockUsers = {
            '1234567890': { 
                nish: '1234567890',
                password: 'password123',
                nama: 'Budi Santoso',
                kelas: 'XII IPA 1',
                jenjang: 'xii'
            },
            '0987654321': {
                nish: '0987654321',
                password: 'test123',
                nama: 'Siti Aminah',
                kelas: 'XI IPS 2',
                jenjang: 'xi'
            }
        };
        
        const mockExams = {
            'ABC123': {
                token: 'ABC123',
                status: '1',
                mata_pelajaran: 'Matematika Peminatan',
                nama_guru: 'Dr. Ahmad Wijaya, M.Pd',
                durasi: 120,
                jumlah_soal: 25
            },
            'DEF456': {
                token: 'DEF456',
                status: '1',
                mata_pelajaran: 'Fisika',
                nama_guru: 'Dra. Rina Hartati',
                durasi: 90,
                jumlah_soal: 20
            }
        };
        
        const user = mockUsers[nish];
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
        
        // Simulasi fetch questions
        const questions = await this.mockFetchQuestions(token);
        
        return {
            success: true,
            user,
            exam,
            questions
        };
    }
    
    async mockFetchQuestions(token) {
        // Generate mock questions
        const questions = [];
        const subject = token === 'ABC123' ? 'Matematika' : 'Fisika';
        
        for (let i = 1; i <= 25; i++) {
            questions.push({
                rowid: i,
                No: i,
                stimulus: i % 5 === 0 ? `Ini adalah stimulus untuk soal nomor ${i}. Stimulus berisi informasi pendukung yang relevan dengan pertanyaan.` : '',
                butir_soal: `Berapakah hasil dari ${i} × ${i} jika ${i} adalah bilangan bulat positif?`,
                opsi_a: `${i * i}`,
                opsi_b: `${i * i + 1}`,
                opsi_c: `${i * i - 1}`,
                opsi_d: `${i + i}`,
                opsi_e: `${i * 2}`,
                img_link: i % 7 === 0 ? 'https://picsum.photos/400/200?random=' + i : '',
                kunci_jawaban: 'A'
            });
        }
        
        return questions;
    }
    
    updateInfoPanel() {
        this.elements.info.studentName.textContent = this.userData.nama;
        this.elements.info.studentClass.textContent = this.userData.kelas;
        this.elements.info.examSubject.textContent = this.examData.mata_pelajaran;
        this.elements.info.examTeacher.textContent = this.examData.nama_guru;
        this.elements.info.examTotal.textContent = `${this.examData.jumlah_soal} soal`;
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
        
        this.questions = this.generateMockQuestions();
        this.timeLeft = this.examData.durasi * 60; // Convert to seconds
        this.examStarted = true;
        
        // Initialize quiz
        this.initializeQuiz();
        this.switchPanel('p-quiz');
        this.startTimer();
        this.startAutoSave();
        
        // Show first question
        this.showQuestion(0);
        
        this.showToast('Ujian dimulai! Semangat!', 'info');
    }
    
    generateMockQuestions() {
        // Use fetched questions if available, otherwise generate mock
        if (this.questions && this.questions.length > 0) {
            return this.questions;
        }
        
        const questions = [];
        const totalQuestions = this.examData.jumlah_soal || 25;
        
        for (let i = 1; i <= totalQuestions; i++) {
            questions.push({
                id: i,
                number: i,
                stimulus: i % 5 === 0 ? `Stimulus untuk soal nomor ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.` : '',
                question: `Soal nomor ${i}: Berapakah hasil dari ${i} × ${i}?`,
                image: i % 7 === 0 ? `https://picsum.photos/400/200?random=${i}` : null,
                options: [
                    { id: 'A', text: `${i * i}` },
                    { id: 'B', text: `${i * i + 1}` },
                    { id: 'C', text: `${i * i - 1}` },
                    { id: 'D', text: `${i + i}` },
                    { id: 'E', text: 'Tidak ada jawaban yang benar' }
                ],
                correctAnswer: 'A'
            });
        }
        
        return questions;
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
        this.elements.quiz.questionStatus.innerHTML = `
            <span class="status-badge">
                ${this.userAnswers[index] ? 'Terjawab' : 'Belum dijawab'}
                ${this.markedQuestions.has(index) ? ' • Ditandai' : ''}
            </span>
        `;
        
        // Update stimulus
        if (question.stimulus) {
            this.elements.stimulus.innerHTML = `<p>${question.stimulus}</p>`;
            this.elements.stimulus.style.display = 'block';
        } else {
            this.elements.stimulus.style.display = 'none';
        }
        
        // Update image
        this.elements.questionImage.innerHTML = '';
        if (question.image || question.img_link) {
            const img = document.createElement('img');
            img.src = question.image || question.img_link;
            img.alt = `Gambar soal ${index + 1}`;
            img.onerror = () => {
                this.elements.questionImage.innerHTML = '<p><i>Gambar tidak dapat dimuat</i></p>';
            };
            this.elements.questionImage.appendChild(img);
            this.elements.questionImage.style.display = 'block';
        } else {
            this.elements.questionImage.style.display = 'none';
        }
        
        // Update question text
        this.elements.questionText.innerHTML = `<p>${question.question || question.butir_soal}</p>`;
        
        // Update options
        this.elements.options.innerHTML = '';
        const options = question.options || [
            { id: 'A', text: question.opsi_a },
            { id: 'B', text: question.opsi_b },
            { id: 'C', text: question.opsi_c },
            { id: 'D', text: question.opsi_d },
            { id: 'E', text: question.opsi_e }
        ];
        
        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = `option ${this.userAnswers[index] === option.id ? 'selected' : ''}`;
            optionDiv.dataset.value = option.id;
            
            optionDiv.innerHTML = `
                <div class="option-letter">${option.id}</div>
                <div class="option-text">${option.text}</div>
            `;
            
            optionDiv.addEventListener('click', () => {
                this.selectAnswer(index, option.id);
            });
            
            this.elements.options.appendChild(optionDiv);
        });
        
        // Update navigation buttons
        this.elements.quiz.btnPrev.disabled = index === 0;
        this.elements.quiz.btnNext.disabled = index === this.questions.length - 1;
        
        // Update question grid highlight
        this.updateQuestionGrid();
    }
    
    selectAnswer(questionIndex, answer) {
        this.userAnswers[questionIndex] = answer;
        
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
            box.className = 'box';
            
            if (index === this.currentQuestionIndex) {
                box.classList.add('now');
            }
            
            if (this.userAnswers[index]) {
                box.classList.add('answered');
            } else {
                box.classList.add('unanswered');
            }
            
            if (this.markedQuestions.has(index)) {
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
        if (this.markedQuestions.has(this.currentQuestionIndex)) {
            this.markedQuestions.delete(this.currentQuestionIndex);
            this.showToast('Soal tidak lagi ditandai', 'info');
        } else {
            this.markedQuestions.add(this.currentQuestionIndex);
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
        // Simulate saving to IndexedDB/localStorage
        const saveData = {
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
        this.showLoader('Mengirim jawaban...');
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Calculate score
            let score = 0;
            this.questions.forEach((question, index) => {
                if (this.userAnswers[index] === question.correctAnswer) {
                    score++;
                }
            });
            
            this.examFinished = true;
            clearInterval(this.timerInterval);
            clearInterval(this.autoSaveInterval);
            
            // Clear auto-save data
            localStorage.removeItem('cbt_auto_save');
            
            // Show result
            setTimeout(() => {
                this.hideLoader();
                alert(`Ujian selesai!\n\nNilai Anda: ${score}/${this.questions.length}\n\nTerima kasih telah mengikuti ujian.`);
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
        
        // Visual warnings
        if (this.cheatCount >= 10) {
            document.body.classList.add('warn-r');
            document.body.classList.remove('warn-y');
            this.showToast('PERINGATAN SERIUS: Kecurangan terdeteksi!', 'error');
        } else if (this.cheatCount >= 5) {
            document.body.classList.add('warn-y');
            this.showToast('Peringatan: Aktivitas mencurigakan terdeteksi', 'warning');
        }
        
        // Log cheat attempt (in real system, send to server)
        console.warn(`Cheat detected: ${reason}. Count: ${this.cheatCount}`);
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
        this.elements.panels[panelName.replace('p-', '')].classList.add('active');
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
        toast.className = 'toast';
        switch (type) {
            case 'success':
                toast.style.background = '#48bb78';
                toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
                break;
            case 'error':
                toast.style.background = '#f56565';
                toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
                break;
            case 'warning':
                toast.style.background = '#f6ad55';
                toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
                break;
            default:
                toast.style.background = '#667eea';
                toast.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        }
        
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
        
        // Clear intervals
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        
        // Reset UI
        this.elements.login.nish.value = '';
        this.elements.login.password.value = '';
        this.elements.login.token.value = '';
        this.elements.login.captchaInput.value = '';
        
        // Reset visual warnings
        document.body.className = '';
        
        // Switch to login panel
        this.switchPanel('p-login');
        this.generateCaptcha();
        
        this.showToast('Sistem telah direset', 'info');
    }
}

// Initialize the CBT system when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cbtSystem = new CBTSystem();
});
