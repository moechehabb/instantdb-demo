"use client";

import { useState, useEffect } from 'react';
import { init, id } from '@instantdb/react';

type GameState = 'welcome' | 'playing' | 'gameOver' | 'leaderboard';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  categoryId: string;
  createdAt: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

interface PlayerScore {
  id: string;
  playerName: string;
  score: number;
  category: string;
  categoryId: string;
  date: string;
  createdAt: number;
}

// Initialize InstantDB outside the component
const db =  init({
      appId: process.env.NEXT_PUBLIC_INSTANTDB_APP_ID!, // InstantDB app ID
    });
 

export default function TriviaGame() {
  // State hooks - must be called unconditionally at the top level
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [playerName, setPlayerName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsAsked, setQuestionsAsked] = useState<string[]>([]);
  
  // Initialize database state
  const [dbInitialized, setDbInitialized] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Initialize query with empty data first
  const [queryState, setQueryState] = useState<{
    data: { categories?: Category[]; questions?: Question[]; leaderboard?: PlayerScore[] } | null;
    isLoading: boolean;
    error: Error | null;
  }>({ data: {
    categories: [
      {
        id: '1',
        name: 'History',
        description: 'Test your knowledge of history',
        createdAt: Date.now(),
      },
      {
        id: '2',
        name: 'Science',
        description: 'Test your knowledge of science',
        createdAt: Date.now(),
      },
      {
        id: '3',
        name: 'Geography',
        description: 'Test your knowledge of Geography',
        createdAt: Date.now(),
      },
      {
        id: '4',
        name: 'Entertainment',
        description: 'Test your knowledge of Entertainment',
        createdAt: Date.now(),
      },
    ],
    questions:[
      // History Questions (Category 1)
      {
        id: '1',
        text: 'What is the capital of France?',
        options: ['Paris', 'London', 'Berlin', 'Madrid'],
        correctAnswer: 'Paris',
        difficulty: 'easy',
        categoryId: '1',
        createdAt: Date.now(),
      },
      {
        id: '2',
        text: 'When did World War II end?',
        options: ['1943', '1944', '1945', '1946'],
        correctAnswer: '1945',
        difficulty: 'medium',
        categoryId: '1',
        createdAt: Date.now(),
      },
      {
        id: '3',
        text: 'Who was the first President of the United States?',
        options: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'],
        correctAnswer: 'George Washington',
        difficulty: 'easy',
        categoryId: '1',
        createdAt: Date.now(),
      },
      // Science Questions (Category 2)
      {
        id: '4',
        text: 'What is the chemical symbol for water?',
        options: ['H2O', 'CO2', 'NaCl', 'O2'],
        correctAnswer: 'H2O',
        difficulty: 'easy',
        categoryId: '2',
        createdAt: Date.now(),
      },
      {
        id: '5',
        text: 'What is the closest planet to the sun?',
        options: ['Venus', 'Mars', 'Mercury', 'Earth'],
        correctAnswer: 'Mercury',
        difficulty: 'easy',
        categoryId: '2',
        createdAt: Date.now(),
      },
      {
        id: '6',
        text: 'What is the powerhouse of the cell?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus'],
        correctAnswer: 'Mitochondria',
        difficulty: 'medium',
        categoryId: '2',
        createdAt: Date.now(),
      },
      // Geography Questions (Category 3)
      {
        id: '7',
        text: 'Which is the longest river in the world?',
        options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'],
        correctAnswer: 'Nile',
        difficulty: 'medium',
        categoryId: '3',
        createdAt: Date.now(),
      },
      {
        id: '8',
        text: 'What is the largest continent by land area?',
        options: ['Africa', 'North America', 'Asia', 'Antarctica'],
        correctAnswer: 'Asia',
        difficulty: 'easy',
        categoryId: '3',
        createdAt: Date.now(),
      },
      {
        id: '9',
        text: 'In which country would you find the Great Barrier Reef?',
        options: ['Brazil', 'Australia', 'Thailand', 'Mexico'],
        correctAnswer: 'Australia',
        difficulty: 'medium',
        categoryId: '3',
        createdAt: Date.now(),
      },
      // Entertainment Questions (Category 4)
      {
        id: '10',
        text: 'Who played the character Jack Dawson in Titanic?',
        options: ['Brad Pitt', 'Leonardo DiCaprio', 'Johnny Depp', 'Matt Damon'],
        correctAnswer: 'Leonardo DiCaprio',
        difficulty: 'easy',
        categoryId: '4',
        createdAt: Date.now(),
      },
      {
        id: '11',
        text: 'Which band performed the song "Bohemian Rhapsody"?',
        options: ['The Beatles', 'Pink Floyd', 'Queen', 'Led Zeppelin'],
        correctAnswer: 'Queen',
        difficulty: 'medium',
        categoryId: '4',
        createdAt: Date.now(),
      },
      {
        id: '12',
        text: 'Which movie won the Academy Award for Best Picture in 2020?',
        options: ['Parasite', '1917', 'Joker', 'The Irishman'],
        correctAnswer: 'Parasite',
        difficulty: 'hard',
        categoryId: '4',
        createdAt: Date.now(),
      },
    ],
    leaderboard: [
     
    ]
  }, isLoading: true, error: null });

  // Use InstantDB's useQuery hook - called unconditionally
  const query = db.useQuery({
    categories: { $: { limit: 10 } },
    questions: { $: { limit: 100 } },
    leaderboard: { $: { limit: 100 } } // Get all scores, we'll sort client-side
  });

 

  // Update queryState when query data changes
  useEffect(() => {
    if (query.data && query.data.leaderboard) {
      // Ensure each item in leaderboard matches PlayerScore type
      const leaderboardData = query.data.leaderboard.map(item => ({
        id: item.id,
        playerName: item.playerName || 'Anonymous',
        score: Number(item.score) || 0,
        category: item.category || 'General',
        categoryId: item.categoryId || '',
        date: item.date || new Date().toISOString().split('T')[0],
        createdAt: item.createdAt || Date.now()
      } as PlayerScore));
  
      setQueryState(prev => ({
        ...prev,
        data: {
          ...(prev.data || {}),
          leaderboard: leaderboardData
        },
        isLoading: query.isLoading,
        error: query.error || null
      }));
    }
  }, [query.data, query.isLoading, query.error]);
  // Handle database errors
  if (dbError || query.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-red-100 rounded-lg">
          <h2 className="text-2xl font-bold text-red-700 mb-4">Connection Error</h2>
          <p className="mb-4">{dbError || 'Failed to connect to the game server. Please check your internet connection.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract data with fallbacks
  const categories = queryState?.data?.categories || [];
  const questions = queryState?.data?.questions || [];
  const leaderboard = queryState?.data?.leaderboard || [];

  // Show error if no database connection
  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-red-100 rounded-lg">
          <h2 className="text-2xl font-bold text-red-700 mb-4">Connection Error</h2>
          <p className="mb-4">Failed to connect to the game server. Please check your internet connection and refresh the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
     

  const startGame = (category: Category) => {
    if (!queryState.data) {
      console.log('Data is still loading or not available');
      return;
    }
  
    console.log('Starting game with category:', category);
    
    // Get the latest questions from the query data
    const latestQuestions = queryState.data.questions || [];
    console.log('Latest questions from query:', latestQuestions);
    
    // Convert both IDs to strings for comparison to ensure type consistency
    const categoryId = String(category.id);
    
    const categoryQuestions = latestQuestions.filter((q: Question) => {
      const questionCategoryId = String(q.categoryId);
      const match = questionCategoryId === categoryId;
      console.log(`Question ${q.id} has categoryId:`, q.categoryId, 'Type:', typeof q.categoryId, 'Match:', match);
      return match;
    });
    
    console.log('Found questions for category:', categoryQuestions);
    
    if (categoryQuestions.length === 0) {
      const errorMsg = `No questions found for category "${category.name}" (ID: ${categoryId}). Please try another category.`;
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }
    
    setSelectedCategory(category);
    setGameState('playing');
    setScore(0);
    setQuestionNumber(0);
    setCurrentQuestion(categoryQuestions[0]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setQuestionsAsked([categoryQuestions[0].id]);
  };
  const loadNextQuestion = () => {
    if (!selectedCategory) return;
    
    const categoryId = String(selectedCategory.id);
    const categoryQuestions = questions.filter((q: Question) => 
      String(q.categoryId) === categoryId
    );
    
    if (categoryQuestions.length === 0) {
      endGame(0);
      return;
    }
    
    // Rest of the function remains the same
    const availableQuestions = categoryQuestions.filter(q => 
      !questionsAsked.includes(q.id)
    );
    
    let nextQuestion;
    
    if (availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      nextQuestion = availableQuestions[randomIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
      nextQuestion = categoryQuestions[randomIndex];
    }
    
    setCurrentQuestion(nextQuestion);
    setQuestionsAsked(prev => [...prev, nextQuestion.id]);
    setSelectedAnswer(null);
    setShowFeedback(false);
  };
  const handleAnswerSelect = async (answer: string) => {
    if (showFeedback || !currentQuestion) return; // Prevent multiple selections
    
    setSelectedAnswer(answer);
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowFeedback(true);
    
    let newScore = score;
    if (correct) {
      newScore = score + 10;
      setScore(newScore);
    }

    // Move to next question after a delay
    const nextQuestionNumber = questionNumber + 1;
    if (nextQuestionNumber >= 3) { // 10 questions per game
      // Use a timeout to ensure we're not in the render phase when calling endGame
      setTimeout(() => endGame(newScore), 0);
    } else {
      setTimeout(() => {
        setQuestionNumber(nextQuestionNumber);
        loadNextQuestion();
      }, 1000);
    }
  };

  const endGame = async (score: number) => {
    // Update the game state first
    setGameState('gameOver');
    
    // Save score to leaderboard after state update
    if (playerName && selectedCategory) {
      console.log('saving')
      try {
        await db.transact([
          db.tx.leaderboard[id()].update({
            playerName,
            score,
            category: selectedCategory.name,
            categoryId: selectedCategory.id,
            date: new Date().toISOString(),
            createdAt: Date.now(),
          }),
        ]);
        console.log(await db.queryOnce({
          leaderboard: { $: { limit: 100 } },
        }));
      } catch (error) {
        console.error('Error saving score:', error);
        // Consider showing this error to the user in the UI
      }
    }
  };

  const resetGame = () => {
    setGameState('welcome');
    setSelectedCategory(null);
    setQuestionsAsked([]);
    setCurrentQuestion(null);
    setScore(0);
    setQuestionNumber(0);
  };

  const renderWelcomeScreen = () => {
    if (isLoadingData) {
      return (
        <div className="text-center">
          <p className="text-lg">Loading game data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      );
    }



    return (
      <div className="mx-auto max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Trivia Challenge</h1>
          <p className="text-muted-foreground">Test your knowledge across various categories</p>
        </div>
        
        <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <div className="space-y-2">
            <label htmlFor="playerName" className="text-sm font-medium leading-none">
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          
          <div className="space-y-3">
            <p className="text-sm font-medium leading-none">Select a category:</p>
            <div className="grid gap-3">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => startGame(category)}
                    disabled={!playerName.trim()}
                    className="flex flex-col items-start rounded-lg border p-4 text-left transition-all hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <h3 className="font-semibold leading-none tracking-tight">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </button>
                ))
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No categories available. Please try refreshing the page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setGameState('leaderboard')}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View Leaderboard →
        </button>
      </div>
    );
  };

  const renderGameScreen = () => {
    if (!currentQuestion) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading question...</p>
          <button
            onClick={() => setGameState('welcome')}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ← Back to Menu
          </button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card rounded-lg border">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{selectedCategory?.name}</h2>
            <p className="text-sm text-muted-foreground">
              Question {questionNumber + 1} of 3
            </p>
          </div>
          <div className="px-4 py-2 bg-primary/10 text-primary rounded-md font-medium">
            Score: {score}/30
          </div>
        </div>

        <div className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">
            {currentQuestion.text}
          </h2>
          
          <div className="space-y-3">
            {Array.isArray(currentQuestion.options) ? (
              currentQuestion.options.map((option: string, index: number) => {
                const isSelected = option === selectedAnswer;
                const isRightAnswer = option === currentQuestion.correctAnswer;
                const showResult = showFeedback && (isSelected || isRightAnswer);
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={showFeedback}
                    className={`flex w-full items-center rounded-md border p-4 text-left transition-all ${
                      showResult
                        ? isRightAnswer
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : isSelected
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                            : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                        : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                    } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border mr-3 text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                    {showResult && (
                      <span className="ml-auto">
                        {isRightAnswer ? '✓' : isSelected ? '✗' : ''}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                <p>Error: No options available for this question.</p>
              </div>
            )}
          </div>
        </div>

        {showFeedback && (
          <div 
            className={`p-4 rounded-lg border ${
              isCorrect 
                ? 'border-green-500/20 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'border-destructive/20 bg-destructive/10 text-destructive dark:text-destructive-foreground'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {isCorrect ? (
                  <span className="h-5 w-5 text-green-500">✓</span>
                ) : (
                  <span className="h-5 w-5 text-destructive">✗</span>
                )}
              </div>
              <div className="ml-3">
                <p className="font-medium">
                  {isCorrect 
                    ? 'Correct! Well done!' 
                    : `Incorrect! The correct answer is: ${currentQuestion.correctAnswer}`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setGameState('welcome')}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Menu
          </button>
          <div className="text-sm text-muted-foreground">
            {questionNumber + 1} of 3 • {score} points
          </div>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    const isPerfectScore = score === 30;
    
    return (
      <div className="w-full max-w-2xl mx-auto space-y-8 text-center">
        <div className="space-y-4">
          {isPerfectScore ? (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mx-auto">
                <span className="text-4xl">🏆</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                Perfect Score!
              </h2>
              <div className="text-2xl font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 py-3 px-6 rounded-lg inline-block">
                {score}/30 - Flawless Victory!
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                <span className="text-3xl">🎯</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Game Over!</h2>
              <div className="text-2xl font-semibold">
                Your score: <span className="text-primary">{score}/30</span>
              </div>
            </div>
          )}
        </div>
        
        {isPerfectScore && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg border border-yellow-100 dark:border-yellow-900/30 max-w-md mx-auto">
            <p className="font-medium">Amazing job! You got every question right! 🎯</p>
            <p className="mt-1 text-sm">Can you do it again in another category?</p>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive dark:text-destructive-foreground rounded-lg border border-destructive/20">
            <p>{error}</p>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <button
            onClick={() => selectedCategory && startGame(selectedCategory)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
          >
            {isPerfectScore ? 'Play Again' : 'Try Again'}
          </button>
          <button
            onClick={resetGame}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6 py-2"
          >
            Main Menu
          </button>
        </div>
        
        {isPerfectScore && (
          <div className="pt-4">
            <button
              onClick={() => setGameState('leaderboard')}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline inline-flex items-center"
            >
              View Your Place on the Leaderboard →
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (isLoadingData) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Leaderboard</h2>
          <p className="text-muted-foreground">
            Top scores across all categories
          </p>
        </div>
        
        {leaderboard.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No scores yet. Be the first to play!</p>
            <button
              onClick={() => setGameState('welcome')}
              className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Play Now
            </button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 w-[80px]">
                      Rank
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                      Player
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 hidden md:table-cell">
                      Category
                    </th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {leaderboard.map((entry, index) => (
                    <tr 
                      key={entry.id}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <td className="p-4 align-middle font-medium [&:has([role=checkbox])]:pr-0">
                        <div className="flex items-center space-x-2">
                          {index === 0 && <span className="text-yellow-500">🥇</span>}
                          {index === 1 && <span className="text-gray-400">🥈</span>}
                          {index === 2 && <span className="text-amber-700">🥉</span>}
                          <span className={index < 3 ? 'font-bold' : ''}>
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                        {entry.playerName || 'Anonymous'}
                      </td>
                      <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-muted-foreground hidden md:table-cell">
                        {entry.category || 'General'}
                      </td>
                      <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-right font-mono font-medium">
                        {entry.score}
                        <span className="text-muted-foreground text-xs">/30</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setGameState('welcome')}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6 py-2"
          >
            ← Back to Menu
          </button>
        </div>
        
        {leaderboard.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {Math.min(leaderboard.length, 20)} of {leaderboard.length} scores
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <main className="space-y-8">
          {gameState === 'welcome' && renderWelcomeScreen()}
          {gameState === 'playing' && renderGameScreen()}
          {gameState === 'gameOver' && renderGameOver()}
          {gameState === 'leaderboard' && renderLeaderboard()}
        </main>
      </div>
    </div>
  );
}
