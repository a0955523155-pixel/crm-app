import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Plus, Search, Phone, Mail, Briefcase, ChevronRight, ArrowLeft, Clock, 
  CheckCircle, XCircle, Calendar, FileText, Send, Trash2, Edit, AlertTriangle, 
  Cloud, Loader2, Download, Moon, Sun, LayoutDashboard, List, LogOut, UserCircle, 
  ShieldCheck, Lock, Key, MapPin, Tag, Image as ImageIcon, Upload, BarChart3, 
  TrendingUp, Filter, CalendarDays, UserCog, Ban, Check, Copy, RefreshCcw, 
  Building2, Settings, FolderPlus, Folder, AlertOctagon, Megaphone, Timer, Save
} from 'lucide-react';

// [修正] 將 Firebase 初始化邏輯放回此檔案
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  serverTimestamp,
  arrayUnion,
  getDocs,
  where,
  orderBy,
  setDoc
} from 'firebase/firestore';

// --- Firebase 設定與初始化 ---
const firebaseConfig = {
  apiKey: "AIzaSyB-0ipmoEDjC98z0l-qM51qTxVWHsTHDls",
  authDomain: "greenshootteam.firebaseapp.com",
  projectId: "greenshootteam",
  storageBucket: "greenshootteam.firebasestorage.app",
  messagingSenderId: "185924188788",
  appId: "1:185924188788:web:90c5212d20dba6c6ba6f21",
  measurementId: "G-CYS5W473VS"
};

// 初始化 Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (e) {
    // 忽略重複初始化錯誤
}
const auth = getAuth(app);
const db = getFirestore(app);

// --- 常數設定 ---
const appId = "greenshootteam"; 
const ADMIN_CODE = "888888";       // 普通管理員註冊碼
const SUPER_ADMIN_CODE = "123456"; // 最高管理員註冊碼

// 預設來源 (全域)
const DEFAULT_SOURCES = ["FB", "帆布", "591", "小黃板", "DM", "他人介紹", "自行開發", "官方LINE", "其他"];
const CATEGORIES = ["買方", "賣方", "承租方", "出租方"];
const LEVELS = ["A", "B", "C"];

// 預設案場範本
const DEFAULT_PROJECTS = {
  "屏東工業地": ["大成工業城", "華富工業城一期", "華富工業城二期", "竹田工業城", "萬丹工業城", "弓鼎工業城"],
  "高雄工業地": ["九大工業城", "新鎮工業城", "環球工業城", "聖母工業城"],
  "高雄農地": ["松埔居", "義仁農地"]
};

const STATUS_CONFIG = {
  potential: { label: '潛在客戶', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Users },
  negotiating: { label: '洽談中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  won: { label: '已成交', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  lost: { label: '已流失', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: XCircle },
};

// 圖片壓縮工具函數
const resizeImage = (file, maxWidth = 800) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// 時間處理工具
const getDateFromFirestore = (timestamp) => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
};

// 格式化日期為 YYYY-MM-DD 字串
const formatDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 計算剩餘天數
const getDaysLeft = (endDate) => {
    if (!endDate) return null;
    const now = new Date();
    // 設定為當天開始
    now.setHours(0,0,0,0);
    const end = new Date(endDate);
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// --- 子元件 ---

const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['potential'];
    const Icon = config.icon;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}><Icon className="w-3 h-3 mr-1" />{config.label}</span>;
};

