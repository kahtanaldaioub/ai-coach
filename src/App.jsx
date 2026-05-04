import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CoachApp from './pages/CoachApp'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CoachApp />} />
        <Route path="/app" element={<CoachApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App