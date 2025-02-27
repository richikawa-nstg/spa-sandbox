import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('ゲスト');
  const messagesEndRef = useRef(null);

  // メッセージの読み込みとリアルタイム更新
  useEffect(() => {
    // messagesコレクションへの参照を取得
    const messagesRef = collection(db, 'messages');
    
    // クエリを作成（タイムスタンプでソートして最新の50件を取得）
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    // リアルタイムリスナーを設定
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        const messageData = doc.data();
        messageList.push({
          id: doc.id,
          text: messageData.text,
          sender: messageData.user === username ? 'user' : 'other',
          username: messageData.user,
          timestamp: messageData.timestamp?.toDate() || new Date()
        });
      });
      setMessages(messageList);
    });

    // クリーンアップ関数でリスナーを解除
    return () => unsubscribe();
  }, [username]);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // メッセージ送信処理
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      // Firestoreにメッセージを追加
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        user: username,
        timestamp: serverTimestamp()
      });

      // 入力フィールドをクリア
      setNewMessage('');
    } catch (error) {
      console.error('メッセージの送信中にエラーが発生しました:', error);
    }
  };

  return (
    <div className="row">
      <div className="col-md-12">
        <div className="card">
          <div className="card-header">
            <h2>Firebaseリアルタイムチャット</h2>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label htmlFor="username" className="form-label">ユーザー名</label>
              <input
                type="text"
                className="form-control"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div 
              className="chat-messages p-3 mb-3 bg-light" 
              style={{ height: '400px', overflowY: 'auto' }}
            >
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`mb-2 d-flex ${message.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  <div 
                    className={`p-2 rounded-3 ${
                      message.sender === 'user' 
                        ? 'bg-primary text-white' 
                        : 'bg-light border'
                    }`}
                    style={{ maxWidth: '70%' }}
                  >
                    {message.sender !== 'user' && (
                      <div className="fw-bold small">{message.username}</div>
                    )}
                    <div>{message.text}</div>
                    <div className="text-end small opacity-75">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
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
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  送信
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;