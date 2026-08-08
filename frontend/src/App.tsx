import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ControllerPage } from './pages/ControllerPage';
import { DisplayPage } from './pages/DisplayPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ControllerPage />} />
        <Route path="/display" element={<DisplayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
