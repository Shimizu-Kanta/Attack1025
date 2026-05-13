import { Navigate, Route, Routes } from 'react-router-dom'
import { GamePage } from './pages/GamePage'
import { ResultPage } from './pages/ResultPage'
import StartPage from './pages/StartPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
