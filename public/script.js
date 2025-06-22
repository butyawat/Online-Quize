document.addEventListener('DOMContentLoaded', () => {
    const socket = io(https://online-quize-pk3p.onrender.com);
    let currentUser = null;
    let currentQuiz = null;
    let currentQuestionIndex = 0;
    let currentSelection = null;
    let score = 0;
    let timeLeft = 30;
    let timer = null;
    let answerSubmitted = false;
    let takenQuizzes = [];
    
    // DOM Elements
    const authModal = document.getElementById('authModal');
    const loginBtnHeader = document.getElementById('loginBtnHeader');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const userInfo = document.getElementById('userInfo');
    const userAvatar = document.getElementById('userAvatar');
    const usernameEl = document.getElementById('username');
    const quizCards = document.getElementById('quizCards');
    const quizInterface = document.getElementById('quizInterface');
    const quizSelection = document.getElementById('quizSelection');
    const quizTitle = document.getElementById('quizTitle');
    const questionText = document.getElementById('questionText');
    const optionsContainer = document.getElementById('optionsContainer');
    const nextBtn = document.getElementById('nextBtn');
    const timerEl = document.getElementById('timer');
    const leaderboard = document.getElementById('leaderboard');
    const notification = document.getElementById('notification');
    const adminBtn = document.getElementById('adminBtn');
    const currentScoreEl = document.getElementById('currentScore');
    
    // Initialize the app
    init();
    
    function init() {
        setupEventListeners();
        checkLoginStatus();
    }
    
    function setupEventListeners() {
        // Auth tabs
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const form = tab.dataset.form;
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                loginForm.classList.remove('active');
                signupForm.classList.remove('active');
                
                if (form === 'login') {
                    loginForm.classList.add('active');
                } else {
                    signupForm.classList.add('active');
                }
            });
        });
        
        // Login button
        loginBtn.addEventListener('click', login);
        
        // Signup button
        signupBtn.addEventListener('click', signup);
        
        // Header login button
        loginBtnHeader.addEventListener('click', () => {
            authModal.style.display = 'flex';
        });
        
        // Logout button
        logoutBtn.addEventListener('click', logout);
        
        // Admin button
        adminBtn.addEventListener('click', () => {
            window.location.href = '/admin';
        });
    }
    
    async function login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            showNotification('Error', 'Please fill all fields', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentUser = data;
                localStorage.setItem('user', JSON.stringify(currentUser));
                showNotification('Success', 'Login successful!', 'success');
                authModal.style.display = 'none';
                updateUserUI();
                await fetchTakenQuizzes();
                fetchQuizzes();
                fetchLeaderboard();
            } else {
                showNotification('Error', data.error || 'Login failed', 'error');
            }
        } catch (err) {
            showNotification('Error', 'Network error', 'error');
        }
    }
    
    async function signup() {
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;
        
        if (!username || !password || !confirm) {
            showNotification('Error', 'Please fill all fields', 'error');
            return;
        }
        
        if (password !== confirm) {
            showNotification('Error', 'Passwords do not match', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('Success', 'Registration successful! Please login', 'success');
                // Switch to login tab
                authTabs.forEach(tab => tab.classList.remove('active'));
                authTabs[0].classList.add('active');
                signupForm.classList.remove('active');
                loginForm.classList.add('active');
                
                // Clear form
                document.getElementById('signupUsername').value = '';
                document.getElementById('signupPassword').value = '';
                document.getElementById('signupConfirm').value = '';
            } else {
                showNotification('Error', data.error || 'Registration failed', 'error');
            }
        } catch (err) {
            showNotification('Error', 'Network error', 'error');
        }
    }
    
    function logout() {
        currentUser = null;
        localStorage.removeItem('user');
        takenQuizzes = [];
        updateUserUI();
        quizCards.innerHTML = '';
        fetchLeaderboard(); // Show empty leaderboard
        showNotification('Info', 'You have been logged out', 'info');
    }
    
    function checkLoginStatus() {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                currentUser = JSON.parse(user);
                updateUserUI();
                fetchTakenQuizzes().then(() => {
                    fetchQuizzes();
                    fetchLeaderboard();
                });
            } catch (e) {
                console.error('Error parsing user data', e);
                localStorage.removeItem('user');
            }
        } else {
            // Show overall leaderboard for guests
            fetchLeaderboard();
        }
    }
    
    function updateUserUI() {
        if (currentUser) {
            userInfo.style.display = 'flex';
            logoutBtn.style.display = 'inline-flex';
            loginBtnHeader.style.display = 'none';
            userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            usernameEl.textContent = currentUser.username;
        } else {
            userInfo.style.display = 'none';
            logoutBtn.style.display = 'none';
            loginBtnHeader.style.display = 'inline-flex';
        }
    }
    
    async function fetchTakenQuizzes() {
        if (!currentUser) {
            takenQuizzes = [];
            return;
        }
        
        try {
            const response = await fetch(`/api/scores/user/${currentUser.id}`);
            const scores = await response.json();
            takenQuizzes = scores.map(score => score.quiz_id);
        } catch (err) {
            console.error('Failed to fetch taken quizzes:', err);
            takenQuizzes = [];
        }
    }
    
    async function fetchQuizzes() {
        if (!currentUser) return;
        
        try {
            const response = await fetch('/api/quizzes');
            const quizzes = await response.json();
            renderQuizCards(quizzes);
        } catch (err) {
            showNotification('Error', 'Failed to load quizzes', 'error');
        }
    }
    
    function renderQuizCards(quizzes) {
        quizCards.innerHTML = '';
        
        quizzes.forEach(quiz => {
            const quizCard = document.createElement('div');
            quizCard.className = 'quiz-card';
            
            const isTaken = takenQuizzes.includes(quiz.id);
            
            quizCard.innerHTML = `
                <div class="quiz-card-header">
                    <h3>${quiz.title}</h3>
                </div>
                <div class="quiz-card-body">
                    <p class="quiz-description">${quiz.description || 'No description available'}</p>
                    <div class="quiz-stats">
                        <span>${quiz.is_points_based ? 'Points Based' : 'Practice'}</span>
                    </div>
                </div>
                <div class="quiz-card-footer">
                    <button class="btn start-quiz" data-id="${quiz.id}" ${isTaken ? 'disabled' : ''}>
                        ${isTaken ? 'Already Taken' : 'Start Quiz'}
                    </button>
                </div>
            `;
            quizCards.appendChild(quizCard);
        });
        
        // Add event listeners to start buttons
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', () => {
                if (!currentUser) {
                    showNotification('Error', 'Please login to play quizzes', 'error');
                    return;
                }
                
                const quizId = button.getAttribute('data-id');
                
                // Double-check if quiz is taken
                if (takenQuizzes.includes(Number(quizId))) {
                    showNotification('Info', 'You have already taken this quiz', 'info');
                    return;
                }
                
                startQuiz(quizId);
            });
        });
    }
    
    async function startQuiz(quizId) {
        try {
            const response = await fetch(`/api/quizzes/${quizId}/questions`);
            const questions = await response.json();
            
            if (questions.length === 0) {
                showNotification('Error', 'This quiz has no questions!', 'error');
                return;
            }
            
            currentQuiz = {
                id: quizId,
                questions: questions
            };
            currentQuestionIndex = 0;
            score = 0;
            answerSubmitted = false;
            
            // Show quiz interface
            quizSelection.classList.add('hidden');
            quizInterface.style.display = 'block';
            
            // Initialize score display
            updateScoreDisplay();
            
            // Load first question
            loadQuestion();
        } catch (err) {
            showNotification('Error', 'Failed to start quiz', 'error');
        }
    }
    
    function loadQuestion() {
        if (currentQuestionIndex >= currentQuiz.questions.length) {
            endQuiz();
            return;
        }
        
        const question = currentQuiz.questions[currentQuestionIndex];
        quizTitle.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}`;
        questionText.textContent = question.question_text;
        currentSelection = null;
        answerSubmitted = false;
        
        // Clear previous options
        optionsContainer.innerHTML = '';
        
        // Add new options
        const options = [
            question.option1,
            question.option2,
            question.option3,
            question.option4
        ].filter(opt => opt !== null && opt !== undefined);
        
        options.forEach((option, index) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'option';
            optionEl.textContent = option;
            optionEl.dataset.index = index;
            optionEl.addEventListener('click', () => selectAnswer(index, question.correct_option));
            optionsContainer.appendChild(optionEl);
        });
        
        // Reset and start timer
        timeLeft = 30;
        updateTimer();
        startTimer();
        nextBtn.style.display = 'none';
    }
    
    function selectAnswer(selectedIndex, correctIndex) {
        if (answerSubmitted) return;
        
        const options = document.querySelectorAll('.option');
        
        // Clear previous selection
        options.forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select new option
        options[selectedIndex].classList.add('selected');
        currentSelection = selectedIndex;
        answerSubmitted = true;
        
        // Calculate score
        if (selectedIndex === correctIndex - 1) {
            score += 10;
            showNotification('Correct!', 'You earned 10 points', 'success');
        } else {
            score -= 1;
            showNotification('Incorrect!', 'You lost 1 point', 'error');
        }
        
        // Update score display
        updateScoreDisplay();
        
        // Show next button
        nextBtn.style.display = 'inline-flex';
    }
    
    nextBtn.addEventListener('click', () => {
        nextBtn.style.display = 'none';
        currentQuestionIndex++;
        loadQuestion();
    });
    
    function startTimer() {
        clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            updateTimer();
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                timer = null;
                if (!answerSubmitted) {
                    showNotification('Time Up!', 'Moving to next question', 'info');
                    currentSelection = null;
                    nextBtn.style.display = 'inline-flex';
                    answerSubmitted = true;
                }
            }
        }, 1000);
    }
    
    function updateTimer() {
        timerEl.innerHTML = `${timeLeft}s`;
        
        if (timeLeft <= 10) {
            timerEl.style.background = 'var(--warning)';
        } else {
            timerEl.style.background = 'var(--primary)';
        }
    }
    
    function updateScoreDisplay() {
        if (currentScoreEl) {
            currentScoreEl.textContent = score;
        }
    }
    
    async function endQuiz() {
        quizInterface.style.display = 'none';
        quizSelection.classList.remove('hidden');
        
        // Save score
        try {
            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    quiz_id: currentQuiz.id,
                    score: score
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save score');
            }
            
            // Update taken quizzes
            takenQuizzes.push(Number(currentQuiz.id));
            
            // Immediately update UI
            fetchQuizzes();
            
            // Fetch and show updated leaderboard
            fetchLeaderboard();
            
            showNotification('Quiz Completed!', `Your final score: ${score} points`, 'info');
        } catch (err) {
            showNotification('Error', 'Failed to save score', 'error');
        }
    }
    
    async function fetchLeaderboard() {
        try {
            // Use overall leaderboard endpoint
            const response = await fetch('/api/leaderboard');
            const scores = await response.json();
            renderLeaderboard(scores);
        } catch (err) {
            console.error('Leaderboard error:', err);
            renderLeaderboardError(err);
        }
    }
    
    function renderLeaderboard(scores) {
        leaderboard.innerHTML = '';
        
        if (!scores || scores.length === 0) {
            leaderboard.innerHTML = '<div class="no-leaderboard">No scores yet. Be the first to play!</div>';
            return;
        }
        
        scores.forEach((player) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <div class="player-avatar">${player.username.charAt(0)}</div>
                <div class="player-info">
                    <div class="player-name">${player.username}</div>
                    <div class="player-score">${player.total_score} points</div>
                </div>
                <div class="player-rank">${player.rank}</div>
            `;
            leaderboard.appendChild(playerCard);
        });
    }
    
    function renderLeaderboardError(err) {
        leaderboard.innerHTML = `
            <div class="error">
                <p>Failed to load leaderboard</p>
                <p>${err.message || 'Unknown error'}</p>
            </div>
        `;
    }
    
    function showNotification(title, message, type) {
        notification.className = `notification ${type} show`;
        notification.querySelector('.notification-title').textContent = title;
        notification.querySelector('.notification-message').textContent = message;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
});
