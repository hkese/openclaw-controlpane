import { useState, useEffect } from 'react';
import useGatewayStore from './stores/useGatewayStore';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AddGatewayModal from './components/AddGatewayModal';
import Dashboard from './pages/Dashboard';
import GatewayDetail from './pages/GatewayDetail';
import AgentsPage from './pages/AgentsPage';
import SessionsPage from './pages/SessionsPage';
import TaskBoard from './pages/TaskBoard';
import CronPage from './pages/CronPage';
import StandupPage from './pages/StandupPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const restoreGateways = useGatewayStore(s => s.restoreGateways);

  useEffect(() => {
    restoreGateways();
  }, []);

  const handleNavigate = (page) => setCurrentPage(page);
  const handleSelectGateway = (id) => setCurrentPage(id);
  const handleBack = () => setCurrentPage('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onSelectGateway={handleSelectGateway} onAddGateway={() => setModalOpen(true)} />;
      case 'agents':
        return <AgentsPage />;
      case 'sessions':
        return <SessionsPage />;
      case 'tasks':
        return <TaskBoard />;
      case 'cron':
        return <CronPage />;
      case 'standup':
        return <StandupPage />;
      default:
        // Gateway detail page (id-based)
        return <GatewayDetail gatewayId={currentPage} onBack={handleBack} />;
    }
  };

  return (
    <div className="app-layout">
      <Header onAddGateway={() => setModalOpen(true)} />
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onSelectGateway={handleSelectGateway}
      />
      <main className="app-main">
        {renderPage()}
      </main>
      <AddGatewayModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
