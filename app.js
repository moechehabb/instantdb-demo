// Initialize InstantDB
const db = new InstantDB({
  appId: 'c5481d25-da4e-40ca-a287-6093305b0e7c',
  apiKey: '12dac8ab-22fe-4741-9d6d-b0c6a3a95a44'
});

// Game state
let gameState = {
  currentScreen: 'welcome', // welcome, game, results
  currentCategory: '',
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  selectedAnswer: null,
  answered: false,
  gameSessionId: null
};

// DOM Elements
const screens = {
  welcome: document.getElementById('welcome-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen')
};

// Initialize the game
async function init() {
  // Load leaderboard
  await loadLeaderboard();
  
  // Set up event listeners
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  document.getElementById('save-score').addEventListener('click', saveScore);
  document.getElementById('play-again').addEventListener('click', resetGame);
  
  // Check if we have questions, if not, seed them
  const questions = await db.query('Question').select().exec();
  if (questions.length === 0) {
    await seedQuestions();
  }
}

// Start a new game
async function startGame(category) {
  gameState.currentCategory = category;
  gameState.questions = await getQuestions(category);
  gameState.currentQuestionIndex = 0;
  gameState.score = 0;
  gameState.answered = false;
  
  // Create a new game session
  const session = await db.transact({
    GameSession: {
      userId: 'guest_' + Math.random().toString(36).substr(2, 9),
      category: category,
      score: 0,
      completedAt: new Date().toISOString(),
      totalQuestions: 10,
      correctAnswers: 0
    }
  });
  
  gameState.gameSessionId = session.GameSession[0].id;
  
  showScreen('game');
  displayQuestion();
}

// Get questions for a category
async function getQuestions(category) {
  // Get 10 random questions from the selected category
  const result = await db.query('Question')
    .where('category', '==', category)
    .limit(10)
    .exec();
  
  return result.map(q => ({
    ...q,
    answers: shuffleArray([...q.incorrectAnswers, q.correctAnswer])
  }));
}

// Display the current question
function displayQuestion() {
  const question = gameState.questions[gameState.currentQuestionIndex];
  if (!question) return;
  
  // Update UI
  document.getElementById('category').textContent = question.category;
  document.getElementById('question-number').textContent = 
    `Question ${gameState.currentQuestionIndex + 1}/${gameState.questions.length}`;
  document.getElementById('question-text').textContent = question.question;
  document.getElementById('score').textContent = gameState.score;
  
  // Clear previous answers
  const answersContainer = document.getElementById('answers');
  answersContainer.innerHTML = '';
  
  // Add answer buttons
  question.answers.forEach((answer, index) => {
    const button = document.createElement('button');
    button.className = 'answer-btn w-full text-left p-4 border rounded-lg hover:bg-gray-100';
    button.textContent = answer;
    button.onclick = () => selectAnswer(index);
    answersContainer.appendChild(button);
  });
  
  // Hide feedback and next button
  document.getElementById('feedback').classList.add('hidden');
}

// Handle answer selection
function selectAnswer(answerIndex) {
  if (gameState.answered) return;
  
  gameState.answered = true;
  gameState.selectedAnswer = answerIndex;
  
  const question = gameState.questions[gameState.currentQuestionIndex];
  const isCorrect = question.answers[answerIndex] === question.correctAnswer;
  
  // Update score if correct
  if (isCorrect) {
    gameState.score += 10;
    document.getElementById('score').textContent = gameState.score;
  }
  
  // Show feedback
  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedback-text');
  
  feedbackText.textContent = isCorrect 
    ? '✅ Correct! Well done!' 
    : `❌ Incorrect! The correct answer is: ${question.correctAnswer}`;
  
  feedback.classList.remove('hidden');
  
  // Style answer buttons
  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.add('opacity-75');
    if (question.answers[idx] === question.correctAnswer) {
      btn.classList.add('correct');
    } else if (idx === answerIndex) {
      btn.classList.add('incorrect');
    }
  });
  
  // Update game session
  updateGameSession(isCorrect);
}