const ClientCard = ({ c, darkMode, onClick }) => (
    <div onClick={() => onClick(c)} className={`group rounded-xl p-4 border cursor-pointer active:scale-[0.98] transition-all ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-gray-200 hover:border-blue-400 shadow-sm'}`}>
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{c.name?.[0]}</div>
                <div>
                    <h3 className={`font-bold text-base leading-none mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{c.name} <span className="text-xs font-normal text-gray-400 ml-1">({c.category || '未分類'})</span></h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{c.project ? c.project : (c.company || '未填寫案場')}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 rounded flex items-center gap-1">
                            <CalendarDays className="w-3 h-3"/>
                            {formatDateString(getDateFromFirestore(c.createdAt))}
                        </span>
                    </div>
                </div>
            </div>
            <StatusBadge status={c.status} />
        </div>
        <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400 font-medium pl-12">
            <span className="flex items-center gap-3">
                <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{c.lastContact}</span>
                <span className="text-blue-500">NT$ {c.value?.toLocaleString() || 0}</span>
            </span>
            <ChevronRight className="w-4 h-4" />
        </div>
    </div>
);

// --- 主應用程式 ---

export default function ClientFlow() {
  const [sessionUser, setSessionUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); 
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Projects State
  const [companyProjects, setCompanyProjects] = useState(DEFAULT_PROJECTS);
  // 廣告設定 State: { "ProjectName": [{id, name, startDate, endDate}] }
  const [projectAds, setProjectAds] = useState({}); 

  const [newRegionName, setNewRegionName] = useState('');
  const [newProjectNames, setNewProjectNames] = useState({});
  
  // 廣告管理 Modal 狀態
  const [adManageProject, setAdManageProject] = useState(null); 
  const [adForm, setAdForm] = useState({ id: '', name: '', startDate: '', endDate: '' });
  const [isEditingAd, setIsEditingAd] = useState(false);

  // 刪除確認狀態
  const [pendingDelete, setPendingDelete] = useState(null);

  // Dashboard Time Filter
  const [dashTimeFrame, setDashTimeFrame] = useState('month'); 

  // --- 客戶列表的時間篩選器 ---
  const [listMode, setListMode] = useState('month');
  const [listYear, setListYear] = useState(new Date().getFullYear());
  const [listMonth, setListMonth] = useState(new Date().getMonth() + 1);

  // Super Admin: User List
  const [allUsers, setAllUsers] = useState([]);

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('crm-dark-mode') === 'true'; } catch { return false; }
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('crm-dark-mode', String(newVal));
      return newVal;
    });
  };

  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setSessionUser(u);
      const savedUser = localStorage.getItem('crm-user-profile');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
        setView('list');
      } else {
        setView('login');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Customers
  useEffect(() => {
    if (!sessionUser || !currentUser) return;
    setLoading(true);
    const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'customers');
    
    let q;
    if (currentUser.companyCode) {
        q = query(collectionRef, where("companyCode", "==", currentUser.companyCode));
    } else {
        q = query(collectionRef); 
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.lastContact || '').localeCompare(a.lastContact || ''));
      const filteredData = currentUser.companyCode 
        ? data.filter(c => c.companyCode === currentUser.companyCode)
        : data;

      setCustomers(filteredData);
      setLoading(false);
      if (selectedCustomer) {
        const updated = filteredData.find(c => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
    });
    return () => unsubscribe();
  }, [sessionUser, currentUser]);

  // Fetch Company Settings (Projects & Ads)
  useEffect(() => {
    if (!currentUser?.companyCode) return;
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'company_settings', currentUser.companyCode);
    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.projects) setCompanyProjects(data.projects);
        if (data.projectAds) setProjectAds(data.projectAds); 
      } else {
        setCompanyProjects(DEFAULT_PROJECTS);
        setProjectAds({});
        setDoc(settingsDocRef, { projects: DEFAULT_PROJECTS, projectAds: {} }, { merge: true });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch Users (Super Admin)
  useEffect(() => {
      if (currentUser?.role === 'super_admin' && currentUser?.companyCode) {
          const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_users');
          const q = query(usersRef, where("companyCode", "==", currentUser.companyCode));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setAllUsers(users.filter(u => u.username !== currentUser.username));
          });
          return () => unsubscribe();
      }
  }, [currentUser]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  
  // --- Filtering ---
  const visibleCustomers = useMemo(() => {
    let baseData = customers;
    if (!isAdmin) {
      baseData = customers.filter(c => c.owner === currentUser?.username);
    }
    if (listMode !== 'all') {
        baseData = baseData.filter(c => {
            if (!c.createdAt) return true; 
            const d = getDateFromFirestore(c.createdAt);
            const dYear = d.getFullYear();
            const dMonth = d.getMonth() + 1;
            if (listMode === 'year') {
                return dYear === listYear;
            } else if (listMode === 'month') {
                return dYear === listYear && dMonth === listMonth;
            }
            return true;
        });
    }
    return baseData.filter(c => 
      (c.name?.includes(searchTerm) || c.company?.includes(searchTerm) || c.ownerName?.includes(searchTerm) || c.project?.includes(searchTerm)) && 
      (filterStatus === 'all' || c.status === filterStatus)
    );
  }, [customers, isAdmin, currentUser, searchTerm, filterStatus, listMode, listYear, listMonth]);

  const groupedCustomers = useMemo(() => {
      if (!isAdmin) return null;
      const groups = {};
      visibleCustomers.forEach(c => {
          const owner = c.ownerName || c.owner || '未知業務';
          if (!groups[owner]) groups[owner] = [];
          groups[owner].push(c);
      });
      return groups;
  }, [visibleCustomers, isAdmin]);

  const myCustomers = useMemo(() => {
    if (isAdmin) return []; 
    return visibleCustomers; 
  }, [visibleCustomers, isAdmin]);

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const trendData = {}; 
    const filteredData = customers.filter(c => {
        if (!c.createdAt) return true; 
        const d = getDateFromFirestore(c.createdAt);
        const dMonth = d.getMonth();
        const dYear = d.getFullYear();
        if (dYear === currentYear) {
            const mKey = `${dMonth + 1}月`;
            trendData[mKey] = (trendData[mKey] || 0) + (Number(c.value) || 0);
        }
        if (dashTimeFrame === 'month') return dMonth === currentMonth && dYear === currentYear;
        if (dashTimeFrame === 'year') return dYear === currentYear;
        return true; 
    });
    const totalValue = filteredData.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
    const counts = {
        total: filteredData.length,
        potential: filteredData.filter(c => c.status === 'potential').length,
        negotiating: filteredData.filter(c => c.status === 'negotiating').length,
        won: filteredData.filter(c => c.status === 'won').length,
    };
    return { totalValue, counts, trendData };
  }, [customers, dashTimeFrame]);

  const agentStats = useMemo(() => {
    const statsMap = {};
    customers.forEach(c => {
        const agent = c.ownerName || c.owner || '未知';
        if (!statsMap[agent]) {
            statsMap[agent] = { 
                name: agent, total: 0, potential: 0, negotiating: 0, won: 0, lost: 0, value: 0 
            };
        }
        statsMap[agent].total += 1;
        statsMap[agent].value += (Number(c.value) || 0);
        if (c.status === 'potential') statsMap[agent].potential++;
        else if (c.status === 'negotiating') statsMap[agent].negotiating++;
        else if (c.status === 'won') statsMap[agent].won++;
        else if (c.status === 'lost') statsMap[agent].lost++;
    });
    return Object.values(statsMap).sort((a, b) => b.total - a.total);
  }, [customers]);

  // --- Handlers ---
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('crm-user-profile');
    setView('login');
    setActiveTab('clients');
    setSearchTerm('');
    setLoading(false);
  };

  const handleLogin = async (username, password, companyCode, rememberMe) => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_users');
      const q = query(usersRef, where("username", "==", username)); 
      const querySnapshot = await getDocs(q);
      let foundUser = null;
      querySnapshot.forEach((doc) => {
          const u = doc.data();
          if (u.password === password) {
              if (u.companyCode && u.companyCode !== companyCode) return;
              foundUser = { id: doc.id, ...u };
          }
      });
      if (foundUser) {
        if (foundUser.status === 'suspended') {
            alert("此帳號已被停權，請聯繫最高管理員。");
            setLoading(false);
            return;
        }
        const profile = { 
            username: foundUser.username, 
            name: foundUser.name, 
            role: foundUser.role,
            companyCode: foundUser.companyCode || companyCode 
        };
        setCurrentUser(profile);
        localStorage.setItem('crm-user-profile', JSON.stringify(profile));
        
        if (rememberMe) {
            const loginInfo = { username, password, companyCode };
            localStorage.setItem('crm-login-info', btoa(JSON.stringify(loginInfo)));
        } else {
            localStorage.removeItem('crm-login-info');
        }

        setView('list');
      } else {
        alert("登入失敗：帳號、密碼或公司統編錯誤");
      }
    } catch (e) {
      console.error(e);
      alert("登入發生錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (username, password, name, role, adminCode, companyCode) => {
    if (!username || !password || !name || !companyCode) return alert("請填寫完整資訊 (含公司統編)");
    setLoading(true);
    let finalRole = role;
    if (role === 'admin') {
        if (adminCode === SUPER_ADMIN_CODE) {
            finalRole = 'super_admin';
        } else if (adminCode === ADMIN_CODE) {
            finalRole = 'admin';
        } else {
            setLoading(false);
            alert("註冊碼錯誤！(普通管理員: 888888, 最高管理員: 123456)");
            return false;
        }
    }
    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_users');
      const q = query(usersRef, where("username", "==", username)); 
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("此帳號已被註冊");
        setLoading(false);
        return false;
      } else {
        await addDoc(usersRef, { 
            username, 
            password, 
            name, 
            role: finalRole, 
            companyCode, 
            status: 'active', 
            createdAt: serverTimestamp() 
        });
        alert(`註冊成功！身分：${finalRole === 'super_admin' ? '最高管理員' : finalRole === 'admin' ? '普通管理員' : '一般業務'} (公司統編: ${companyCode})`);
        return true; 
      }
    } catch (e) {
      console.error(e);
      alert("註冊失敗");
    } finally {
      setLoading(false);
    }
    return false;
  };

  const toggleUserStatus = async (user) => {
      if (!isSuperAdmin) return;
      try {
          const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_users', user.id);
          await updateDoc(userRef, { status: newStatus });
      } catch (e) {
          console.error("Update user status failed", e);
      }
  };

  const handleDeleteUser = (user) => {
      if (!isSuperAdmin) return;
      setPendingDelete({ type: 'user', item: user });
  };

  // --- Project Management Handlers ---

  const saveSettingsToFirestore = async (newProjects, newProjectAds) => {
    if (!currentUser?.companyCode) return;
    try {
      const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'company_settings', currentUser.companyCode);
      // 同時更新 projects 和 projectAds
      const updatePayload = {};
      if (newProjects) updatePayload.projects = newProjects;
      if (newProjectAds) updatePayload.projectAds = newProjectAds;
      
      await setDoc(settingsDocRef, updatePayload, { merge: true });
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleAddRegion = () => {
    if (!newRegionName.trim()) return;
    if (companyProjects[newRegionName]) {
      alert("此分類已存在");
      return;
    }
    const updated = { ...companyProjects, [newRegionName]: [] };
    setCompanyProjects(updated);
    saveSettingsToFirestore(updated, null);
    setNewRegionName('');
  };

  const handleAddProject = (region) => {
    const pName = newProjectNames[region];
    if (!pName || !pName.trim()) return;
    const currentList = companyProjects[region] || [];
    if (currentList.includes(pName)) {
      alert("此案場已存在於該分類中");
      return;
    }
    const updated = { ...companyProjects, [region]: [...currentList, pName] };
    setCompanyProjects(updated);
    saveSettingsToFirestore(updated, null);
    setNewProjectNames({ ...newProjectNames, [region]: '' });
  };

  // 廣告管理功能 (支援編輯、時間計算)
  const handleSaveAd = () => {
    if (!adForm.name.trim() || !adManageProject) return;
    
    // 獲取當前案場的廣告列表，需處理舊版純字串資料
    let currentAds = projectAds[adManageProject] || [];
    // 轉換舊資料為物件格式
    currentAds = currentAds.map(ad => typeof ad === 'string' ? { id: Date.now() + Math.random(), name: ad, startDate: '', endDate: '' } : ad);

    let updatedAdsList;

    if (isEditingAd) {
        // 更新現有
        updatedAdsList = currentAds.map(ad => ad.id === adForm.id ? adForm : ad);
    } else {
        // 新增
        updatedAdsList = [...currentAds, { ...adForm, id: Date.now() }];
    }

    const updatedAdsMap = { ...projectAds, [adManageProject]: updatedAdsList };
    setProjectAds(updatedAdsMap);
    saveSettingsToFirestore(null, updatedAdsMap);
    
    // Reset Form
    setAdForm({ id: '', name: '', startDate: '', endDate: '' });
    setIsEditingAd(false);
  };

  const handleEditAdInit = (ad) => {
      // 相容舊版資料
      if (typeof ad === 'string') {
          setAdForm({ id: ad, name: ad, startDate: '', endDate: '' }); // ID 暫用名字替代
      } else {
          setAdForm(ad);
      }
      setIsEditingAd(true);
  };

  const handleDeleteAd = (adId) => {
    if (!adManageProject) return;
    if (!confirm(`確定刪除此廣告選項嗎？`)) return; 
    
    let currentAds = projectAds[adManageProject] || [];
    // 過濾掉該 ID (若是舊版字串，過濾名字)
    const updatedAdsList = currentAds.filter(a => (typeof a === 'string' ? a !== adId : a.id !== adId));
    
    const updatedAdsMap = { ...projectAds, [adManageProject]: updatedAdsList };
    setProjectAds(updatedAdsMap);
    saveSettingsToFirestore(null, updatedAdsMap);
  };


  // 觸發刪除確認視窗
  const handleDeleteRegion = (regionName) => {
      setPendingDelete({ type: 'region', region: regionName });
  };

  const handleDeleteProject = (region, project) => {
      setPendingDelete({ type: 'project', region: region, item: project });
  };

  // 執行刪除的邏輯
  const executeDelete = async () => {
      if (!pendingDelete) return;
      const { type, region, item } = pendingDelete;
      
      if (type === 'user') {
          try {
             const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_users', item.id);
             await deleteDoc(userRef);
          } catch(e) {
             console.error(e);
             alert("刪除失敗，請檢查網路或權限");
          }
      } else {
          let updated = { ...companyProjects };
          if (type === 'region') {
              delete updated[region];
          } else if (type === 'project') {
              if (updated[region]) {
                  updated[region] = updated[region].filter(p => p !== item);
              }
          }
          setCompanyProjects(updated);
          saveSettingsToFirestore(updated, null);
      }
      
      setPendingDelete(null); 
  };

  // --- Customer Handlers ---
  const handleAddCustomer = async (formData) => {
    if (!currentUser) return;
    try {
      const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'customers');
      const createDate = formData.createdAt ? new Date(formData.createdAt) : new Date();
      await addDoc(collectionRef, { 
        ...formData, 
        createdAt: createDate,
        notes: [], 
        lastContact: new Date().toISOString().split('T')[0], 
        owner: currentUser.username,
        ownerName: currentUser.name,
        companyCode: currentUser.companyCode 
      });
      setView('list');
      setActiveTab('clients');
    } catch (err) {
      console.error("Add failed:", err);
    }
  };

  const handleEditCustomer = async (formData) => {
    if (!selectedCustomer) return;
    if (selectedCustomer.owner !== currentUser.username) {
        alert("權限限制：您只能編輯自己的客戶資料。");
        return;
    }
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', selectedCustomer.id);
      const updateData = { ...formData };
      if (updateData.createdAt) {
          updateData.createdAt = new Date(updateData.createdAt);
      }
      await updateDoc(docRef, updateData);
      setView('detail');
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleAddNote = async (customerId, noteContent, noteType) => {
    try {
      const newNote = { id: Date.now(), date: new Date().toISOString().split('T')[0], type: noteType, content: noteContent, author: currentUser.name };
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', customerId);
      await updateDoc(docRef, { notes: arrayUnion(newNote), lastContact: newNote.date });
    } catch (err) {
      console.error("Note failed:", err);
    }
  };
  
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    if (selectedCustomer.owner !== currentUser.username) {
        alert("權限限制：您只能刪除自己的客戶資料。");
        setShowDeleteModal(false);
        return;
    }
    try {
       const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'customers', selectedCustomer.id);
       await deleteDoc(docRef);
       setShowDeleteModal(false);
       setView('list');
    } catch(err) {
        console.error(err);
    }
  };

  // 原生 CSV 匯出
  const handleExportExcel = () => {
    const dataToExport = isAdmin ? customers : myCustomers;
    if (dataToExport.length === 0) {
        alert("沒有資料可匯出");
        return;
    }
    setIsExporting(true);
    
    try {
        const headers = [
            '公司代碼', '負責業務', '建立日期', '客戶姓名', '性別', 
            '級別', '需求分類', '公司名稱', '聯絡電話', '次要專員', 
            '可聯絡時間', '從何得知', '關注案場', '通訊地址', '需求地區', 
            '需求坪數', '預算 (NTD)', '目前狀態', '備註', '最後聯絡', '記事數'
        ];
        const csvRows = [headers.join(',')];

        dataToExport.forEach(c => {
            const row = [
                `"${c.companyCode || ''}"`,
                `"${c.ownerName || c.owner || ''}"`,
                `"${formatDateString(getDateFromFirestore(c.createdAt))}"`,
                `"${c.name || ''}"`,
                `"${c.gender || ''}"`,
                `"${c.level || ''}"`,
                `"${c.category || ''}"`,
                `"${c.company || ''}"`,
                `"${c.phone || ''}"`,
                `"${c.secondaryAgent || ''}"`,
                `"${c.contactTime || ''}"`,
                `"${c.source || ''}"`,
                `"${c.project || ''}"`,
                `"${c.address || ''}"`,
                `"${c.reqRegion || ''}"`,
                `"${c.reqPing || ''}"`,
                `"${c.value || 0}"`,
                `"${STATUS_CONFIG[c.status]?.label || c.status || ''}"`,
                `"${(c.remarks || '').replace(/"/g, '""')}"`, 
                `"${c.lastContact || ''}"`,
                `"${(c.notes || []).length}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `客源通_報表_${currentUser.companyCode}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Export failed:", error);
        alert("匯出失敗，請稍後再試");
    } finally {
        setIsExporting(false);
    }
  };

  // --- Render Functions ---

  const renderClientsTab = () => {
    const years = Array.from({length: 10}, (_, i) => new Date().getFullYear() - i); 
    const months = Array.from({length: 12}, (_, i) => i + 1);

    return (
      <div className="pb-24">
        {/* [修正] 使用 w-full 確保寬度填滿，防止右側空白 */}
        <div className={`w-full px-4 pt-10 pb-4 sticky top-0 z-10 border-b transition-colors ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-gray-50 border-gray-200'}`}>
           <div className="flex justify-between items-center mb-4">
              <div>
                 <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>客戶列表</h1>
                 <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <span>{currentUser?.name} ({isSuperAdmin ? '最高管理員' : isAdmin ? '管理員' : '業務'})</span>
                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex items-center gap-1"><Building2 className="w-3 h-3"/> {currentUser?.companyCode}</span>
                 </p>
              </div>
              <div className="flex gap-2">
                 <button onClick={toggleDarkMode} className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-200 text-gray-600'}`}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
                 <button onClick={handleLogout} className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-red-400' : 'bg-gray-200 text-gray-600'}`}><LogOut className="w-5 h-5" /></button>
              </div>
           </div>

           <div className="flex flex-col gap-2 mb-3">
               <div className="flex bg-gray-200 dark:bg-slate-800 rounded-lg p-1">
                   <button onClick={() => setListMode('month')} className={`flex-1 py-1 text-xs font-bold rounded ${listMode === 'month' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500'}`}>月檢視</button>
                   <button onClick={() => setListMode('year')} className={`flex-1 py-1 text-xs font-bold rounded ${listMode === 'year' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500'}`}>年檢視</button>
                   <button onClick={() => setListMode('all')} className={`flex-1 py-1 text-xs font-bold rounded ${listMode === 'all' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-gray-500'}`}>全部</button>
               </div>
               {listMode !== 'all' && (
                   <div className="flex gap-2">
                       <select value={listYear} onChange={(e) => setListYear(Number(e.target.value))} className={`flex-1 py-1 px-2 rounded border text-xs outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300'}`}>
                           {years.map(y => <option key={y} value={y}>{y}年</option>)}
                       </select>
                       {listMode === 'month' && (
                           <select value={listMonth} onChange={(e) => setListMonth(Number(e.target.value))} className={`flex-1 py-1 px-2 rounded border text-xs outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300'}`}>
                               {months.map(m => <option key={m} value={m}>{m}月</option>)}
                           </select>
                       )}
                   </div>
               )}
           </div>

           <div className={`rounded-xl p-2 flex items-center border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-300'}`}>
              <Search className="w-5 h-5 text-gray-400 ml-2" />
              <input type="text" placeholder="搜尋客戶、公司、案場..." className={`w-full px-3 py-1 bg-transparent outline-none text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>
        
        <div className="px-4 mt-4 space-y-3">
           {loading ? (
             <div className="text-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto opacity-50" /></div>
           ) : visibleCustomers.length === 0 ? (
             <div className="text-center py-20 opacity-40">
               <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
               <p className="font-bold text-gray-500">此期間無資料</p>
               <p className="text-xs mt-1">請嘗試切換月份或年份</p>
             </div>
           ) : (
             <>
               {isAdmin && groupedCustomers ? (
                  Object.entries(groupedCustomers).map(([ownerName, list]) => (
                      <div key={ownerName} className="mb-6">
                          <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-2">
                              <UserCircle className="w-4 h-4"/> {ownerName} <span className="text-gray-400 text-xs font-normal">({list.length}位)</span>
                          </h3>
                          <div className="space-y-3">
                              {list.map(c => <ClientCard key={c.id} c={c} darkMode={darkMode} onClick={(client) => { setSelectedCustomer(client); setView('detail'); }} />)}
                          </div>
                      </div>
                  ))
               ) : (
                  myCustomers.map(c => <ClientCard key={c.id} c={c} darkMode={darkMode} onClick={(client) => { setSelectedCustomer(client); setView('detail'); }} />)
               )}
             </>
           )}
        </div>
        <button onClick={() => setView('add')} className="fixed right-6 bottom-24 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 z-50 transition-all hover:bg-blue-700"><Plus className="w-7 h-7" /></button>
      </div>
    );
  };

  const renderDashboardTab = () => {
    if (!isAdmin) return <div className="p-10 text-center text-gray-500">您沒有權限查看此頁面</div>;
    return (
      <div className="pb-24 px-6 pt-10">
        <div className="flex justify-between items-center mb-6">
           <div><h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>數據儀表板</h1><p className="text-xs text-gray-500 mt-1">{isSuperAdmin ? '系統與業績總覽' : '全公司業績總覽'} ({currentUser.companyCode})</p></div>
           <button onClick={handleExportExcel} disabled={isExporting} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-700 border'}`}>{isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 匯出報表</button>
        </div>

        {/* 案場管理區塊 */}
        <div className={`mb-8 p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-blue-100 shadow-sm'}`}>
          <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-blue-600"><Settings className="w-5 h-5"/> 案場與分類管理</h3>
          
          <div className="space-y-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="輸入新地區分類名稱 (例: 台南重劃區)" 
                className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300'}`}
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
              />
              <button onClick={handleAddRegion} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-700"><FolderPlus className="w-4 h-4" /> 新增分類</button>
            </div>

            <div className="space-y-4">
              {Object.entries(companyProjects).map(([region, projectList]) => (
                <div key={region} className={`rounded-xl border p-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                   <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">
                     <h4 className="font-bold flex items-center gap-2 text-sm"><Folder className="w-4 h-4 text-yellow-500" /> {region}</h4>
                     <button type="button" onClick={() => handleDeleteRegion(region)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                   </div>
                   
                   <div className="flex flex-wrap gap-2 mb-3">
                     {projectList.map(project => (
                       <div key={project} className={`relative group/item flex items-center`}>
                           <span className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 border ${darkMode ? 'bg-slate-700 text-gray-200 border-slate-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                             {project}
                             {/* [新增] 廣告管理按鈕 */}
                             <button 
                                type="button"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setAdManageProject(project); 
                                    setAdForm({ id: '', name: '', startDate: '', endDate: '' });
                                    setIsEditingAd(false);
                                }}
                                className="ml-1 text-blue-400 hover:text-blue-600"
                                title="管理廣告選項"
                             >
                                <Megaphone className="w-3 h-3" />
                             </button>
                             <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(region, project); }} 
                                className="text-gray-400 hover:text-red-600 transition-colors ml-1"
                             >
                                <XCircle className="w-3 h-3" />
                             </button>
                           </span>
                       </div>
                     ))}
                     {projectList.length === 0 && <span className="text-xs text-gray-400 italic">尚無案場</span>}
                   </div>

                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder={`新增 ${region} 內的案場...`}
                        className={`flex-1 px-2 py-1 rounded border text-xs outline-none ${darkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
                        value={newProjectNames[region] || ''}
                        onChange={(e) => setNewProjectNames({...newProjectNames, [region]: e.target.value})}
                      />
                      <button onClick={() => handleAddProject(region)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700">新增</button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 人員管理區塊 */}
        {isSuperAdmin && (
            <div className={`mb-8 p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-purple-100 shadow-sm'}`}>
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-purple-600"><UserCog className="w-5 h-5"/> 公司人員權限管理 <span className="text-xs bg-purple-100 text-purple-700 px-2 rounded-full">{currentUser.companyCode}</span></h3>
                <div className="space-y-3">
                    {allUsers.length === 0 ? <p className="text-sm text-gray-400">載入中或無其他人員...</p> : allUsers.map(u => (
                        <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-600' : u.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                    {u.role === 'super_admin' ? 'S' : u.role === 'admin' ? 'A' : 'U'}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${u.status === 'suspended' ? 'text-gray-400 line-through' : darkMode ? 'text-white' : 'text-gray-800'}`}>{u.name} <span className="text-[10px] font-normal text-gray-500">({u.username})</span></p>
                                    <p className="text-[10px] text-gray-400">{u.role === 'admin' ? '普通管理員' : '一般業務'} • {u.status === 'suspended' ? '已停權' : '正常'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleUserStatus(u)} className={`p-2 rounded-lg text-xs font-bold ${u.status === 'suspended' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                    {u.status === 'suspended' ? <CheckCircle className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                                </button>
                                <button onClick={() => handleDeleteUser(u)} className="p-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* 業績報表 */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg mb-6">
            {['month', 'year', 'all'].map(t => (
                <button key={t} onClick={() => setDashTimeFrame(t)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${dashTimeFrame === t ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                    {t === 'month' ? '本月' : t === 'year' ? '年度' : '全部'}
                </button>
            ))}
        </div>

        <div className={`p-5 rounded-2xl border mb-6 ${darkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white'}`}>
           <div className="flex items-center gap-2 mb-2 opacity-80"><Briefcase className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">{dashTimeFrame === 'month' ? '本月新增預算' : dashTimeFrame === 'year' ? '本年度總預算' : '歷史總預算'}</span></div>
           <p className="text-3xl font-black">NT$ {dashboardStats.totalValue.toLocaleString()}</p>
           <div className="mt-4 flex gap-4 text-xs font-medium opacity-80">
               <div className="flex items-center gap-1"><UserCircle className="w-3 h-3"/> {dashboardStats.counts.total} 位新客</div>
               <div className="flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {dashboardStats.counts.won} 位成交</div>
           </div>
        </div>
        
        {dashTimeFrame !== 'month' && (
            <div className="mb-8">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-500"/> 月份預算趨勢</h3>
                <div className="flex items-end gap-2 h-24 mt-2 overflow-x-auto pb-2 no-scrollbar">
                    {Object.entries(dashboardStats.trendData).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([key, val]) => (
                        <div key={key} className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div className="w-8 bg-blue-500/20 rounded-t-sm relative group h-full flex flex-col justify-end">
                                <div style={{ height: `${Math.max(4, Math.min((val / (dashboardStats.totalValue || 1)) * 100, 100))}%` }} className="w-full bg-blue-500 rounded-t-sm"></div>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">${(val/10000).toFixed(0)}萬</div>
                            </div>
                            <span className="text-[10px] text-gray-400">{key}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500"/> 各專員累計業績</h3>
            {agentStats.map((agent, index) => (
                <div key={index} className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{agent.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">總客戶數: {agent.total}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">NT$ {agent.value.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-blue-50 dark:bg-slate-800 p-2 rounded"><div className="text-blue-500 font-bold">{agent.potential}</div><div className="text-gray-400 scale-90">潛在</div></div>
                        <div className="bg-yellow-50 dark:bg-slate-800 p-2 rounded"><div className="text-yellow-600 font-bold">{agent.negotiating}</div><div className="text-gray-400 scale-90">洽談</div></div>
                        <div className="bg-green-50 dark:bg-slate-800 p-2 rounded"><div className="text-green-600 font-bold">{agent.won}</div><div className="text-gray-400 scale-90">成交</div></div>
                        <div className="bg-gray-50 dark:bg-slate-800 p-2 rounded"><div className="text-gray-500 font-bold">{agent.lost}</div><div className="text-gray-400 scale-90">流失</div></div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  };

  const LoginScreen = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', name: '', role: 'user', adminCode: '', companyCode: '', rememberMe: false });
    const [usernameError, setUsernameError] = useState(''); 
    const [isCheckingUser, setIsCheckingUser] = useState(false);
    const [captcha, setCaptcha] = useState("");
    const [captchaInput, setCaptchaInput] = useState("");

    // 自動讀取儲存的帳號密碼
    useEffect(() => {
        const savedLogin = localStorage.getItem('crm-login-info');
        if (savedLogin) {
            try {
                const { username, password, companyCode } = JSON.parse(atob(savedLogin));
                setForm(prev => ({ ...prev, username, password, companyCode, rememberMe: true }));
            } catch (e) {
                console.error("Failed to parse saved login info");
                localStorage.removeItem('crm-login-info');
            }
        }
    }, []);

    const generateCaptcha = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
        let result = "";
        for(let i=0; i<4; i++) {
           result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptcha(result);
        setCaptchaInput("");
    };

    useEffect(() => {
        if(isRegister) generateCaptcha();
    }, [isRegister]);

    const checkUsername = async () => {
        if (!form.username.trim() || !isRegister) return;
        setIsCheckingUser(true);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_users');
            const q = query(usersRef, where("username", "==", form.username)); 
            const snap = await getDocs(q);
            if (!snap.empty) {
                setUsernameError("此帳號已被註冊");
            } else {
                setUsernameError("");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCheckingUser(false);
        }
    };

    const submit = async (e) => {
      e.preventDefault();
      if (!form.companyCode.trim()) {
          alert("請輸入公司統編/代碼");
          return;
      }
      if (isRegister) {
        if (usernameError) return;
        if (captchaInput.toUpperCase() !== captcha) {
            alert("驗證碼錯誤，請重新輸入");
            generateCaptcha();
            return;
        }
        if (form.role === 'admin') {
            if (form.adminCode !== ADMIN_CODE && form.adminCode !== SUPER_ADMIN_CODE) {
               alert("註冊碼錯誤！"); return;
            }
        }
        const success = await handleRegister(form.username, form.password, form.name, form.role, form.adminCode, form.companyCode);
        if (success) { setIsRegister(false); setForm(p => ({...p, password: '', adminCode: ''})); }
      } else {
        handleLogin(form.username, form.password, form.companyCode, form.rememberMe);
      }
    };

    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${darkMode ? 'bg-slate-950' : 'bg-gray-100'}`}>
         {/* [修正] Login Container width */}
         <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl transition-colors ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4 shadow-lg shadow-blue-600/30">
                  <Briefcase className="w-8 h-8" />
               </div>
               <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>客源通 CRM</h1>
               <p className="text-sm text-gray-500 mt-2">多公司協作．權限分級管理系統</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center gap-1"><Building2 className="w-3 h-3"/> 公司統編 / 代碼 *</label>
                  <input type="text" required className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 mt-1 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={form.companyCode} onChange={e => setForm({...form, companyCode: e.target.value})} placeholder="例: 12345678 或公司簡稱" />
                  <p className="text-[10px] text-gray-400 mt-1 ml-1">{isRegister ? '請設定您的公司代碼，相同代碼的成員將視為同一公司' : '請輸入您所屬的公司代碼以登入'}</p>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">帳號</label>
                  <div className="relative">
                    <input 
                        type="text" 
                        required 
                        className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 mt-1 transition-colors ${usernameError ? 'border-red-500 focus:ring-red-500' : ''} ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} 
                        value={form.username} 
                        onChange={e => {
                            setForm({...form, username: e.target.value});
                            if (usernameError) setUsernameError(''); 
                        }} 
                        onBlur={checkUsername} 
                        placeholder="輸入帳號" 
                    />
                    {isCheckingUser && <div className="absolute right-3 top-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400"/></div>}
                  </div>
                  {usernameError && <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {usernameError}</p>}
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">密碼</label>
                  <input type="password" required className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 mt-1 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="輸入密碼" />
               </div>
               
               {/* 記住我選項 */}
               {!isRegister && (
                   <div className="flex items-center ml-1">
                       <input 
                           type="checkbox" 
                           id="rememberMe" 
                           className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                           checked={form.rememberMe}
                           onChange={(e) => setForm({...form, rememberMe: e.target.checked})}
                       />
                       <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-500 cursor-pointer select-none">記住帳號密碼</label>
                   </div>
               )}

               {isRegister && (
                 <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                     <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">姓名</label>
                        <input type="text" required className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 mt-1 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="王小明" />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">角色</label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                           <button type="button" onClick={() => setForm({...form, role: 'user'})} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.role === 'user' ? 'bg-blue-600 text-white border-blue-600' : (darkMode ? 'bg-slate-800 text-gray-400 border-slate-700' : 'bg-white text-gray-500 border-gray-200')}`}><UserCircle className="w-4 h-4" /> 一般業務</button>
                           <button type="button" onClick={() => setForm({...form, role: 'admin'})} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${form.role === 'admin' ? 'bg-purple-600 text-white border-purple-600' : (darkMode ? 'bg-slate-800 text-gray-400 border-slate-700' : 'bg-white text-gray-500 border-gray-200')}`}><ShieldCheck className="w-4 h-4" /> 管理員</button>
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">驗證碼</label>
                        <div className="flex gap-2 mt-1">
                            <div className="bg-gray-200 dark:bg-slate-700 px-4 py-2 rounded-xl font-mono text-lg tracking-widest flex items-center justify-center select-none text-slate-600 dark:text-slate-300 w-32 border-2 border-dashed border-gray-400/50" style={{textDecoration: 'line-through'}}>
                                {captcha}
                            </div>
                            <button type="button" onClick={generateCaptcha} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 transition-colors"><RefreshCcw className="w-5 h-5 text-gray-500"/></button>
                            <input type="text" required className={`flex-1 px-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`} value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} placeholder="輸入驗證碼" />
                        </div>
                     </div>
                     {form.role === 'admin' && (
                       <div className="animate-in fade-in slide-in-from-top-2">
                          <label className="text-xs font-bold text-purple-500 uppercase ml-1 flex items-center gap-1"><Key className="w-3 h-3" /> 註冊碼</label>
                          <input type="password" required className={`w-full px-4 py-3 rounded-xl border-2 border-purple-100 outline-none mt-1 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-purple-50/50'}`} value={form.adminCode} onChange={e => setForm({...form, adminCode: e.target.value})} placeholder="請輸入註冊碼" />
                          {/* [修正] 已移除文字提示 */}
                       </div>
                     )}
                 </div>
               )}
               <button disabled={loading || !!usernameError} className={`w-full py-4 rounded-xl font-bold text-white text-lg mt-6 shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${loading || !!usernameError ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading && <Loader2 className="w-5 h-5 animate-spin" />}{isRegister ? '註冊帳號' : '登入系統'}</button>
            </form>
            <div className="mt-6 text-center"><button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-500 hover:text-blue-500 font-medium">{isRegister ? '已有帳號？點此登入' : '沒有帳號？註冊一個'}</button></div>
         </div>
      </div>
    );
  };

  const CustomerForm = ({ onSubmit, onCancel, initialData }) => {
    // ... (CustomerForm implementation remains same)
    const [formData, setFormData] = useState(initialData || { 
      name: '', gender: '男', category: '買方', level: 'C', company: '', phone: '', secondaryAgent: '', 
      value: '', contactTime: '', source: '其他', project: '', address: '', reqRegion: '', reqPing: '', 
      status: 'potential', remarks: '', email: '', businessCard: '',
      createdAt: formatDateString(new Date()) 
    });
    
    useEffect(() => {
        if (initialData && initialData.createdAt) {
            setFormData(prev => ({
                ...prev,
                createdAt: formatDateString(getDateFromFirestore(initialData.createdAt))
            }));
        }
    }, [initialData]);

    const [isProcessingImg, setIsProcessingImg] = useState(false);

    // [新增] 根據所選專案動態更新「從何得知」選單 (只顯示名稱)
    const availableSources = useMemo(() => {
        const baseSources = DEFAULT_SOURCES;
        let sources = [...baseSources];
        
        if (formData.project && projectAds[formData.project]) {
            // 從物件陣列中提取名稱，若為舊版字串則直接使用
            const ads = projectAds[formData.project].map(ad => typeof ad === 'string' ? ad : ad.name);
            sources = [...sources, ...ads];
        }
        // 使用 Set 去除重複項目，避免 key 重複錯誤
        return [...new Set(sources)];
    }, [formData.project, projectAds]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsProcessingImg(true);
            try {
                const compressedDataUrl = await resizeImage(file);
                setFormData({ ...formData, businessCard: compressedDataUrl });
            } catch (error) {
                alert("圖片處理失敗，請重試");
            } finally {
                setIsProcessingImg(false);
            }
        }
    };

    return (
      <div className={`p-4 min-h-screen ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-800'}`}>
        <div className={`${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'} rounded-xl shadow-sm border max-w-4xl mx-auto overflow-hidden`}>
          <div className="p-4 border-b dark:border-slate-800 flex items-center">
            <button onClick={onCancel} className="mr-3 text-gray-500 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><ArrowLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold">{initialData ? '編輯客戶資料' : '新增客戶資料'}</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...formData, value: Number(formData.value) }); }} className="p-6 space-y-6">
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest border-b pb-2">基本資料</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                    <label className="text-xs font-bold text-yellow-600 dark:text-yellow-500 mb-1 block flex items-center gap-1">
                        <CalendarDays className="w-3 h-3"/> 建檔日期 (補登用)
                    </label>
                    <input type="date" required className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} 
                        value={formData.createdAt} 
                        onChange={e => setFormData({...formData, createdAt: e.target.value})} 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">客戶姓名 *</label><input required className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">性別</label><select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}><option value="男">男</option><option value="女">女</option></select></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">公司名稱</label><input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">聯絡電話</label><input type="tel" className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">Email</label><input type="email" className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">可聯絡時間</label><input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.contactTime} onChange={e => setFormData({...formData, contactTime: e.target.value})} placeholder="例：平日下午" /></div>
                </div>
                <div><label className="text-xs font-bold text-gray-400 mb-1 block">通訊地址</label><input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            </div>
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest border-b pb-2">需求分析</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">需求分類</label><select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">客戶級別</label><select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">關注案場</label>
                        <select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})}>
                            <option value="">請選擇...</option>
                            {Object.entries(companyProjects).map(([region, sites]) => (
                            <optgroup key={region} label={region}>
                                {sites.map(site => <option key={site} value={site}>{site}</option>)}
                            </optgroup>
                            ))}
                        </select>
                    </div>
                    {/* [修改] 來源選單現在會顯示該案場的廣告選項 */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">從何得知</label>
                        <select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                            {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">需求地區</label><input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.reqRegion} onChange={e => setFormData({...formData, reqRegion: e.target.value})} placeholder="例：屏東萬丹" /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">需求坪數</label><input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.reqPing} onChange={e => setFormData({...formData, reqPing: e.target.value})} placeholder="例：100坪" /></div>
                    <div><label className="text-xs font-bold text-gray-400 mb-1 block">預算 (NTD)</label><input type="number" className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} /></div>
                </div>
                <div className="w-full">
                   <label className="text-xs font-bold text-gray-400 mb-1 block">次要專員</label>
                   <input className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.secondaryAgent} onChange={e => setFormData({...formData, secondaryAgent: e.target.value})} />
                </div>
                <div><label className="text-xs font-bold text-gray-400 mb-1 block">其他備註</label><textarea rows="2" className={`w-full px-3 py-2 border rounded-lg outline-none resize-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} /></div>
            </div>
            <div className="space-y-4">
               <h3 className="text-sm font-bold text-blue-500 uppercase tracking-widest border-b pb-2">狀態與附件</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div><label className="text-xs font-bold text-gray-400 mb-1 block">目前狀態</label><select className={`w-full px-3 py-2 border rounded-lg outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                   <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">上傳名片 (圖片)</label>
                      <div className={`flex items-center space-x-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          <label className={`cursor-pointer flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-800 ${isProcessingImg ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {isProcessingImg ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />} {isProcessingImg ? "壓縮處理中..." : "選擇檔案"}
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isProcessingImg} onClick={(e) => e.target.value = null} />
                          </label>
                          {formData.businessCard ? <span className="text-green-500 text-xs flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> 已選取</span> : <span className="text-xs text-gray-400">尚未上傳</span>}
                      </div>
                      {formData.businessCard && (<div className="mt-2 w-24 h-16 rounded overflow-hidden border border-gray-200 relative group"><img src={formData.businessCard} alt="名片預覽" className="w-full h-full object-cover" /><button type="button" onClick={() => setFormData({...formData, businessCard: ''})} className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"><XCircle className="w-3 h-3"/></button></div>)}
                   </div>
               </div>
            </div>
            <button disabled={isProcessingImg} className={`w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-blue-700 shadow-lg active:scale-[0.99] transition-all ${isProcessingImg ? 'opacity-50 cursor-not-allowed' : ''}`}>{isProcessingImg ? '處理圖片中...' : '儲存客戶資料'}</button>
          </form>
        </div>
      </div>
    );
  };
  
  const CustomerDetail = ({ customer }) => {
    // Basic detail view (simplified) to ensure completeness
    const [notes, setNotes] = useState(customer.notes || []);
    const [noteContent, setNoteContent] = useState('');
    
    // [修改] 權限判斷：只有當登入者是客戶擁有者時，才顯示操作按鈕
    const isOwner = customer.owner === currentUser.username;

    return (
        <div className={`min-h-screen p-4 ${darkMode ? 'dark bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
             <div className="max-w-4xl mx-auto space-y-4">
                 <button onClick={() => setView('list')} className="flex items-center text-sm text-gray-500 mb-2"><ArrowLeft className="w-4 h-4 mr-1"/> 返回列表</button>
                 <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                     <div className="flex justify-between items-start">
                         <div>
                             <h2 className="text-2xl font-bold">{customer.name}</h2>
                             <p className="text-sm opacity-60 mt-1">{customer.company}</p>
                         </div>
                         {/* 僅本人可見編輯按鈕 */}
                         {isOwner && (
                             <div className="flex gap-2">
                                 <button onClick={() => setView('edit')} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Edit className="w-5 h-5"/></button>
                                 <button onClick={() => setShowDeleteModal(true)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-5 h-5"/></button>
                             </div>
                         )}
                     </div>
                     <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                         <div><p className="opacity-50 text-xs">電話</p><p className="font-medium">{customer.phone}</p></div>
                         <div><p className="opacity-50 text-xs">Email</p><p className="font-medium">{customer.email || '-'}</p></div>
                         <div><p className="opacity-50 text-xs">案場</p><p className="font-medium">{customer.project || '-'}</p></div>
                         <div><p className="opacity-50 text-xs">預算</p><p className="font-medium">NT$ {customer.value?.toLocaleString()}</p></div>
                     </div>
                 </div>

                 {/* Notes Section */}
                 <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                     <h3 className="font-bold mb-4">記事本</h3>
                     <div className="flex gap-2 mb-4">
                         <input value={noteContent} onChange={e=>setNoteContent(e.target.value)} placeholder="新增記事..." className={`flex-1 px-4 py-2 rounded-xl border outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}`} />
                         <button onClick={() => { if(noteContent) { handleAddNote(customer.id, noteContent, 'text'); setNoteContent(''); } }} className="bg-blue-600 text-white px-4 rounded-xl font-bold">發送</button>
                     </div>
                     <div className="space-y-3">
                         {notes.length === 0 ? <p className="text-center text-gray-400 py-4">尚無記事</p> : notes.slice().reverse().map((n, i) => (
                             <div key={i} className={`p-3 rounded-xl text-sm ${darkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
                                 <div className="flex justify-between mb-1 opacity-60 text-xs"><span>{n.author}</span><span>{n.date}</span></div>
                                 <p>{n.content}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
             
             {/* Delete Confirmation for Customer */}
             {showDeleteModal && isOwner && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl ${darkMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                        <h3 className="text-lg font-bold mb-2 text-red-500 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> 刪除客戶</h3>
                        <p className="text-sm opacity-80 mb-6">確定要刪除「{customer.name}」的所有資料嗎？此操作無法復原。</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300">取消</button>
                            <button onClick={handleDeleteCustomer} className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700">刪除</button>
                        </div>
                    </div>
                </div>
             )}
        </div>
    );
  };

  // --- Render Flow ---
  if (!sessionUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  if (view === 'login') return <LoginScreen />;
  if (view === 'add') return <CustomerForm onSubmit={handleAddCustomer} onCancel={() => setView('list')} />;
  if (view === 'edit' && selectedCustomer) return <CustomerForm onSubmit={handleEditCustomer} onCancel={() => setView('detail')} initialData={selectedCustomer} />;
  if (view === 'detail' && selectedCustomer) return <CustomerDetail customer={selectedCustomer} />;

  return (
    <div className={`min-h-screen w-full transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-800'} overflow-x-hidden`}>
      {activeTab === 'clients' ? renderClientsTab() : renderDashboardTab()}
      
      {/* 底部導航 */}
      <div className={`fixed bottom-0 w-full border-t flex justify-around items-center py-2 z-40 transition-colors ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-200'}`}>
        <button onClick={() => setActiveTab('clients')} className={`flex flex-col items-center p-2 rounded-xl w-20 ${activeTab === 'clients' ? 'text-blue-500' : 'text-gray-400'}`}><List className={`w-6 h-6 mb-1 ${activeTab === 'clients' ? 'stroke-[3px]' : ''}`} /><span className="text-[10px] font-bold">列表</span></button>
        {isAdmin ? (
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-xl w-20 ${activeTab === 'dashboard' ? 'text-blue-500' : 'text-gray-400'}`}><LayoutDashboard className={`w-6 h-6 mb-1 ${activeTab === 'dashboard' ? 'stroke-[3px]' : ''}`} /><span className="text-[10px] font-bold">後台</span></button>
        ) : (
          <div className="w-20 opacity-20 flex flex-col items-center p-2 cursor-not-allowed"><Lock className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">後台</span></div>
        )}
      </div>

      {/* 刪除/管理確認視窗 (Modal) */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl transform transition-all ${darkMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                <div className="flex items-center gap-3 mb-4 text-red-500">
                    <div className="p-2 bg-red-100 rounded-full"><Trash2 className="w-6 h-6 text-red-600" /></div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">確認刪除</h3>
                </div>
                <p className="text-sm opacity-80 mb-6 leading-relaxed">
                    {pendingDelete.type === 'region' 
                        ? `確定要刪除分類「${pendingDelete.region}」及其下的所有案場嗎？` 
                        : pendingDelete.type === 'project'
                        ? `確定要刪除案場「${pendingDelete.item}」嗎？`
                        : `確定要刪除使用者「${pendingDelete.item.name}」嗎？`}
                    <br/><span className="text-red-500 font-bold text-xs mt-1 block">此操作無法復原。</span>
                </p>
                <div className="flex gap-3">
                    <button onClick={() => setPendingDelete(null)} className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">取消</button>
                    <button onClick={executeDelete} className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all active:scale-95">確認刪除</button>
                </div>
            </div>
        </div>
      )}

      {/* [新增] 廣告管理 Modal - 支援日期設定 */}
      {adManageProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl transform transition-all max-h-[80vh] overflow-y-auto ${darkMode ? 'bg-slate-900 text-white' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Megaphone className="w-5 h-5 text-blue-500"/> 廣告管理: <span className="text-blue-600">{adManageProject}</span></h3>
                    <button onClick={() => { setAdManageProject(null); setIsEditingAd(false); }}><XCircle className="w-5 h-5 opacity-50 hover:opacity-100"/></button>
                </div>
                
                {/* 廣告輸入表單 */}
                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-gray-400 uppercase">{isEditingAd ? '編輯廣告' : '新增廣告'}</h4>
                    <input 
                        value={adForm.name} 
                        onChange={(e) => setAdForm({...adForm, name: e.target.value})}
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                        placeholder="廣告名稱 (如: FB-大成一期)"
                    />
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">開始日期</label>
                            <input 
                                type="date"
                                value={adForm.startDate} 
                                onChange={(e) => setAdForm({...adForm, startDate: e.target.value})}
                                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">結束日期</label>
                            <input 
                                type="date"
                                value={adForm.endDate} 
                                onChange={(e) => setAdForm({...adForm, endDate: e.target.value})}
                                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        {isEditingAd && <button onClick={() => { setIsEditingAd(false); setAdForm({ id: '', name: '', startDate: '', endDate: '' }); }} className="flex-1 py-2 rounded-lg text-sm bg-gray-200 text-gray-600">取消</button>}
                        <button onClick={handleSaveAd} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-blue-700">
                           {isEditingAd ? <Save className="w-4 h-4"/> : <Plus className="w-4 h-4"/>} {isEditingAd ? '儲存變更' : '新增廣告'}
                        </button>
                    </div>
                </div>

                {/* 廣告列表 */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">現有廣告 ({ (projectAds[adManageProject] || []).length })</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {(projectAds[adManageProject] || []).length === 0 ? <p className="text-xs text-gray-400 text-center py-4 border dashed border-gray-300 rounded-lg">尚無廣告設定</p> : 
                            (projectAds[adManageProject] || []).map((ad, idx) => {
                                const adObj = typeof ad === 'string' ? { id: idx, name: ad, endDate: '' } : ad;
                                const daysLeft = getDaysLeft(adObj.endDate);
                                let badgeColor = 'bg-gray-100 text-gray-500';
                                if (daysLeft !== null) {
                                    if (daysLeft > 7) badgeColor = 'bg-green-100 text-green-600';
                                    else if (daysLeft > 0) badgeColor = 'bg-yellow-100 text-yellow-600';
                                    else badgeColor = 'bg-red-100 text-red-600';
                                }

                                return (
                                    <div key={adObj.id || idx} className={`flex flex-col p-3 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold">{adObj.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEditAdInit(ad)} className="text-blue-500 hover:text-blue-700 p-1"><Edit className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteAd(adObj.id || adObj.name)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="text-gray-400 flex items-center gap-1">
                                                <Calendar className="w-3 h-3"/>
                                                {adObj.startDate || '-'} ~ {adObj.endDate || '-'}
                                            </div>
                                            {daysLeft !== null && (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${badgeColor}`}>
                                                    <Timer className="w-3 h-3"/> {daysLeft > 0 ? `剩 ${daysLeft} 天` : '已結束'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
}