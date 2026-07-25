/* eslint-disable no-unused-vars */
// ══════════════════════════════════════════════════════════════════════════
// خريطة الملف (691 سطر) — بخلاف HRPage.js وAccountsPage.js، هذا الملف مكوّن
// واحد بتبويبات مُعرَّضة (conditional rendering) لا دوال منفصلة، فتقسيمه
// يحتاج تمرير الحالة/الدوال المشتركة كـ props (أكثر تعقيداً) — الأسطر التالية
// لتسهيل التنقل بالانتظار:
//   السطر 245  تبويب المستخدمين (users)
//   السطر 330  تبويب المظهر (appearance)
//   السطر 358  تبويب النظام (system)
//   السطر 380  تبويب المنشآت (hospitals)
//   السطر 479  تبويب النسخ الاحتياطي (backups)
//   السطر 531  تبويب حول النظام (about)
// ══════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { useT } from '../translations';
import { useApp, ALL_PAGES } from '../contexts/AppContext';
import { api, SERVER_BASE_URL } from '../api';
import BackupDestinationModal from '../components/BackupDestinationModal';
const ROLES = ['admin','doctor','nurse','receptionist','accountant','hr'];
const ROLE_LABELS = (tr) => ({
  admin: tr('role_admin'),
  doctor: tr('role_doctor'),
  nurse: tr('role_nurse'),
  receptionist: tr('role_receptionist'),
  accountant: tr('role_accountant'),
  hr: tr('role_hr'),
});
const emptyUser = { name:'', username:'', password:'', email:'', role:'doctor', jobTitle:'', avatar:'م', color:'#1a6bab', permissions:[] };
const COLORS = ['#1a6bab','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#ef4444','#6366f1'];

