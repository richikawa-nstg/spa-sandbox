import React, { useState } from 'react';

function ChatPage() {
  const [messages, setMessages] = useState([
    { id: 1, text: 'こんにちは！チャットルームへようこそ！', sender: 'system' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;
    
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'user'
    };
    
    setMessages([...messages, message]);
    setNewMessage('');
    
    // システムからの自動応答（デモ用）
    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        text: `「${newMessage}」についてのお返事です。`,
        sender: 'system'
      };
      setMessages(prev => [...prev, reply]);
    }, 1000);
  };

  return (
    <div className="row">
      <div className="col-md-12">
        <div className="card">
          <div className="card-header">
            <h2>チャットルーム</h2>
          </div>
          <div className="card-body">
            <div 
              className="chat-messages p-3 mb-3 bg-light" 
              style={{ height: '400px', overflowY: 'auto' }}
            >
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`mb-2 d-flex ${message.sender === 'user' ? 'justify-content-end' : ''}`}
                >
                  <div 
                    className={`p-2 rounded-3 ${
                      message.sender === 'user' 
                        ? 'bg-primary text-white' 
                        : 'bg-secondary text-white'
                    }`}
                    style={{ maxWidth: '70%' }}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage}>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="メッセージを入力..."
                />
                <button type="submit" className="btn btn-primary">送信</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
