import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../firebase';
import { 
  doc,
  setDoc,
  collection, 
  query, 
  orderBy, 
  where, 
  serverTimestamp, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';

// Leafletのデフォルトアイコンの問題を修正
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 現在位置を中心に地図を表示するコンポーネント
function LocateMe() {
  const map = useMap();
  
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16 });
  }, [map]);
  
  return null;
}

function MapPage() {
  // 東京の初期位置
  const [center, setCenter] = useState([35.6546, 139.6935]);
  const [username, setUsername] = useState('ゲスト');
  const [locations, setLocations] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [locationError, setLocationError] = useState(false);
  
  // ユーザーの現在位置を取得
  const getUserLocation = useCallback(() => {
    setStatus('位置情報を取得中...');
    if (!navigator.geolocation) {
      setStatus('お使いのブラウザは位置情報をサポートしていません。');
      setLocationError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setCenter([latitude, longitude]);
        setStatus('現在位置を取得しました！');
        setLocationError(false);
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error);
        setStatus('位置情報の取得に失敗しました: ' + error.message);
        setLocationError(true);
      }
    );
  }, []);

  // 位置情報を共有（ユーザーごとに1つのドキュメント）
  const shareLocation = useCallback(async () => {
    if (!userLocation) return;
    
    try {
      console.log(`位置情報をFirebaseに保存/更新: ${username}, [${userLocation[0]}, ${userLocation[1]}]`);
      
      // ユーザー名をドキュメントIDとして使用
      const userDocRef = doc(db, 'userLocations', username);
      
      // ドキュメントを設定/更新
      await setDoc(userDocRef, {
        user: username,
        latitude: userLocation[0],
        longitude: userLocation[1],
        timestamp: serverTimestamp()
      });
      
      setStatus(`位置情報を共有しました！ [${new Date().toLocaleTimeString()}]`);
    } catch (error) {
      console.error('位置情報の共有に失敗しました:', error);
      setStatus('位置情報の共有に失敗しました: ' + error.message);
    }
  }, [userLocation, username]);

  // 位置情報の共有を開始/停止
  const toggleLocationSharing = useCallback(() => {
    if (sharingEnabled) {
      setSharingEnabled(false);
      setStatus('位置情報の共有を停止しました。');
    } else {
      if (!userLocation) {
        getUserLocation();
      }
      setSharingEnabled(true);
      setStatus('位置情報の共有を開始しました！');
    }
  }, [sharingEnabled, userLocation, getUserLocation]);

  // 初回レンダリング時に位置情報を取得
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // 定期的に位置情報を共有（共有が有効な場合）
  useEffect(() => {
    if (!sharingEnabled) return;
    
    // 初回共有
    if (userLocation) {
      shareLocation();
    }
    
    // 5秒ごとに位置情報を更新
    const interval = setInterval(() => {
      getUserLocation();
      if (userLocation && !locationError) {
        shareLocation();
      }
    }, 5 * 1000); // 5秒
    
    return () => clearInterval(interval);
  }, [sharingEnabled, userLocation, shareLocation, getUserLocation, locationError]);

  // 1時間以内の位置情報を読み込み
  useEffect(() => {
    // 1時間前のタイムスタンプを計算
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    try {
      // userLocationsコレクションの参照を取得
      const locationsRef = collection(db, 'userLocations');
      
      // 1時間以内のデータをクエリ
      const q = query(
        locationsRef,
        where('timestamp', '>', Timestamp.fromDate(oneHourAgo))
      );
      
      console.log('Firebase位置情報のリスニングを開始');
      
      // リアルタイムリスナーを設定
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const locationList = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            // Firestoreから取得したタイムスタンプをDateオブジェクトに変換
            const timestamp = data.timestamp?.toDate() || new Date();
            
            locationList.push({
              id: doc.id,
              username: data.user,
              position: [data.latitude, data.longitude],
              timestamp: timestamp
            });
          });
          
          console.log(`${locationList.length}人のユーザーの位置情報を取得`);
          setLocations(locationList);
        },
        (error) => {
          console.error('位置情報の取得に失敗しました:', error);
          setStatus('位置情報のリアルタイム取得に失敗しました。再試行してください。');
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('位置情報のリスナー設定に失敗しました:', error);
      setStatus('位置情報のリスナー設定に失敗しました: ' + error.message);
    }
  }, []);

  return (
    <div className="row">
      <div className="col-md-12">
        <div className="card">
          <div className="card-header">
            <h2>リアルタイム位置情報</h2>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label htmlFor="username" className="form-label">ユーザー名</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={getUserLocation}
                >
                  現在位置を取得
                </button>
              </div>
            </div>

            <div className="mb-3">
              <button 
                className={`btn ${sharingEnabled ? 'btn-danger' : 'btn-success'} w-100`} 
                onClick={toggleLocationSharing}
                disabled={locationError}
              >
                {sharingEnabled ? '位置情報の共有を停止' : '位置情報の共有を開始'}
              </button>
            </div>

            {status && (
              <div className={`alert ${locationError ? 'alert-danger' : 'alert-info'} mb-3`}>
                {status}
              </div>
            )}

            <div className="mb-3">
              <p>現在位置を5秒ごとに更新しています。各ユーザーの1時間以内の位置情報を表示しています。</p>
              <p>現在の共有ユーザー数: {locations.length}人</p>
            </div>

            {/* デバッグ情報（開発時のみ表示） */}
            <div className="mb-3 small text-muted">
              <details>
                <summary>デバッグ情報</summary>
                <pre style={{ maxHeight: '150px', overflow: 'auto' }}>
                  {JSON.stringify(locations.map(loc => ({
                    user: loc.username,
                    time: loc.timestamp.toLocaleString(),
                    minsAgo: Math.round((new Date() - loc.timestamp) / 60000)
                  })), null, 2)}
                </pre>
              </details>
            </div>

            <div style={{ height: '500px', width: '100%' }}>
              <MapContainer 
                center={center} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* 現在位置を中心に地図を表示 */}
                <LocateMe />
                
                {/* 自分の現在位置 */}
                {userLocation && (
                  <Marker 
                    position={userLocation}
                    icon={new L.Icon({
                      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Popup>
                      <strong>{username} (自分)</strong><br />
                      現在位置<br />
                      {new Date().toLocaleTimeString()}
                    </Popup>
                  </Marker>
                )}
                
                {/* 共有された位置情報 */}
                {locations.map((location) => (
                  // 自分の位置は既に表示しているのでスキップ
                  location.username !== username && (
                    <Marker 
                      key={location.id} 
                      position={location.position}
                      icon={new L.Icon({
                        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                      })}
                    >
                      <Popup>
                        <strong>{location.username}</strong><br />
                        {location.timestamp.toLocaleString()}<br />
                        ({Math.round((new Date() - location.timestamp) / 60000)}分前)
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapPage;