export default function SettingsPage() {
  const { theme, toggleTheme, lang, setLang, showToast, user, systemUsers, setSystemUsers, syncToServer, confirmDialog, hospitals, multiHospitalEnabled, reloadHospitalsAndMode, fetchRecycleBin, restoreFromRecycleBin, purgeFromRecycleBin } = useApp();
  const tr = useT(lang);
  const [tab, setTab] = useState('users');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [showPass, setShowPass] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restoringName, setRestoringName] = useState(null);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [showHospModal, setShowHospModal] = useState(false);
  const [editingHosp, setEditingHosp] = useState(null);
  const [hospForm, setHospForm] = useState({ nameAr:'', nameEn:'', address:'', phone:'', enabledPages: [] });
  const [resetPasswordResult, setResetPasswordResult] = useState(null); // { userName, tempPassword }
  const [resettingUserId, setResettingUserId] = useState(null);

  const openAdd = () => { setEditing(null); setForm(emptyUser); setShowModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ ...u, password: u.password || '' }); setShowModal(true); };
  const delUser = async (id) => {
    if (id === 1) { showToast(tr('set_cannot_delete_admin'), 'error'); return; }
    if (!(await confirmDialog(tr('x_hlantmtakd_laimknaltraja')))) return;
    const prev = systemUsers;
    setSystemUsers(p => p.filter(u => u.id !== id));
    const ok = await syncToServer('users', 'delete', { id });
    if (!ok) { setSystemUsers(prev); return; }
    showToast(tr('msg_deleted'), 'success');
  };

  const togglePerm = (key) => {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(key)
        ? p.permissions.filter(k => k !== key)
        : [...p.permissions, key]
    }));
  };

  // إعادة ضبط كلمة مرور مستخدم لكلمة مؤقتة عشوائية (يولّدها الخادم) — بدون
  // نظام بريد إلكتروني بالمشروع، هذي أبسط وأضمن طريقة عملية: الإدمن يشوف
  // الكلمة المؤقتة *مرة وحدة* هنا، ويوصّلها للمستخدم يدوياً (هاتف/حضورياً).
  // المستخدم يُجبَر تلقائياً على تغييرها بأول تسجيل دخول (mustChangePassword).
  const resetPassword = async (u) => {
    setResettingUserId(u.id);
    try {
      const res = await api.post(`/users/${u.id}/reset-password`, {});
      setResetPasswordResult({ userName: u.name, tempPassword: res.tempPassword });
    } catch (err) {
      showToast(err.message || (lang === 'ar' ? 'فشلت إعادة الضبط' : 'Reset failed'), 'error');
    } finally {
      setResettingUserId(null);
    }
  };

  const setRoleDefaults = (role) => {
    const defaults = {
      admin: ALL_PAGES.map(p => p.key),
      doctor: ['dashboard','services','patients','appointments','medical-leave','vaccinations','wards','delivery'],
      nurse: ['dashboard','patients','appointments','vaccinations','medical-leave','wards','delivery','queue'],
      receptionist: ['dashboard','patients','appointments','departments','services','queue'],
      accountant: ['dashboard','accounts','smart-reports'],
      hr: ['dashboard','hr','medical-leave','smart-reports'] };
    setForm(p => ({ ...p, role, permissions: defaults[role] || ['dashboard'] }));
  };

  const save = async () => {
    if (!form.name || !form.username || (!editing && !form.password)) { showToast(tr('set_user_required'), 'error'); return; }
    if (!editing && systemUsers.find(u => u.username === form.username)) { showToast(tr('set_username_exists'), 'error'); return; }
    const prev = systemUsers;
    if (editing) {
      const uu = { ...form, id: editing.id };
      setSystemUsers(p => p.map(u => u.id === editing.id ? uu : u));
      const ok = await syncToServer('users', 'update', uu); // الباك إند يشفّر كلمة المرور تلقائياً بـ bcrypt
      if (!ok) { setSystemUsers(prev); return; }
      showToast(tr('msg_edited'), 'success');
    } else {
      const nu = { ...form, id: Date.now() };
      setSystemUsers(p => [...p, nu]);
      const ok = await syncToServer('users', 'create', nu); // الباك إند يشفّر كلمة المرور تلقائياً بـ bcrypt
      if (!ok) { setSystemUsers(prev); return; }
      showToast(tr('msg_added'), 'success');
    }
    setShowModal(false);
  };

  const tabs = [
    { key: 'users',      labelKey: 'set_tab_users',      icon: '👥' },
    { key: 'appearance', labelKey: 'set_tab_appearance',  icon: '🎨' },
    { key: 'system',     labelKey: 'set_tab_system',      icon: '⚙️' },
    ...(user?.role === 'admin' ? [{ key: 'hospitals', labelKey: 'set_tab_hospitals', icon: '🏥' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'backups', labelKey: 'set_tab_backups', icon: '💾' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'recycle', labelKey: 'set_tab_recycle', icon: '🗑️' }] : []),
    { key: 'about',      labelKey: 'set_tab_about',       icon: 'ℹ️' },
  ];

  const roleColor = (r) => ({ admin:'#ef4444', doctor:'#1a6bab', nurse:'#8b5cf6', receptionist:'#10b981', accountant:'#f59e0b', hr:'#06b6d4' }[r] || '#6b7280');

  // ── النسخ الاحتياطي ──────────────────────────────────────────────────────
  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const list = await api.get('/backups');
      setBackups(list);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setBackupsLoading(false);
  };

  const handleBackupConfirm = async ({ destination, cloudUrl }) => {
  setBackupRunning(true);
  try {
    if (destination === 'computer') {
      // نطلب من المستخدم مكان الحفظ *قبل* أي await، لأن المتصفح يشترط إن
      // showSaveFilePicker يُستدعى مباشرة داخل سلسلة استدعاء ناتجة عن ضغطة
      // المستخدم (user activation) — لو استدعيناها بعد fetch (أي بعد await)،
      // بعض المتصفحات ترفضها بخطأ "not allowed".
      let fileHandle = null;
      const supportsFilePicker = typeof window.showSaveFilePicker === 'function';
      if (supportsFilePicker) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: 'sihatuna_backup.sql',
            types: [{ description: 'SQL Backup', accept: { 'application/sql': ['.sql'] } }],
          });
        } catch (pickerErr) {
          // المستخدم ألغى نافذة الاختيار — نوقف العملية بهدوء بدون رسالة خطأ
          if (pickerErr.name === 'AbortError') { setBackupRunning(false); setShowBackupModal(false); return; }
          throw pickerErr;
        }
      }

      const response = await fetch(`${SERVER_BASE_URL}/api/backups/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ destination, cloudUrl }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || tr('backup_failed'));
      }
      const blob = await response.blob();

      if (fileHandle) {
        // مسار المتصفحات الحديثة (Chrome/Edge): كتابة الملف مباشرة بالمكان
        // اللي اختاره المستخدم بالضبط — بدون المرور بمجلد Downloads إطلاقاً
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // مسار احتياطي (Firefox/Safari اللي ما تدعم showSaveFilePicker):
        // نرجع لطريقة التنزيل التلقائي القديمة لمجلد Downloads
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sihatuna_backup.sql';
        a.click();
        window.URL.revokeObjectURL(url);
      }
      showToast(tr('backup_created'), 'success');
    } else {
      const res = await api.post('/backups/run', { destination, cloudUrl });
      setBackups(res.backups);
      showToast(res.message || tr('backup_created'), 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
  setBackupRunning(false);
  setShowBackupModal(false);
};

  const restoreBackup = async (name) => {
    if (!(await confirmDialog(tr('restore_confirm')))) return;
    setRestoringName(name);
    try {
      await api.post(`/backups/${name}/restore`);
      showToast(tr('backup_restored'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setRestoringName(null);
  };

  React.useEffect(() => {
    if (tab === 'backups') loadBackups();
    if (tab === 'recycle') loadRecycleBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── سلة المحذوفات ────────────────────────────────────────────────────────
  const [recycleItems, setRecycleItems] = useState([]);
  const [recycleLoading, setRecycleLoading] = useState(false);
  const [recycleBusyId, setRecycleBusyId] = useState(null);
  const [recycleBulkBusy, setRecycleBulkBusy] = useState(false);
  // إصلاح: زر استرجاع/حذف نهائي كان لكل عنصر لحاله فقط — لو عندك عشرات
  // العناصر بسلة المحذوفات، تحتاجين تضغطين لكل واحد لحاله. الآن تقدرين
  // تحددين عدة عناصر بمربعات اختيار وتسوين الإجراء على الكل مرة وحدة.
  const [selectedRecycleIds, setSelectedRecycleIds] = useState(new Set());
  const toggleRecycleSelect = (id) => setSelectedRecycleIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAllRecycle = () => setSelectedRecycleIds(prev =>
    prev.size === recycleItems.length ? new Set() : new Set(recycleItems.map(r => r.id))
  );

  const loadRecycleBin = async () => {
    setRecycleLoading(true);
    setRecycleItems(await fetchRecycleBin());
    setRecycleLoading(false);
    setSelectedRecycleIds(new Set());
  };

  const restoreItem = async (item) => {
    setRecycleBusyId(item.id);
    const result = await restoreFromRecycleBin(item.id);
    setRecycleBusyId(null);
    if (!result) return;
    showToast(result.idChanged ? tr('recycle_restored_new_id') : tr('recycle_restored'), 'success');
    setRecycleItems(prev => prev.filter(r => r.id !== item.id));
    setSelectedRecycleIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
  };

  const purgeItem = async (item) => {
    if (!(await confirmDialog(tr('recycle_purge_confirm')))) return;
    setRecycleBusyId(item.id);
    const ok = await purgeFromRecycleBin(item.id);
    setRecycleBusyId(null);
    if (!ok) return;
    showToast(tr('recycle_purged'), 'success');
    setRecycleItems(prev => prev.filter(r => r.id !== item.id));
    setSelectedRecycleIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
  };

  const restoreSelected = async () => {
    const ids = [...selectedRecycleIds];
    if (ids.length === 0) return;
    setRecycleBulkBusy(true);
    let restored = 0, idChanged = 0;
    for (const id of ids) {
      const result = await restoreFromRecycleBin(id);
      if (result) { restored++; if (result.idChanged) idChanged++; setRecycleItems(prev => prev.filter(r => r.id !== id)); }
    }
    setRecycleBulkBusy(false);
    setSelectedRecycleIds(new Set());
    showToast(
      lang === 'ar'
        ? `تم استرجاع ${restored} من ${ids.length}${idChanged ? ` (${idChanged} برقم جديد بسبب تعارض)` : ''}`
        : `Restored ${restored} of ${ids.length}${idChanged ? ` (${idChanged} with a new ID due to conflict)` : ''}`,
      restored === ids.length ? 'success' : 'warning'
    );
  };

  const purgeSelected = async () => {
    const ids = [...selectedRecycleIds];
    if (ids.length === 0) return;
    if (!(await confirmDialog(lang === 'ar' ? `حذف نهائي لـ ${ids.length} عنصر؟ لا يمكن التراجع عن هذا إطلاقاً.` : `Permanently delete ${ids.length} items? This absolutely cannot be undone.`))) return;
    setRecycleBulkBusy(true);
    let purged = 0;
    for (const id of ids) {
      const ok = await purgeFromRecycleBin(id);
      if (ok) { purged++; setRecycleItems(prev => prev.filter(r => r.id !== id)); }
    }
    setRecycleBulkBusy(false);
    setSelectedRecycleIds(new Set());
    showToast(lang === 'ar' ? `تم حذف ${purged} من ${ids.length} نهائياً` : `Permanently deleted ${purged} of ${ids.length}`, purged === ids.length ? 'success' : 'warning');
  };

  // ── المنشآت المتعددة (مرحلة تأسيسية) ────────────────────────────────────
  const loadHospitals = async () => {
    setHospitalsLoading(true);
    await reloadHospitalsAndMode();
    setHospitalsLoading(false);
  };

  const toggleMultiHospitalMode = async () => {
    setTogglingMode(true);
    const next = !multiHospitalEnabled;
    try {
      await api.put('/system-settings/multi_hospital_enabled', { value: next });
      await reloadHospitalsAndMode();
      showToast(tr('msg_saved'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setTogglingMode(false);
  };

  const openAddHosp = () => { setEditingHosp(null); setHospForm({ nameAr:'', nameEn:'', address:'', phone:'', enabledPages: [] }); setShowHospModal(true); };
  const openEditHosp = (h) => { setEditingHosp(h); setHospForm({ nameAr:h.name_ar, nameEn:h.name_en, address:h.address||'', phone:h.phone||'', enabledPages: h.enabled_pages || [] }); setShowHospModal(true); };
  const toggleHospPage = (pageKey) => setHospForm(p => ({
    ...p,
    enabledPages: p.enabledPages.includes(pageKey) ? p.enabledPages.filter(k => k !== pageKey) : [...p.enabledPages, pageKey],
  }));

  const saveHospital = async () => {
    if (!hospForm.nameAr || !hospForm.nameEn) { showToast(tr('msg_required'), 'error'); return; }
    try {
      if (editingHosp) {
        await api.put(`/hospitals/${editingHosp.id}`, hospForm);
      } else {
        await api.post('/hospitals', hospForm);
      }
      await reloadHospitalsAndMode();
      showToast(tr('msg_saved'), 'success');
      setShowHospModal(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteHospital = async (id) => {
    if (!(await confirmDialog(tr('confirm_delete')))) return;
    try {
      await api.delete(`/hospitals/${id}`);
      await reloadHospitalsAndMode();
      showToast(tr('msg_deleted'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  React.useEffect(() => {
    if (tab === 'hospitals') loadHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="page-content">
      <div style={{ background:'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius:16, padding:'24px 28px', marginBottom:24, color:'#fff', display:'flex', alignItems:'center', gap:16 }}>
        <span style={{ fontSize:36 }}>⚙️</span>
        <div>
          <h1 style={{ margin:0, fontSize:22 }}>{tr('set_title')}</h1>
          <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:13 }}>{tr('set_subtitle')}</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20 }}>
        {/* Sidebar tabs */}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'11px 14px', borderRadius:10, border:'none', cursor:'pointer', textAlign:'right',
              background: tab === t.key ? '#1a6bab' : 'var(--bg-secondary)',
              color: tab === t.key ? '#fff' : 'var(--text-primary)',
              fontWeight: tab === t.key ? 700 : 400, fontSize:13,
              display:'flex', alignItems:'center', gap:8, fontFamily:'inherit' }}>
              <span>{t.icon}</span>{tr(t.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {/* ── USERS TAB ── */}
          {tab === 'users' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ margin:0 }}>{tr('set_users_title')} ({systemUsers.length})</h3>
                <button onClick={openAdd} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  + {tr('set_add_user')}
                </button>
              </div>

              <div style={{ display:'grid', gap:12 }}>
                {systemUsers.map(u => (
                  <div key={u.id} className="card" style={{ padding:'14px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:46, height:46, borderRadius:'50%', background:u.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:18, flexShrink:0 }}>{u.avatar}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{ fontWeight:700, fontSize:15 }}>{u.name}</span>
                          <span style={{ background:`${roleColor(u.role)}15`, color:roleColor(u.role), padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:700 }}>{ROLE_LABELS(tr)[u.role] || u.role}</span>
                          {u.id === user?.id && <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:8, fontSize:10, fontWeight:700 }}>{tr('set_you')}</span>}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>
                          👤 {u.username} | 📧 {u.email} | 💼 {u.jobTitle}
                        </div>
                        {/* Permissions pills */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {(u.permissions || []).slice(0, 8).map(pk => {
                            const pg = ALL_PAGES.find(p => p.key === pk);
                            return pg ? (
                              <span key={pk} style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', padding:'1px 7px', borderRadius:6, fontSize:10 }}>
                                {pg.icon} {tr(pg.navKey)}
                              </span>
                            ) : null;
                          })}
                          {(u.permissions || []).length > 8 && (
                            <span style={{ background:'var(--bg-primary)', color:'var(--text-secondary)', padding:'1px 7px', borderRadius:6, fontSize:10 }}>+{u.permissions.length - 8}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                        <button onClick={() => resetPassword(u)} disabled={resettingUserId === u.id} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'var(--text-primary)', fontSize:12 }}>
                          🔑 {resettingUserId === u.id ? (lang==='ar'?'جارٍ...':'...') : (lang==='ar'?'كلمة مرور مؤقتة':'Reset Password')}
                        </button>
                        <button onClick={() => openEdit(u)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'var(--text-primary)', fontSize:12 }}>✏️ {tr('btn_edit')}</button>
                        {u.id !== 1 && <button onClick={() => delUser(u.id)} style={{ background:'none', border:'1px solid #ef4444', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'#ef4444', fontSize:12 }}>🗑️ {tr('btn_delete')}</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── نافذة عرض كلمة المرور المؤقتة (مرة واحدة فقط) ── */}
          {resetPasswordResult && (
            <div className="modal-overlay" onClick={() => setResetPasswordResult(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>🔑 {lang === 'ar' ? 'كلمة مرور مؤقتة' : 'Temporary Password'}</h3>
                </div>
                <div className="modal-body">
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    {lang === 'ar'
                      ? `كلمة مرور مؤقتة جديدة لـ"${resetPasswordResult.userName}". انسخيها وأرسليها له الآن — لن تظهر مرة ثانية بعد إغلاق هذي النافذة. سيُطلب منه تغييرها بأول تسجيل دخول.`
                      : `New temporary password for "${resetPasswordResult.userName}". Copy and send it now — it will not be shown again. They will be required to change it on first login.`}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ flex: 1, background: 'var(--bg-secondary)', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 16, fontWeight: 700, textAlign: 'center', letterSpacing: 1, direction: 'ltr' }}>
                      {resetPasswordResult.tempPassword}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(resetPasswordResult.tempPassword); showToast(lang === 'ar' ? 'تم النسخ' : 'Copied', 'success'); }}
                      className="btn btn-outline"
                    >
                      📋 {lang === 'ar' ? 'نسخ' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => setResetPasswordResult(null)}>{lang === 'ar' ? 'تم، أغلقي' : 'Done, close'}</button>
                </div>
              </div>
            </div>
          )}

          {/* ── APPEARANCE TAB ── */}
          {tab === 'appearance' && (
            <div className="card">
              <h3 style={{ margin:'0 0 20px' }}>{tr('set_tab_appearance')}</h3>
              <div style={{ marginBottom:24 }}>
                <h4 style={{ margin:'0 0 12px', fontSize:14 }}>{tr('set_app_theme')}</h4>
                <div style={{ display:'flex', gap:12 }}>
                  {['light','dark'].map(t => (
                    <div key={t} onClick={() => { if (theme !== t) toggleTheme(); }} style={{ width:140, height:90, borderRadius:12, border:`3px solid ${theme===t ? '#1a6bab' : 'var(--border)'}`, cursor:'pointer', background:t==='dark'?'#0f1923':'#f8f9fa', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
                      <span style={{ fontSize:28 }}>{t==='dark'?'🌙':'☀️'}</span>
                      <span style={{ fontSize:12, color:t==='dark'?'#fff':'#333', fontWeight:600 }}>{t==='dark'?tr('theme_dark'):tr('theme_light')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ margin:'0 0 12px', fontSize:14 }}>{tr('set_language')}</h4>
                <div style={{ display:'flex', gap:12 }}>
                  {[{code:'ar',label:'العربية',flag:'🇮🇶'},{code:'en',label:'English',flag:'🇬🇧'}].map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)} style={{ padding:'12px 24px', borderRadius:10, border:`2px solid ${lang===l.code?'#1a6bab':'var(--border)'}`, background:lang===l.code?'rgba(26,107,171,0.1)':'transparent', color:lang===l.code?'#1a6bab':'var(--text-primary)', cursor:'pointer', fontSize:14, fontWeight:lang===l.code?700:400, display:'flex', alignItems:'center', gap:8 }}>
                      {l.flag} {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SYSTEM TAB ── */}
          {tab === 'system' && (
            <div className="card">
              <h3 style={{ margin:'0 0 20px' }}>{tr('set_title')}</h3>
              <div style={{ display:'grid', gap:14 }}>
                {[
                  { labelKey:'set_hospital_name', val:'مستشفى البصرة التعليمي' },
                  { labelKey:'set_license_no', val:'MOH-2024-001' },
                  { labelKey:'set_location', val:'البصرة، العراق' },
                  { labelKey:'set_official_email', val:'info@basrahospital.iq' },
                  { labelKey:'set_phone', val:'+964 770 000 0000' },
                ].map(item => (
                  <div key={tr(item.labelKey) || item.labelKey}>
                    <label className="form-label">{tr(item.labelKey) || item.labelKey}</label>
                    <input defaultValue={item.val} className="form-control" />
                  </div>
                ))}
                <button onClick={() => showToast(tr('msg_saved'),'success')} className="btn btn-primary" style={{ width:'fit-content' }}>💾 {tr('set_save_settings')}</button>
              </div>
            </div>
          )}

          {/* ── HOSPITALS TAB ── */}
          {tab === 'hospitals' && (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--border-color, #333)' }}>
                <div>
                  <h3 style={{ margin:'0 0 6px' }}>🏥 {tr('multi_hospital_mode')}</h3>
                  <p style={{ margin:0, fontSize:13, color:'var(--text-secondary)', maxWidth:480 }}>{tr('multi_hospital_desc')}</p>
                </div>
                <button
                  onClick={toggleMultiHospitalMode}
                  disabled={togglingMode}
                  style={{
                    width:52, height:28, borderRadius:14, border:'none', cursor:'pointer', position:'relative',
                    background: multiHospitalEnabled ? '#10b981' : 'var(--bg-secondary)', transition:'background .2s', flexShrink:0,
                  }}
                >
                  <span style={{
                    position:'absolute', top:3, [multiHospitalEnabled ? 'insetInlineEnd' : 'insetInlineStart']:3,
                    width:22, height:22, borderRadius:11, background:'#fff', transition:'inset-inline .2s',
                  }} />
                </button>
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h4 style={{ margin:0 }}>{tr('hospitals_list')}</h4>
                <button onClick={openAddHosp} className="btn btn-primary" style={{ fontSize:13 }}>+ {tr('btn_add_hospital')}</button>
              </div>

              {hospitalsLoading ? (
                <p style={{ color:'var(--text-secondary)' }}>...</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {hospitals.map(h => (
                    <div key={h.id} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary)',
                    }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>{h.name_ar} <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>({h.name_en})</span></div>
                        {(h.address || h.phone) && (
                          <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{h.address}{h.address && h.phone ? ' · ' : ''}{h.phone}</div>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => openEditHosp(h)} className="btn btn-outline" style={{ fontSize:12, padding:'6px 12px' }}>{tr('btn_edit')}</button>
                        <button onClick={() => deleteHospital(h.id)} className="btn btn-outline" style={{ fontSize:12, padding:'6px 12px', color:'#ef4444' }}>{tr('btn_delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showHospModal && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={() => setShowHospModal(false)}>
                  <div className="card" style={{ width:480, maxWidth:'90vw', maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ margin:'0 0 16px' }}>{editingHosp ? tr('btn_edit') : tr('btn_add_hospital')}</h3>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <label className="form-label">{tr('hospital_name_ar')}</label>
                        <input className="form-control" value={hospForm.nameAr} onChange={e => setHospForm({ ...hospForm, nameAr: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">{tr('hospital_name_en')}</label>
                        <input className="form-control" value={hospForm.nameEn} onChange={e => setHospForm({ ...hospForm, nameEn: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">{tr('hospital_address')}</label>
                        <input className="form-control" value={hospForm.address} onChange={e => setHospForm({ ...hospForm, address: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">{tr('hospital_phone')}</label>
                        <input className="form-control" value={hospForm.phone} onChange={e => setHospForm({ ...hospForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">{tr('hospital_enabled_pages')}</label>
                        <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 8px' }}>{tr('hospital_enabled_pages_desc')}</p>
                        <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid var(--border-color, #333)', borderRadius:8, padding:10, display:'flex', flexDirection:'column', gap:6 }}>
                          {ALL_PAGES.filter(p => p.key !== 'dashboard' && p.key !== 'settings').map(p => (
                            <label key={p.key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                              <input type="checkbox" checked={hospForm.enabledPages.includes(p.key)} onChange={() => toggleHospPage(p.key)} />
                              <span>{p.icon} {lang === 'ar' ? p.label : (p.labelEn || p.label)}</span>
                            </label>
                          ))}
                        </div>
                        <p style={{ fontSize:11, color:'var(--text-secondary)', margin:'6px 0 0' }}>
                          {hospForm.enabledPages.length === 0 ? tr('hospital_all_pages_enabled') : `${hospForm.enabledPages.length} ${tr('hospital_pages_selected')}`}
                        </p>
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        <button onClick={saveHospital} className="btn btn-primary" style={{ flex:1 }}>{tr('btn_save')}</button>
                        <button onClick={() => setShowHospModal(false)} className="btn btn-outline" style={{ flex:1 }}>{tr('btn_cancel')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BACKUPS TAB ── */}
          {tab === 'backups' && (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                <div>
                  <h3 style={{ margin:'0 0 6px' }}>💾 {tr('set_tab_backups')}</h3>
                  <p style={{ margin:0, fontSize:13, color:'var(--text-secondary)', maxWidth:520 }}>{tr('backups_desc')}</p>
                </div>
             <button
                      onClick={() => setShowBackupModal(true)}
                      disabled={backupRunning}
                      className="btn btn-primary"
                      style={{ whiteSpace:'nowrap' }}
>
                  {backupRunning ? `⏳ ${tr('backup_running')}` : `💾 ${tr('btn_backup_now')}`}
                </button>
              </div>

              <p style={{ fontSize:12, color:'var(--text-secondary)', background:'var(--bg-secondary)', padding:'10px 14px', borderRadius:8, marginBottom:16 }}>
                ℹ️ {tr('includes_pg_note')}
              </p>

              {backupsLoading ? (
                <p style={{ color:'var(--text-secondary)' }}>...</p>
              ) : backups.length === 0 ? (
                <p style={{ color:'var(--text-secondary)' }}>{tr('no_backups_yet')}</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto' }}>
                  {backups.map(b => (
                    <div key={b.name} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'10px 14px', borderRadius:8, background:'var(--bg-secondary)',
                    }}>
                      <span style={{ fontSize:13, fontFamily:'monospace' }}>
                        📁 {b.name.replace('T', ' ').slice(0, 19)}
                        {b.externalCopyExists && <span title={tr('external_copy_exists')} style={{ marginInlineStart:8 }}>💽</span>}
                      </span>
                      <button
                        onClick={() => restoreBackup(b.name)}
                        disabled={restoringName === b.name}
                        className="btn btn-outline"
                        style={{ fontSize:12, padding:'6px 12px' }}
                      >
                        {restoringName === b.name ? tr('restoring') : `♻️ ${tr('btn_restore')}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RECYCLE BIN TAB ── */}
          {tab === 'recycle' && (
            <div className="card">
              <h3 style={{ margin:'0 0 6px' }}>🗑️ {tr('set_tab_recycle')}</h3>
              <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--text-secondary)' }}>
                {lang === 'ar'
                  ? 'كل عملية حذف بالنظام تنقل السجل هنا بدل حذفه نهائياً — يمكنك استرجاعه لمكانه الأصلي أو حذفه نهائياً.'
                  : 'Every delete in the system moves the record here instead of erasing it — you can restore it or delete it permanently.'}
              </p>

              {recycleLoading ? (
                <p style={{ color:'var(--text-secondary)' }}>...</p>
              ) : recycleItems.length === 0 ? (
                <p style={{ color:'var(--text-secondary)' }}>{tr('recycle_empty')}</p>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12, padding:'8px 12px', borderRadius:8, background:'var(--bg-secondary)' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                      <input type="checkbox" checked={selectedRecycleIds.size === recycleItems.length && recycleItems.length > 0} onChange={toggleSelectAllRecycle} />
                      {lang === 'ar' ? `تحديد الكل (${selectedRecycleIds.size} محدَّد)` : `Select all (${selectedRecycleIds.size} selected)`}
                    </label>
                    {selectedRecycleIds.size > 0 && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={restoreSelected} disabled={recycleBulkBusy} className="btn btn-primary" style={{ fontSize:12, padding:'6px 12px' }}>
                          {recycleBulkBusy ? '...' : `♻️ ${lang === 'ar' ? `استرجاع المحدَّد (${selectedRecycleIds.size})` : `Restore Selected (${selectedRecycleIds.size})`}`}
                        </button>
                        <button onClick={purgeSelected} disabled={recycleBulkBusy} className="btn btn-outline" style={{ fontSize:12, padding:'6px 12px', color:'#ef4444', borderColor:'#ef4444' }}>
                          {recycleBulkBusy ? '...' : `🔥 ${lang === 'ar' ? `حذف نهائي للمحدَّد (${selectedRecycleIds.size})` : `Delete Selected Permanently (${selectedRecycleIds.size})`}`}
                        </button>
                      </div>
                    )}
                  </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:520, overflowY:'auto' }}>
                  {recycleItems.map(item => {
                    const label = item.data?.name || item.data?.title || item.data?.patientName
                      || item.data?.employee || item.data?.assetNo || item.data?.code
                      || item.data?.missionNo || item.data?.docNo || `#${item.originalId}`;
                    const busy = recycleBusyId === item.id;
                    return (
                      <div key={item.id} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8,
                        padding:'10px 14px', borderRadius:8, background: selectedRecycleIds.has(item.id) ? 'var(--bg-hover, #1a6bab15)' : 'var(--bg-secondary)',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <input type="checkbox" checked={selectedRecycleIds.has(item.id)} onChange={() => toggleRecycleSelect(item.id)} />
                          <div>
                            <div style={{ fontSize:13, fontWeight:600 }}>{label}</div>
                            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
                              {tr('recycle_module')}: {item.moduleKey} · {tr('recycle_deleted_by')}: {item.deletedByName || '—'} · {tr('recycle_deleted_at')}: {new Date(item.deletedAt).toLocaleString(lang==='ar'?'ar-IQ':'en-US')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button
                            onClick={() => restoreItem(item)}
                            disabled={busy}
                            className="btn btn-primary"
                            style={{ fontSize:12, padding:'6px 12px' }}
                          >
                            {busy ? '...' : `♻️ ${tr('recycle_restore')}`}
                          </button>
                          <button
                            onClick={() => purgeItem(item)}
                            disabled={busy}
                            className="btn btn-outline"
                            style={{ fontSize:12, padding:'6px 12px', color:'#ef4444', borderColor:'#ef4444' }}
                          >
                            {busy ? '...' : `🔥 ${tr('recycle_purge')}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}

          {/* ── ABOUT TAB ── */}
          {tab === 'about' && (
            <div>
              <div className="card" style={{ marginBottom:16, textAlign:'center', padding:'40px 20px' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#1a6bab,#0d3460)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, margin:'0 auto 16px' }}>🏥</div>
                <h2 style={{ margin:'0 0 6px', fontSize:24 }}>SIHATUNA IRAQ</h2>
                <div style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:4 }}>{tr('app_subtitle')}</div>
                <div style={{ background:'rgba(26,107,171,0.1)', color:'#1a6bab', display:'inline-block', padding:'3px 14px', borderRadius:12, fontSize:12, fontWeight:700 }}>{tr('set_version')} v3.0</div>
              </div>

              <div className="card" style={{ marginBottom:16 }}>
                <h4 style={{ margin:'0 0 16px', color:'var(--text-secondary)', fontSize:14 }}>👩‍💻 {tr('set_developer_info')}</h4>
                <div style={{ display:'grid', gap:12 }}>
                  {[
                    { icon:'👤', label: tr('set_about_name'), val:'Huda_Elmuthefer' },
                    { icon:'📧', label: tr('set_about_email'), val:'halmuthefer@gmail.com' },
                    { icon:'📱', label: tr('set_about_phone'), val:'+964 771 409 7770' },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 14px', background:'var(--bg-secondary)', borderRadius:10, border:'1px solid var(--border)' }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{item.label}</div>
                        <div style={{ fontWeight:600, fontSize:14, marginTop:2 }}>{item.val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ background:'rgba(26,107,171,0.05)', border:'1px solid rgba(26,107,171,0.2)' }}>
                <div style={{ textAlign:'center', fontSize:13, color:'var(--text-secondary)' }}>
                  <div style={{ fontSize:16, marginBottom:6 }}>© 2026 {tr('set_all_rights')}</div>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>Huda_Elmuthefer</div>
                  <div style={{ marginTop:4 }}>halmuthefer@gmail.com</div>
                  <div style={{ marginTop:8, fontSize:11, opacity:0.7 }}>{tr('set_developed_for')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── USER MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:680, maxHeight:'90vh', overflow:'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin:0 }}>{editing ? tr('set_edit_user') : tr('set_add_user')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div className="modal-body">
              {/* Basic info */}
              <div style={{ background:'var(--bg-primary)', borderRadius:10, padding:16, marginBottom:16 }}>
                <h4 style={{ margin:'0 0 14px', fontSize:14, color:'var(--text-secondary)' }}>{tr('set_account_info')}</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="form-label">{tr('set_full_name')} *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name:e.target.value, avatar:e.target.value[0]||'م' }))} className="form-control" />
                  </div>
                  <div>
                    <label className="form-label">{tr('set_username')}</label>
                    <input value={form.username} onChange={e => setForm(p => ({ ...p, username:e.target.value }))} className="form-control" />
                  </div>
                  <div>
                    <label className="form-label">{tr('set_password')}</label>
                    <div style={{ position:'relative' }}>
                      <input type={showPass?'text':'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password:e.target.value }))} className="form-control" style={{ paddingLeft:36 }} />
                      <button onClick={() => setShowPass(p=>!p)} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14 }}>{showPass?'🙈':'👁️'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">{tr('set_email')}</label>
                    <input value={form.email} onChange={e => setForm(p => ({ ...p, email:e.target.value }))} className="form-control" />
                  </div>
                  <div>
                    <label className="form-label">{tr('set_job_title')}</label>
                    <input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle:e.target.value }))} className="form-control" />
                  </div>
                  <div>
                    <label className="form-label">{tr('set_role')}</label>
                    <select value={form.role} onChange={e => setRoleDefaults(e.target.value)} className="form-control">
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS(tr)[r]}</option>)}
                    </select>
                  </div>
                  {multiHospitalEnabled && (
                    <div>
                      <label className="form-label">{tr('select_hospital_field')}</label>
                      <select value={form.hospitalId || ''} onChange={e => setForm(p => ({ ...p, hospitalId: e.target.value }))} className="form-control">
                        <option value="">{tr('super_admin_all_hospitals')}</option>
                        {hospitals.map(h => <option key={h.id} value={h.id}>{h.name_ar}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label">{tr('set_account_color')}</label>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {COLORS.map(c => <button key={c} onClick={() => setForm(p=>({...p,color:c}))} style={{ width:26, height:26, borderRadius:'50%', background:c, border:`3px solid ${form.color===c?'var(--text-primary)':'transparent'}`, cursor:'pointer' }} />)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div style={{ background:'var(--bg-primary)', borderRadius:10, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h4 style={{ margin:0, fontSize:14, color:'var(--text-secondary)' }}>{tr('set_allowed_pages')}</h4>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setForm(p=>({...p, permissions:ALL_PAGES.map(pg=>pg.key)}))} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #1a6bab', background:'transparent', color:'#1a6bab', cursor:'pointer' }}>{tr('btn_select_all')}</button>
                    <button onClick={() => setForm(p=>({...p, permissions:['dashboard']}))} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer' }}>{tr('btn_deselect_all')}</button>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {ALL_PAGES.map(pg => (
                    <label key={pg.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, border:`1px solid ${form.permissions.includes(pg.key)?'#1a6bab':'var(--border)'}`, background:form.permissions.includes(pg.key)?'rgba(26,107,171,0.08)':'transparent', cursor:'pointer' }}>
                      <input type="checkbox" checked={form.permissions.includes(pg.key)} onChange={() => togglePerm(pg.key)} style={{ accentColor:'#1a6bab' }} />
                      <span style={{ fontSize:16 }}>{pg.icon}</span>
                      <span style={{ fontSize:13 }}>{tr(pg.navKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} style={{ marginLeft:8, padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-primary)', cursor:'pointer' }}>{tr('btn_cancel')}</button>
              <button onClick={save} className="btn btn-primary">💾 {tr('set_save_user')}</button>
            </div>
          </div>
        </div>
      )}
{showBackupModal && (
  <BackupDestinationModal
    onClose={() => setShowBackupModal(false)}
    onConfirm={handleBackupConfirm}
  />
)}
      {/* ── RESET DATA SECTION ── */}
      <div style={{ marginTop:32, padding:'20px 24px', background:'var(--bg-secondary)', borderRadius:12, border:'2px dashed #ef4444' }}>
        <h3 style={{ color:'#ef4444', margin:'0 0 8px', fontSize:16 }}>⚠️ {lang==='ar'?'إعادة ضبط بيانات النظام':'Reset System Data'}</h3>
        <p style={{ color:'var(--text-secondary)', fontSize:13, margin:'0 0 16px' }}>
          {lang==='ar'
            ? 'يمسح جميع البيانات المحفوظة ويعيد تحميل البيانات الأصلية. استخدم هذا إذا ظهرت بيانات قديمة أو عربية في الصفحات الإنجليزية.'
            : 'Clears all saved data and reloads original data. Use this if old or Arabic data appears in English pages.'}
        </p>
        <button
          onClick={() => {
            // Save auth info
            const authUser  = localStorage.getItem('auth_user');
            const theme     = localStorage.getItem('theme');
            const lang_     = localStorage.getItem('lang');
            // Clear everything
            localStorage.clear();
            // Restore auth info
            if (authUser)  localStorage.setItem('auth_user',  authUser);
            if (theme)     localStorage.setItem('theme',      theme);
            if (lang_)     localStorage.setItem('lang',       lang_);
            showToast(lang==='ar'?'تم مسح البيانات القديمة، جاري إعادة التحميل...':'Old data cleared, reloading...','success');
            setTimeout(() => window.location.reload(), 1500);
          }}
          style={{ padding:'10px 24px', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}
        >
          🔄 {lang==='ar'?'إعادة ضبط البيانات':'Reset Data'}
        </button>
      </div>

    </div>
  );
}