// Update the game session with the current score
async function updateGameSession(isCorrect) {
  if (!gameState.gameSessionId) return;
  
  const session = await db.query('GameSession')
    .where('id', '==', gameState.gameSessionId)
    .first()
    .exec();
  
  if (session) {
    await db.transact({
      GameSession: {
        id: gameState.gameSessionId,
        score: gameState.score,
        correctAnswers: isCorrect ? session.correctAnswers + 1 : session.correctAnswers
      }
    });
  }
}

// Move to the next question
function nextQuestion() {
  gameState.currentQuestionIndex++;
  gameState.answered = false;
  
  if (gameState.currentQuestionIndex < gameState.questions.length) {
    displayQuestion();
  } else {
    showResults();
  }
}

// Show game results
function showResults() {
  showScreen('results');
  document.getElementById('final-score').textContent = gameState.score;
  
  const resultMessage = document.getElementById('result-message');
  const percentage = Math.round((gameState.score / (gameState.questions.length * 10)) * 100);
  
  if (percentage >= 80) {
    resultMessage.textContent = '🎉 Amazing! You\'re a trivia master!';
  } else if (percentage >= 50) {
    resultMessage.textContent = '👍 Good job! You know your stuff!';
  } else {
    resultMessage.textContent = 'Keep practicing! You\'ll get better!';
  }
}

// Save score to leaderboard
async function saveScore() {
  const username = document.getElementById('username').value.trim();
  if (!username) {
    alert('Please enter your name');
    return;
  }
  
  // Create or update user
  let user = await db.query('User')
    .where('username', '==', username)
    .first()
    .exec();
  
  if (!user) {
    const result = await db.transact({
      User: {
        username: username
      }
    });
    user = result.User[0];
  }
  
  // Update game session with user
  if (gameState.gameSessionId) {
    await db.transact({
      GameSession: {
        id: gameState.gameSessionId,
        userId: user.id
      }
    });
  }
  
  alert('Score saved to leaderboard!');
  await loadLeaderboard();
}

// Load leaderboard
async function loadLeaderboard() {
  const leaderboard = document.getElementById('leaderboard-entries');
  leaderboard.innerHTML = '';
  
  // Get top 10 scores
  const sessions = await db.query('GameSession')
    .orderBy('score', 'desc')
    .limit(10)
    .include('User')
    .exec();
  
  if (sessions.length === 0) {
    leaderboard.innerHTML = '<p class="text-gray-500">No scores yet. Be the first!</p>';
    return;
  }
  
  sessions.forEach((session, index) => {
    const entry = document.createElement('div');
    entry.className = 'flex justify-between items-center bg-gray-50 p-2 rounded';
    entry.innerHTML = `
      <span>${index + 1}. ${session.User?.username || 'Anonymous'}</span>
      <span class="font-semibold">${session.score}</span>
    `;
    leaderboard.appendChild(entry);
  });
}

// Reset the game
function resetGame() {
  gameState.currentQuestionIndex = 0;
  gameState.score = 0;
  gameState.answered = false;
  gameState.selectedAnswer = null;
  document.getElementById('username').value = '';
  showScreen('welcome');
}

// Helper function to show a specific screen
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.add('hidden'));
  screens[screenName].classList.remove('hidden');
}

