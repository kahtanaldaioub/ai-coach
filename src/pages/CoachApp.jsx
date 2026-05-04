import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import ChessgroundBoard from '../components/ChessgroundBoard'
import { 
  Crown, Clock, Target, BookOpen, Loader2, Download, Settings, 
  Sparkles, Award, Brain, Search, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2
} from 'lucide-react'

export default function CoachApp() {
  const navigate = useNavigate()
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  
  const [lichessUsername, setLichessUsername] = useState('')
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [loadingGames, setLoadingGames] = useState(false)
  const [gamesError, setGamesError] = useState(null)
  
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  
  // Chess state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [moveHistory, setMoveHistory] = useState([])
  const [gamePositions, setGamePositions] = useState([])
  const [playerColor, setPlayerColor] = useState(null)
  const [boardOrientation, setBoardOrientation] = useState('white')
  
  // Cloud eval state
  const [engineEvals, setEngineEvals] = useState({})
  const [loadingEval, setLoadingEval] = useState(false)
  
  // Fetch games (same as before)
  const fetchUserGames = async () => {
    if (!lichessUsername.trim()) {
      setGamesError('Please enter a Lichess username')
      return
    }
    setLoadingGames(true)
    setGamesError(null)
    setGames([])
    setSelectedGame(null)
    setAnalysis(null)
    setEngineEvals({})
    
    try {
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/'
      const targetUrl = `https://lichess.org/api/games/user/${encodeURIComponent(lichessUsername)}?pgnInJson=1&max=5`
      
      let response = await fetch(proxyUrl + targetUrl, {
        headers: { 'Accept': 'application/x-ndjson' }
      })
      
      if (!response.ok) {
        console.warn('Proxy failed, trying direct fetch...')
        response = await fetch(targetUrl, {
          headers: { 'Accept': 'application/x-ndjson' }
        })
      }
      
      if (!response.ok) {
        if (response.status === 404) throw new Error('User not found')
        throw new Error(`Lichess API error: ${response.status}`)
      }
      
      const text = await response.text()
      const lines = text.split('\n').filter(line => line.trim() !== '')
      const gamesData = []
      for (const line of lines) {
        try {
          const game = JSON.parse(line)
          gamesData.push(game)
        } catch (e) {}
      }
      
      if (gamesData.length === 0) {
        setGamesError('No games found for this user')
      } else {
        const finishedGames = gamesData.filter(game => 
          game.status === 'mate' || game.status === 'resign' || 
          game.status === 'outoftime' || game.status === 'draw'
        )
        if (finishedGames.length === 0) {
          setGamesError('No finished games found')
        } else {
          setGames(finishedGames)
        }
      }
    } catch (err) {
      console.error(err)
      setGamesError(err.message || 'Failed to fetch games')
    } finally {
      setLoadingGames(false)
    }
  }
  
  // Parse selected game PGN
  useEffect(() => {
    if (!selectedGame) return
    
    const chess = new Chess()
    chess.loadPgn(selectedGame.pgn)
    const moves = chess.history({ verbose: true })
    const positions = [chess.fen()]
    
    const tempChess = new Chess()
    positions[0] = tempChess.fen()
    const moveList = []
    for (let i = 0; i < moves.length; i++) {
      tempChess.move(moves[i].san)
      positions.push(tempChess.fen())
      const moveNumber = Math.floor(i / 2) + 1
      if (i % 2 === 0) {
        moveList.push({ number: moveNumber, white: moves[i].san, black: null })
      } else {
        moveList[moveList.length - 1].black = moves[i].san
      }
    }
    
    setMoveHistory(moveList)
    setGamePositions(positions)
    setCurrentMoveIndex(0)
    setAnalysis(null)
    setEngineEvals({})
    
    // Determine student's color
    const whiteName = selectedGame.players.white?.user?.name?.toLowerCase()
    const blackName = selectedGame.players.black?.user?.name?.toLowerCase()
    const inputName = lichessUsername.toLowerCase()
    if (whiteName === inputName) {
      setPlayerColor('white')
      setBoardOrientation('white')
    } else if (blackName === inputName) {
      setPlayerColor('black')
      setBoardOrientation('black')
    } else {
      setPlayerColor(null)
    }
  }, [selectedGame, lichessUsername])
  
  // Helper: call cloud eval for a single FEN
  const fetchCloudEval = async (fen) => {
    if (!fen) return null;
    // Check daily limit (30 per day)
    const today = new Date().toDateString();
    const stored = localStorage.getItem('lichess_cloud_usage');
    let count = 0;
    let lastDate = '';
    if (stored) {
      const { date, count: c } = JSON.parse(stored);
      if (date === today) count = c;
      else count = 0;
    }
    if (count >= 30) {
      setAnalysisError('Daily Lichess Cloud limit (30) reached. Cannot evaluate more positions today.');
      return null;
    }
    try {
      const proxyUrl = import.meta.env.DEV 
        ? `/api/lichess-cloud?fen=${encodeURIComponent(fen)}`
        : `https://your-vercel-app.vercel.app/api/lichess-cloud?fen=${encodeURIComponent(fen)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      if (data.pvs && data.pvs.length) {
        localStorage.setItem('lichess_cloud_usage', JSON.stringify({ date: today, count: count + 1 }));
        return data;
      }
      return null;
    } catch (err) {
      console.warn('Cloud eval error', err);
      return null;
    }
  };
  
  // When a move index changes, fetch eval for that position (optional)
  useEffect(() => {
    const fen = gamePositions[currentMoveIndex];
    if (fen && fen.split(' ').length === 6 && !engineEvals[fen]) {
      fetchCloudEval(fen).then(data => {
        if (data) {
          setEngineEvals(prev => ({ ...prev, [fen]: data }));
        }
      });
    }
  }, [currentMoveIndex, gamePositions]);
  
  const goToPreviousMove = () => {
    if (currentMoveIndex > 0) setCurrentMoveIndex(currentMoveIndex - 1)
  }
  const goToNextMove = () => {
    if (currentMoveIndex < gamePositions.length - 1) setCurrentMoveIndex(currentMoveIndex + 1)
  }
  const goToStart = () => setCurrentMoveIndex(0)
  const goToEnd = () => setCurrentMoveIndex(gamePositions.length - 1)
  
  // Generate AI coaching report using aggregated engine evals
  const generateAnalysis = async () => {
    if (!selectedGame) return;
    setAnalyzing(true);
    setAnalysisError(null);
    
    const positionsToEval = [];
    const totalMoves = gamePositions.length;
    positionsToEval.push(gamePositions[0]);
    positionsToEval.push(gamePositions[totalMoves - 1]);
    for (let i = 1; i < totalMoves - 1; i += Math.max(1, Math.floor(totalMoves / 10))) {
      if (positionsToEval.length < 25) positionsToEval.push(gamePositions[i]);
    }
    const uniqueFens = [...new Set(positionsToEval)];
    
    setLoadingEval(true);
    const evalsData = [];
    for (const fen of uniqueFens) {
      const data = await fetchCloudEval(fen);
      if (data) {
        evalsData.push({
          fen,
          bestMove: data.pvs[0].moves,
          cp: data.pvs[0].cp,
          mate: data.pvs[0].mate
        });
      }
    }
    setLoadingEval(false);
    
    const white = selectedGame.players.white?.user?.name || 'White';
    const black = selectedGame.players.black?.user?.name || 'Black';
    const result = selectedGame.winner ? (selectedGame.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2';
    const studentSide = playerColor === 'white' ? 'White' : (playerColor === 'black' ? 'Black' : 'Unknown');
    
    const engineSummary = evalsData.map(e => {
      const evalText = e.mate ? `Forced checkmate in ${Math.abs(e.mate)} moves` : `Evaluation: ${(e.cp / 100).toFixed(2)} pawns advantage for White`;
      return `Position FEN: ${e.fen}\nStockfish says: ${evalText}, Best move: ${e.bestMove}`;
    }).join('\n\n');
    
    const systemPrompt = `You are ChessCraft, an expert chess coach. The student (${lichessUsername}) played as ${studentSide}. I will provide you with Stockfish evaluations of several positions from their game. Using these real engine evaluations, produce a coaching report. Return ONLY valid JSON with this structure:

{
  "goodMoves": [
    { "comment": "Move 10. Nc3 was good because ...", "moveNumber": 10 }
  ],
  "mistakes": [
    { "comment": "Move 15. Bxf2+ blunders a bishop because ...", "moveNumber": 15 }
  ],
  "keyLesson": "One sentence summarizing the main takeaway",
  "homework": "Specific advice"
}

Base your comments strictly on the engine evaluations provided. Explain why each mistake is bad (e.g., loses 2 pawns) and why good moves are good.`;
    
    const userPrompt = `Game: ${white} (White) vs ${black} (Black), Result: ${result}\nStudent side: ${studentSide}\n\nEngine evaluations for key positions:\n${engineSummary}\n\nGame PGN:\n${selectedGame.pgn}`;
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.7,
          max_tokens: 2048
        })
      });
      if (!response.ok) throw new Error((await response.json()).error?.message || 'Analysis failed');
      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      setAnalysis(JSON.parse(jsonMatch[0]));
    } catch (err) {
      console.error(err);
      setAnalysisError(err.message || 'Failed to generate analysis');
    } finally {
      setAnalyzing(false);
    }
  };
  
  const downloadAnalysis = () => {
    if (!analysis) return;
    const content = `# Chess Coaching Report

## Game Information
${selectedGame.players.white?.user?.name || 'White'} vs ${selectedGame.players.black?.user?.name || 'Black'}
Result: ${selectedGame.winner ? (selectedGame.winner === 'white' ? 'White won' : 'Black won') : 'Draw'}
Date: ${new Date(selectedGame.createdAt).toLocaleDateString()}
Student: ${lichessUsername} (playing as ${playerColor === 'white' ? 'White' : (playerColor === 'black' ? 'Black' : 'Unknown')})

## Key Good Moves (based on Stockfish)
${analysis.goodMoves?.map(m => `- Move ${m.moveNumber}: ${m.comment}`).join('\n') || 'None'}

## Mistakes to Learn From (based on Stockfish)
${analysis.mistakes?.map(m => `- Move ${m.moveNumber}: ${m.comment}`).join('\n') || 'None'}

## Key Lesson
${analysis.keyLesson}

## Homework
${analysis.homework}
`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coaching_report_${selectedGame.createdAt}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const formatResult = (game) => {
    if (game.winner === 'white') return 'White won';
    if (game.winner === 'black') return 'Black won';
    return 'Draw';
  };
  
  const getCurrentDisplayMove = () => {
    if (moveHistory.length === 0) return '';
    const moveNumber = Math.floor(currentMoveIndex / 2) + 1;
    const isWhiteMove = currentMoveIndex % 2 === 0;
    const currentMove = moveHistory[moveNumber - 1];
    if (!currentMove) return '';
    if (isWhiteMove) {
      return `${moveNumber}. ${currentMove.white}`;
    } else {
      return `${moveNumber}. ${currentMove.white} ${currentMove.black}`;
    }
  };
  
  const currentFen = (gamePositions[currentMoveIndex] && gamePositions[currentMoveIndex].split(' ').length === 6) 
    ? gamePositions[currentMoveIndex] 
    : 'start';
  
  const currentEval = engineEvals[currentFen];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-center mb-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-stone-800/80 rounded-full px-4 py-2 border border-stone-700">
              <Crown className="w-5 h-5 text-amber-500" />
              <span className="text-amber-400 text-sm font-medium">ChessCraft Coach</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-stone-400 bg-clip-text text-transparent mt-2">
              Engine-Powered Analyzer
            </h1>
            <p className="text-stone-400 text-sm">Real Stockfish evaluations + AI explanations</p>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left panel – game selection */}
          <div className="bg-stone-800/60 backdrop-blur-sm rounded-2xl border border-stone-700 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-stone-200">1. Fetch Games</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Your Lichess Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lichessUsername}
                    onChange={(e) => setLichessUsername(e.target.value)}
                    placeholder="e.g., magnus"
                    className="flex-1 px-4 py-2 bg-stone-900 border border-stone-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-stone-200"
                    onKeyDown={(e) => e.key === 'Enter' && fetchUserGames()}
                  />
                  <button
                    onClick={fetchUserGames}
                    disabled={loadingGames}
                    className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800/50 text-stone-900 font-semibold px-4 rounded-xl"
                  >
                    {loadingGames ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
                {gamesError && <p className="text-red-400 text-sm mt-2">{gamesError}</p>}
              </div>
              
              {games.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-2">Your Recent Games ({games.length})</label>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {games.map((game, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGame(game)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          selectedGame === game
                            ? 'bg-amber-600/20 border border-amber-500'
                            : 'bg-stone-900/50 border border-stone-700 hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-200 font-mono">
                            {game.players.white?.user?.name || '?'} vs {game.players.black?.user?.name || '?'}
                          </span>
                          <span className="text-amber-400">{formatResult(game)}</span>
                        </div>
                        <div className="text-xs text-stone-400 mt-1">
                          {new Date(game.createdAt).toLocaleDateString()} • {game.speed || '?'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedGame && (
                <div className="mt-6 pt-4 border-t border-stone-700">
                  <button
                    onClick={generateAnalysis}
                    disabled={analyzing || loadingEval}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800/50 text-stone-900 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    {analyzing || loadingEval ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</> : <><Sparkles className="w-5 h-5" /> Generate Coaching Report (with Stockfish)</>}
                  </button>
                  {analysisError && <p className="text-red-400 text-sm mt-2">{analysisError}</p>}
                </div>
              )}
            </div>
          </div>
          
          {/* Right panel – AI analysis */}
          <div className="bg-stone-800/60 backdrop-blur-sm rounded-2xl border border-stone-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-stone-200">2. Coaching Report</h2>
              </div>
              {analysis && (
                <button onClick={downloadAnalysis} className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
            
            {!analysis && !analyzing && selectedGame && (
              <div className="text-center py-8 text-stone-500">
                <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Click "Generate Coaching Report" to analyze with Stockfish</p>
                {playerColor && <p className="text-xs mt-2 text-amber-400/70">Your side: {playerColor === 'white' ? 'White' : 'Black'}</p>}
              </div>
            )}
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                <p className="text-stone-400">Stockfish is evaluating key positions...</p>
              </div>
            )}
            {analysis && !analyzing && (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                <div>
                  <h3 className="text-amber-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Good Moves</h3>
                  <ul className="list-disc list-inside text-stone-300 text-sm mt-1">
                    {analysis.goodMoves?.length > 0 ? (
                      analysis.goodMoves.map((m, i) => <li key={i}><span className="text-amber-400">Move {m.moveNumber}:</span> {m.comment}</li>)
                    ) : <li>None identified</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-red-400 font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Mistakes</h3>
                  <ul className="list-disc list-inside text-stone-300 text-sm mt-1">
                    {analysis.mistakes?.length > 0 ? (
                      analysis.mistakes.map((m, i) => <li key={i}><span className="text-red-400">Move {m.moveNumber}:</span> {m.comment}</li>)
                    ) : <li>None detected</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-amber-400 font-semibold">🎯 Key Lesson</h3>
                  <p className="text-stone-300 text-sm mt-1">{analysis.keyLesson}</p>
                </div>
                <div>
                  <h3 className="text-amber-400 font-semibold">📚 Homework</h3>
                  <p className="text-stone-300 text-sm mt-1">{analysis.homework}</p>
                </div>
              </div>
            )}
            {!selectedGame && (
              <div className="text-center py-12 text-stone-500">
                <Crown className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Fetch a user and select a game</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Board Section */}
        {selectedGame && (
          <div className="mt-8 bg-stone-800/60 backdrop-blur-sm rounded-2xl border border-stone-700 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-stone-200">3. Interactive Board with Stockfish</h2>
            </div>
            <div className="flex flex-col items-center">
              <ChessgroundBoard 
                fen={currentFen}
                orientation={boardOrientation}
              />
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={goToStart} className="p-2 bg-stone-700 rounded-lg hover:bg-stone-600 transition">
                  <ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-2" />
                </button>
                <button onClick={goToPreviousMove} className="p-2 bg-stone-700 rounded-lg hover:bg-stone-600 transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-stone-300 text-sm px-3 py-2">
                  {getCurrentDisplayMove() || `Position ${currentMoveIndex} / ${gamePositions.length - 1}`}
                </span>
                <button onClick={goToNextMove} className="p-2 bg-stone-700 rounded-lg hover:bg-stone-600 transition">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={goToEnd} className="p-2 bg-stone-700 rounded-lg hover:bg-stone-600 transition">
                  <ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-2" />
                </button>
              </div>
              {currentEval && (
                <div className="mt-2 p-2 bg-stone-900/70 rounded-lg text-xs text-stone-300">
                  <span className="text-amber-400 font-medium">Stockfish:</span> 
                  {' '}{currentEval.pvs[0].mate ? `${currentEval.pvs[0].mate > 0 ? 'Mate in' : 'Mated in'} ${Math.abs(currentEval.pvs[0].mate)}` : `${(currentEval.pvs[0].cp / 100).toFixed(2)} pawns advantage for White`}
                  {' '}• Best move: {currentEval.pvs[0].moves}
                </div>
              )}
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
                  className="px-3 py-1 bg-stone-700 hover:bg-stone-600 rounded-lg text-xs text-stone-300 transition"
                >
                  Flip Board
                </button>
                {playerColor && (
                  <span className="text-xs text-stone-400">
                    Analyzing your moves as <span className="text-amber-400 font-medium">{playerColor === 'white' ? 'White' : 'Black'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        <footer className="text-center mt-12 text-sm text-stone-600">
          ChessCraft Coach • Stockfish evaluations via Lichess Cloud • AI explains based on real engine data
        </footer>
      </div>
    </div>
  )
}