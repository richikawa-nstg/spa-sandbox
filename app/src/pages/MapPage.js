import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
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

// 2つの位置の距離を計算する関数（メートル単位）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 距離（メートル）
}

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
  const [deviceId, setDeviceId] = useState('');
  
  // 最適化のための状態
  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(30); // デフォルト30秒
  const [minDistance, setMinDistance] = useState(10); // 最小移動距離（メートル）
  const [minTimeInterval, setMinTimeInterval] = useState(30); // 最小時間間隔（秒）
  
  // 初回レンダリング時にデバイスIDを取得または生成
  useEffect(() => {
    let storedDeviceId = localStorage.getItem('device_id');
    
    if (!storedDeviceId) {
      storedDeviceId = uuidv4();
      localStorage.setItem('device_id', storedDeviceId);
    }
    
    setDeviceId(storedDeviceId);
    console.log(`デバイスID: ${storedDeviceId}`);
  }, []);
  
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

  // 位置情報を送信すべきかどうかを判断する関数
  const shouldSendLocation = useCallback((currentLocation) => {
    if (!currentLocation) return false;
    
    const now = new Date();
    
    // 最初の送信の場合は送信する
    if (!lastSentLocation || !lastSentTime) {
      return true;
    }
    
    // 最小時間間隔をチェック
    const timeDiff = (now - lastSentTime) / 1000; // 秒
    if (timeDiff < minTimeInterval) {
      console.log(`送信スキップ: 最後の送信から${Math.round(timeDiff)}秒しか経過していません`);
      return false;
    }
    
    // 位置の変化をチェック
    const distance = calculateDistance(
      lastSentLocation[0], lastSentLocation[1],
      currentLocation[0], currentLocation[1]
    );
    
    if (distance < minDistance) {
      console.log(`送信スキップ: 移動距離が${Math.round(distance)}mで最小距離(${minDistance}m)未満です`);
      return false;
    }
    
    console.log(`送信実行: 移動距離${Math.round(distance)}m, 経過時間${Math.round(timeDiff)}秒`);
    return true;
  }, [lastSentLocation, lastSentTime, minDistance, minTimeInterval]);

  // 位置情報を共有（最適化版）
  const shareLocation = useCallback(async () => {
    if (!userLocation || !deviceId) return;
    
    // 送信すべきかどうかを判断
    if (!shouldSendLocation(userLocation)) {
      return;
    }
    
    try {
      console.log(`位置情報をFirebaseに保存/更新: デバイスID=${deviceId}, ユーザー=${username}`);
      
      // デバイスIDをドキュメントIDとして使用
      const userDocRef = doc(db, 'userLocations', deviceId);
      
      // ドキュメントを設定/更新
      await setDoc(userDocRef, {
        user: username,
        device_id: deviceId,
        latitude: userLocation[0],
        longitude: userLocation[1],
        timestamp: serverTimestamp()
      });
      
      // 最後に送信した位置と時間を記録
      setLastSentLocation(userLocation);
      setLastSentTime(new Date());
      
      setStatus(`位置情報を共有しました！ [${new Date().toLocaleTimeString()}]`);
    } catch (error) {
      console.error('位置情報の共有に失敗しました:', error);
      setStatus('位置情報の共有に失敗しました: ' + error.message);
    }
  }, [userLocation, username, deviceId, shouldSendLocation]);

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
    if (!sharingEnabled || !deviceId) return;
    
    // 初回共有
    if (userLocation) {
      shareLocation();
    }
    
    // 設定された間隔で位置情報を更新
    const interval = setInterval(() => {
      getUserLocation();
      if (userLocation && !locationError) {
        shareLocation();
      }
    }, updateInterval * 1000);
    
    return () => clearInterval(interval);
  }, [sharingEnabled, userLocation, shareLocation, getUserLocation, locationError, deviceId, updateInterval]);

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
              deviceId: data.device_id,
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

            {/* 最適化設定 */}
            <div className="mb-3">
              <h6>更新設定</h6>
              <div className="row">
                <div className="col-md-4">
                  <label htmlFor="updateInterval" className="form-label">更新間隔（秒）</label>
                  <select
                    className="form-select"
                    id="updateInterval"
                    value={updateInterval}
                    onChange={(e) => setUpdateInterval(Number(e.target.value))}
                  >
                    <option value="5">5秒（テスト用）</option>
                    <option value="15">15秒</option>
                    <option value="30">30秒（推奨）</option>
                    <option value="60">1分</option>
                    <option value="120">2分</option>
                    <option value="300">5分</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="minDistance" className="form-label">最小移動距離（m）</label>
                  <select
                    className="form-select"
                    id="minDistance"
                    value={minDistance}
                    onChange={(e) => setMinDistance(Number(e.target.value))}
                  >
                    <option value="0">0m（常に送信）</option>
                    <option value="5">5m</option>
                    <option value="10">10m（推奨）</option>
                    <option value="25">25m</option>
                    <option value="50">50m</option>
                    <option value="100">100m</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="minTimeInterval" className="form-label">最小送信間隔（秒）</label>
                  <select
                    className="form-select"
                    id="minTimeInterval"
                    value={minTimeInterval}
                    onChange={(e) => setMinTimeInterval(Number(e.target.value))}
                  >
                    <option value="0">0秒（制限なし）</option>
                    <option value="15">15秒</option>
                    <option value="30">30秒（推奨）</option>
                    <option value="60">1分</option>
                    <option value="120">2分</option>
                  </select>
                </div>
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
              <p>位置情報を{updateInterval}秒ごとにチェックし、{minDistance}m以上移動した場合のみ送信します。</p>
              <p>現在の共有ユーザー数: {locations.length}人</p>
              <p>あなたのデバイスID: {deviceId.substring(0, 8)}...</p>
              {lastSentTime && (
                <p>最後の送信: {lastSentTime.toLocaleTimeString()}</p>
              )}
            </div>

            {/* デバッグ情報（開発時のみ表示） */}
            <div className="mb-3 small text-muted">
              <details>
                <summary>デバッグ情報</summary>
                <pre style={{ maxHeight: '150px', overflow: 'auto' }}>
                  {JSON.stringify({
                    locations: locations.map(loc => ({
                      user: loc.username,
                      device: loc.deviceId?.substring(0, 8) + '...',
                      time: loc.timestamp.toLocaleString(),
                      minsAgo: Math.round((new Date() - loc.timestamp) / 60000)
                    })),
                    lastSent: lastSentLocation ? {
                      time: lastSentTime?.toLocaleTimeString(),
                      location: lastSentLocation
                    } : null
                  }, null, 2)}
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
                  // 自分のデバイスIDと異なる場合のみ表示
                  location.deviceId !== deviceId && (
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
