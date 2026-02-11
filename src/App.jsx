import { useState, useEffect } from 'react';
import useGatewayStore from './stores/useGatewayStore';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AddGatewayModal from './components/AddGatewayModal';
import Dashboard from './pages/Dashboard';
import GatewayDetail from './pages/GatewayDetail';

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

  return (
    <div className="app-layout">
      <Header onAddGateway={() => setModalOpen(true)} />
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onSelectGateway={handleSelectGateway}
      />
      <main className="app-main">
        {currentPage === 'dashboard' ? (
          <Dashboard
            onSelectGateway={handleSelectGateway}
            onAddGateway={() => setModalOpen(true)}
          />
        ) : (
          <GatewayDetail
            gatewayId={currentPage}
            onBack={handleBack}
          />
        )}
      </main>
      <AddGatewayModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
