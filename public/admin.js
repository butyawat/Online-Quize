document.addEventListener('DOMContentLoaded', () => {
    const createQuizBtn = document.getElementById('createQuizBtn');
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const quizSelect = document.getElementById('quizSelect');
    const logoutBtn = document.getElementById('logoutBtn');
    const homeBtn = document.getElementById('homeBtn');
    
    // Initialize
    fetchQuizzes();
    
    // Event Listeners
    createQuizBtn.addEventListener('click', createQuiz);
    addQuestionBtn.addEventListener('click', addQuestion);
    logoutBtn.addEventListener('click', logout);
    homeBtn.addEventListener('click', () => window.location.href = '/');
    
    function logout() {
        localStorage.removeItem('user');
        window.location.href = '/';
    }
    
    async function fetchQuizzes() {
        try {
            const response = await fetch('/api/quizzes');
            const quizzes = await response.json();
            populateQuizSelect(quizzes);
        } catch (err) {
            showNotification('Error', 'Failed to load quizzes', 'error');
        }
    }
    
    function populateQuizSelect(quizzes) {
        quizSelect.innerHTML = '<option value="">Select a Quiz</option>';
        
        quizzes.forEach(quiz => {
            const option = document.createElement('option');
            option.value = quiz.id;
            option.textContent = quiz.title;
            quizSelect.appendChild(option);
        });
    }
    
    async function createQuiz() {
        const title = document.getElementById('quizTitle').value;
        const description = document.getElementById('quizDesc').value;
        const isPointsBased = document.getElementById('isPointsBased').checked;
        
        if (!title) {
            showNotification('Error', 'Quiz title is required', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title, 
                    description, 
                    is_points_based: isPointsBased 
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification('Success', 'Quiz created successfully!', 'success');
                document.getElementById('quizTitle').value = '';
                document.getElementById('quizDesc').value = '';
                fetchQuizzes();
            } else {
                showNotification('Error', result.error || 'Failed to create quiz', 'error');
            }
        } catch (err) {
            showNotification('Error', 'Network error', 'error');
        }
    }
    
    async function addQuestion() {
        const quizId = quizSelect.value;
        const questionText = document.getElementById('questionText').value;
        const optionInputs = document.querySelectorAll('.option-input');
        
        // Extract option values
        const options = Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(value => value !== '');
        
        const correctOption = document.getElementById('correctOption').value;

        if (!quizId) {
            showNotification('Error', 'Please select a quiz', 'error');
            return;
        }

        if (!questionText) {
            showNotification('Error', 'Question text is required', 'error');
            return;
        }

        if (options.length < 2) {
            showNotification('Error', 'Please provide at least 2 options', 'error');
            return;
        }

        try {
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quiz_id: quizId,
                    question_text: questionText,
                    options: options,
                    correct_option: correctOption
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                showNotification('Success', 'Question added successfully!', 'success');
                document.getElementById('questionText').value = '';
                optionInputs.forEach(input => input.value = '');
            } else {
                showNotification('Error', result.error || 'Failed to add question', 'error');
            }
        } catch (err) {
            showNotification('Error', 'Network error: Failed to add question', 'error');
        }
    }
    
    function showNotification(title, message, type) {
        // Create notification element
        const notification = document.getElementById('notification');
        notification.className = `notification ${type} show`;
        notification.querySelector('.notification-title').textContent = title;
        notification.querySelector('.notification-message').textContent = message;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
});