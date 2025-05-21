import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();
  
  return (
    <header className="pb-3 mb-4 border-bottom">
      <div className="d-flex align-items-center text-dark text-decoration-none">
        <span className="fs-4">React SPA デモ</span>
        <nav className="ms-auto">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <Link 
                to="/login" 
                className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
              >
                ログイン
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/chat" 
                className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
              >
                チャット
              </Link>
            </li>
         </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;