// Helper function to shuffle array (Fisher-Yates)
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Seed the database with sample questions
async function seedQuestions() {
  const questions = [
    // Science
    {
      category: 'Science',
      question: 'What is the chemical symbol for gold?',
      correctAnswer: 'Au',
      incorrectAnswers: ['Ag', 'Fe', 'Hg'],
      difficulty: 'easy'
    },
    {
      category: 'Science',
      question: 'Which planet is known as the Red Planet?',
      correctAnswer: 'Mars',
      incorrectAnswers: ['Venus', 'Jupiter', 'Saturn'],
      difficulty: 'easy'
    },
    {
      category: 'Science',
      question: 'What is the largest organ in the human body?',
      correctAnswer: 'Skin',
      incorrectAnswers: ['Liver', 'Heart', 'Brain'],
      difficulty: 'medium'
    },
    
    // History
    {
      category: 'History',
      question: 'In which year did World War II end?',
      correctAnswer: '1945',
      incorrectAnswers: ['1943', '1947', '1939'],
      difficulty: 'easy'
    },
    {
      category: 'History',
      question: 'Who was the first President of the United States?',
      correctAnswer: 'George Washington',
      incorrectAnswers: ['Thomas Jefferson', 'John Adams', 'Abraham Lincoln'],
      difficulty: 'easy'
    },
    
    // Sports
    {
      category: 'Sports',
      question: 'Which country has won the most FIFA World Cup titles?',
      correctAnswer: 'Brazil',
      incorrectAnswers: ['Germany', 'Italy', 'Argentina'],
      difficulty: 'medium'
    },
    {
      category: 'Sports',
      question: 'In which sport would you perform a slam dunk?',
      correctAnswer: 'Basketball',
      incorrectAnswers: ['Volleyball', 'Tennis', 'Soccer'],
      difficulty: 'easy'
    },
    
    // Entertainment
    {
      category: 'Entertainment',
      question: 'Who directed the movie "Inception"?',
      correctAnswer: 'Christopher Nolan',
      incorrectAnswers: ['Steven Spielberg', 'James Cameron', 'Quentin Tarantino'],
      difficulty: 'medium'
    },
    {
      category: 'Entertainment',
      question: 'Which artist released the album "Thriller"?',
      correctAnswer: 'Michael Jackson',
      incorrectAnswers: ['Prince', 'Madonna', 'Whitney Houston'],
      difficulty: 'easy'
    }
  ];
  
  // Add more questions to reach 30-40
  const additionalQuestions = [
    // More Science
    {
      category: 'Science',
      question: 'What is the hardest natural substance on Earth?',
      correctAnswer: 'Diamond',
      incorrectAnswers: ['Gold', 'Iron', 'Quartz'],
      difficulty: 'easy'
    },
    {
      category: 'Science',
      question: 'Which element has the chemical symbol "O"?',
      correctAnswer: 'Oxygen',
      incorrectAnswers: ['Gold', 'Osmium', 'Oganesson'],
      difficulty: 'easy'
    },
    
    // More History
    {
      category: 'History',
      question: 'Who painted the Mona Lisa?',
      correctAnswer: 'Leonardo da Vinci',
      incorrectAnswers: ['Pablo Picasso', 'Vincent van Gogh', 'Michelangelo'],
      difficulty: 'easy'
    },
    {
      category: 'History',
      question: 'Which ancient civilization built the Great Wall?',
      correctAnswer: 'Chinese',
      incorrectAnswers: ['Egyptian', 'Roman', 'Greek'],
      difficulty: 'easy'
    },
    
    // More Sports
    {
      category: 'Sports',
      question: 'How many players are on a standard soccer team?',
      correctAnswer: '11',
      incorrectAnswers: ['9', '10', '12'],
      difficulty: 'easy'
    },
    {
      category: 'Sports',
      question: 'Which country hosted the 2016 Summer Olympics?',
      correctAnswer: 'Brazil',
      incorrectAnswers: ['Japan', 'Russia', 'United Kingdom'],
      difficulty: 'medium'
    },
    
    // More Entertainment
    {
      category: 'Entertainment',
      question: 'Who played Jack Dawson in "Titanic"?',
      correctAnswer: 'Leonardo DiCaprio',
      incorrectAnswers: ['Brad Pitt', 'Matt Damon', 'Johnny Depp'],
      difficulty: 'easy'
    },
    {
      category: 'Entertainment',
      question: 'Which TV series features the character Sheldon Cooper?',
      correctAnswer: 'The Big Bang Theory',
      incorrectAnswers: ['Friends', 'How I Met Your Mother', 'Modern Family'],
      difficulty: 'easy'
    }
  ];
  
  // Add all questions to the database
  await db.transact({
    Question: [...questions, ...additionalQuestions]
  });
}

// Initialize the game when the page loads
window.onload = init;
