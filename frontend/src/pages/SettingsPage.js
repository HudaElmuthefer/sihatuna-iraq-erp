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
import { useSearchParams } from 'react-router-dom';
import { useT } from '../translations';
import { useApp, ALL_PAGES, DEFAULT_APP_NAME_AR, DEFAULT_APP_NAME_EN } from '../contexts/AppContext';
import { api, SERVER_BASE_URL, apiUploadFile } from '../api';
import BackupDestinationModal from '../components/BackupDestinationModal';
import AppLogo from '../components/AppLogo';
import PageBanner from '../components/PageBanner';
import { getDefaultHeaderText, getDefaultFooterText } from '../utils/printDefaults';
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
// تبويبات الإدمن (logo/appname/hospitals/backups/updates/recycle) مقبولة هنا
// حتى لغير الإدمن دون أي أثر أمني — الصفحة نفسها (أدناه، بمصفوفة tabs) هي
// من تفرض الفحص الفعلي بعرض المحتوى. مُعرَّفة بمستوى الملف (لا داخل المكوّن)
// حتى تبقى مرجعاً ثابتاً بين كل الـrenders، بنفس نمط HR_TAB_KEYS بـHRPage.js —
// لو بقيت داخل المكوّن لأصبحت مصفوفة جديدة بكل render، ما يجعل الاعتماد
// عليها بـuseEffect (أدناه) إما يُسبّب تحذير react-hooks/exhaustive-deps
// (لو أُغفلت) أو إعادة تنفيذ الـeffect بكل render (لو أُضيفت للاعتماديات).
const SETTINGS_TAB_KEYS = ['users', 'appearance', 'system', 'print', 'logo', 'appname', 'hospitals', 'backups', 'updates', 'recycle', 'about'];

export default function SettingsPage() {
  const { theme, toggleTheme, lang, setLang, showToast, user, systemUsers, setSystemUsers, syncToServer, confirmDialog, hospitals, multiHospitalEnabled, reloadHospitalsAndMode, fetchRecycleBin, restoreFromRecycleBin, purgeFromRecycleBin, printSettings, setPrintSettings, logoUrl, reloadLogo, appName, appNameAr, appNameEn, reloadAppName } = useApp();
  const tr = useT(lang);
  // القيمة الابتدائية تحترم ?tab= بالرابط (القائمة الجانبية القابلة للتوسّع
  // — راجعي components/Layout.js وconfig/sidebarSubTabs.js)، مع تجاهل أي
  // قيمة غير معروفة بدل عرض صفحة فارغة بصمت (SETTINGS_TAB_KEYS مُعرَّفة
  // بمستوى الملف أعلاه).
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab');
    return SETTINGS_TAB_KEYS.includes(fromUrl) ? fromUrl : 'users';
  });
  // الـuseState أعلاه يُنفَّذ مرة واحدة فقط عند التركيب — لا يكفي وحده حين
  // تُنقَّل من تبويب فرعي بالقائمة الجانبية لآخر بنفس هذه الصفحة (المسار
  // نفسه، ?tab= فقط يتغيّر)، فالصفحة تبقى مُثبَّتة وrouter لا يُعيد تركيبها.
  // هذا الـeffect يُحدِّث التبويب كلما تغيّر ?tab= فعلياً بالرابط، دون التأثير
  // على التبديل اليدوي (أزرار التبويبات لا تُغيّر الرابط أصلاً).
  React.useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (SETTINGS_TAB_KEYS.includes(fromUrl)) setTab(fromUrl);
  }, [searchParams]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [showPass, setShowPass] = useState(false);
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restoringName, setRestoringName] = useState(null);
  // ── نسخة احتياطية لكود المصدر — منفصلة تماماً عن نسخ البيانات أعلاه ──────────
  const [codeBackups, setCodeBackups] = useState([]);
  const [codeBackupsLoading, setCodeBackupsLoading] = useState(false);
  const [codeBackupRunning, setCodeBackupRunning] = useState(false);
  // ── نظام التحديثات (Stage 4) — git differential update ──────────────────
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);
  const [sourceInput, setSourceInput] = useState('');
  const [savingSource, setSavingSource] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [installResult, setInstallResult] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [showHospModal, setShowHospModal] = useState(false);
  const [editingHosp, setEditingHosp] = useState(null);
  const [hospForm, setHospForm] = useState({ nameAr:'', nameEn:'', address:'', phone:'', enabledPages: [] });
  const [resetPasswordResult, setResetPasswordResult] = useState(null); // { userName, tempPassword }
  const [resettingUserId, setResettingUserId] = useState(null);

  // ── شعار المنظمة (Logo) ──────────────────────────────────────────────────
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB — matches the backend's own limit (defense in depth, and a faster error for the user)
  const LOGO_ALLOWED_EXT = ['.png', '.jpg', '.jpeg'];

  const handleLogoFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setLogoFile(null); return; }
    const ext = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!LOGO_ALLOWED_EXT.includes(ext)) {
      showToast(lang === 'ar' ? 'الشعار لازم يكون PNG أو JPG' : 'Logo must be a PNG or JPG image', 'error');
      e.target.value = '';
      setLogoFile(null);
      return;
    }
    if (f.size > LOGO_MAX_BYTES) {
      showToast(lang === 'ar' ? 'حجم الملف أكبر من 2 ميغابايت' : 'File is larger than 2MB', 'error');
      e.target.value = '';
      setLogoFile(null);
      return;
    }
    setLogoFile(f);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setLogoUploading(true);
    try {
      await apiUploadFile('/branding/logo', logoFile);
      await reloadLogo();
      setLogoFile(null);
      showToast(lang === 'ar' ? 'تم رفع الشعار بنجاح' : 'Logo uploaded successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLogoUploading(false);
  };

  const handleLogoRemove = async () => {
    if (!(await confirmDialog(lang === 'ar' ? 'إزالة الشعار الحالي والرجوع للأيقونة الافتراضية؟' : 'Remove the current logo and revert to the default icon?'))) return;
    setLogoRemoving(true);
    try {
      await api.delete('/branding/logo');
      await reloadLogo();
      showToast(lang === 'ar' ? 'تمت إزالة الشعار' : 'Logo removed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLogoRemoving(false);
  };

  // ── اسم النظام القابل للتعديل (App Name) ────────────────────────────────
  // مسودة محلية منفصلة عن appNameAr/appNameEn (القيم المُطبَّقة فعلياً) —
  // بس تُحفَظ فعلياً لما تضغط "حفظ"، نفس نمط باقي حقول هذا التبويب (لا حفظ
  // تلقائي بمجرد الكتابة).
  const [appNameForm, setAppNameForm] = useState({ ar: '', en: '' });
  const [appNameSaving, setAppNameSaving] = useState(false);
  const [appNameResetting, setAppNameResetting] = useState(false);
  // تُهيَّأ من القيمة الحالية أول ما نفتح تبويب "اسم النظام" (لا تُعاد التهيئة
  // بعدها كل رندر، حتى ما تُمحى كتابة المستخدم وهو لسا يعدّل)
  React.useEffect(() => {
    if (tab === 'appname') setAppNameForm({ ar: appNameAr, en: appNameEn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleAppNameSave = async () => {
    // نفس نمط تحقّق حقول المنشأة (saveHospital أعلاه) — الحقلان مطلوبان معاً،
    // إلا لو كانا فارغين كلاهما (يُعامَل عندها كإعادة ضبط للاسم الافتراضي،
    // وهذا مسموح ومعالَج من الباك إند نفسه).
    const arFilled = !!appNameForm.ar.trim();
    const enFilled = !!appNameForm.en.trim();
    if (arFilled !== enFilled) { showToast(tr('msg_required'), 'error'); return; }
    setAppNameSaving(true);
    try {
      await api.put('/branding/app-name', { nameAr: appNameForm.ar, nameEn: appNameForm.en });
      await reloadAppName();
      showToast(lang === 'ar' ? 'تم حفظ اسم النظام' : 'App name saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setAppNameSaving(false);
  };

  const handleAppNameReset = async () => {
    if (!(await confirmDialog(lang === 'ar' ? 'الرجوع للاسم الافتراضي "صحتنا عراق"؟' : 'Revert to the default name "SIHATUNA IRAQ"?'))) return;
    setAppNameResetting(true);
    try {
      await api.delete('/branding/app-name');
      await reloadAppName();
      setAppNameForm({ ar: DEFAULT_APP_NAME_AR, en: DEFAULT_APP_NAME_EN });
      showToast(lang === 'ar' ? 'تمت إعادة اسم النظام للافتراضي' : 'App name reset to default', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setAppNameResetting(false);
  };

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
    { key: 'print',      labelKey: 'set_tab_print',       icon: '🖨️' },
    ...(user?.role === 'admin' ? [{ key: 'logo', labelKey: 'set_tab_logo', icon: '🖼️' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'appname', labelKey: 'set_tab_appname', icon: '🏷️' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'hospitals', labelKey: 'set_tab_hospitals', icon: '🏥' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'backups', labelKey: 'set_tab_backups', icon: '💾' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'updates', labelKey: 'set_tab_updates', icon: '🔄' }] : []),
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

  // ── نسخة احتياطية لكود المصدر ────────────────────────────────────────────
  const loadCodeBackups = async () => {
    setCodeBackupsLoading(true);
    try {
      const list = await api.get('/code-backups');
      setCodeBackups(list);
    } catch (err) {
      showToast(err.message, 'error');
    }
    setCodeBackupsLoading(false);
  };

  const runCodeBackup = async () => {
    setCodeBackupRunning(true);
    try {
      const res = await api.post('/code-backups/run');
      setCodeBackups(res.backups);
      showToast(tr('code_backup_created'), 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    setCodeBackupRunning(false);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  React.useEffect(() => {
    if (tab === 'backups') { loadBackups(); loadCodeBackups(); }
    if (tab === 'updates') loadUpdateStatus();
    if (tab === 'recycle') loadRecycleBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── نظام التحديثات (Stage 4) ─────────────────────────────────────────────
  const loadUpdateStatus = async () => {
    setUpdateStatusLoading(true);
    try {
      const status = await api.get('/git-update/status');
      setUpdateStatus(status);
      setSourceInput((prev) => (prev ? prev : status.source || ''));
    } catch (err) {
      showToast(err.message, 'error');
    }
    setUpdateStatusLoading(false);
  };

  const saveUpdateSource = async () => {
    setSavingSource(true);
    try {
      await api.put('/git-update/source', { sourcePath: sourceInput });
      showToast(tr('update_source_saved'), 'success');
      await loadUpdateStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setSavingSource(false);
  };

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    setCheckResult(null);
    try {
      const result = await api.post('/git-update/check');
      setCheckResult(result);
      showToast(result.updateAvailable ? tr('update_available') : tr('update_up_to_date'), result.updateAvailable ? 'info' : 'success');
      await loadUpdateStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setCheckingUpdate(false);
  };

  const installUpdateNow = async () => {
    if (!(await confirmDialog(tr('confirm_install_update')))) return;
    setInstallingUpdate(true);
    setInstallResult(null);
    try {
      const result = await api.post('/git-update/install');
      setInstallResult(result);
      showToast(result.alreadyUpToDate ? tr('update_up_to_date') : tr('update_installed'), 'success');
      await loadUpdateStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setInstallingUpdate(false);
  };

  const rollbackUpdate = async () => {
    if (!(await confirmDialog(tr('confirm_rollback')))) return;
    setRollingBack(true);
    try {
      await api.post('/git-update/rollback');
      showToast(tr('rollback_done'), 'success');
      setInstallResult(null);
      await loadUpdateStatus();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setRollingBack(false);
  };

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
      <PageBanner icon="⚙️" title={tr('set_title')} subtitle={tr('set_subtitle')} gradient="linear-gradient(135deg,#0f172a,#1e293b)" />

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
                      ? `كلمة مرور مؤقتة جديدة لـ"${resetPasswordResult.userName}". انسخها وأرسلها له الآن — لن تظهر مرة ثانية بعد إغلاق هذي النافذة. سيُطلب منه تغييرها بأول تسجيل دخول.`
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

          {/* ── PRINT SETTINGS TAB ── */}
          {tab === 'print' && (
            <div className="card">
              <h3 style={{ margin:'0 0 8px' }}>🖨️ {tr('set_tab_print')}</h3>
              <p style={{ margin:'0 0 20px', fontSize:13, color:'var(--text-secondary)', maxWidth:520 }}>{tr('print_settings_desc')}</p>

              <div style={{ marginBottom:24 }}>
                <h4 style={{ margin:'0 0 12px', fontSize:14 }}>{tr('print_paper_size')}</h4>
                <div style={{ display:'flex', gap:12 }}>
                  {['A4','Letter'].map(size => (
                    <button key={size} onClick={() => setPrintSettings(p => ({ ...p, paperSize: size }))} style={{ padding:'10px 22px', borderRadius:10, border:`2px solid ${printSettings.paperSize===size?'#1a6bab':'var(--border)'}`, background:printSettings.paperSize===size?'rgba(26,107,171,0.1)':'transparent', color:printSettings.paperSize===size?'#1a6bab':'var(--text-primary)', cursor:'pointer', fontSize:13, fontWeight:printSettings.paperSize===size?700:400 }}>
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:24 }}>
                <h4 style={{ margin:'0 0 12px', fontSize:14 }}>{tr('print_orientation')}</h4>
                <div style={{ display:'flex', gap:12 }}>
                  {[{ key:'portrait', label:tr('print_portrait') }, { key:'landscape', label:tr('print_landscape') }].map(o => (
                    <button key={o.key} onClick={() => setPrintSettings(p => ({ ...p, orientation: o.key }))} style={{ padding:'10px 22px', borderRadius:10, border:`2px solid ${printSettings.orientation===o.key?'#1a6bab':'var(--border)'}`, background:printSettings.orientation===o.key?'rgba(26,107,171,0.1)':'transparent', color:printSettings.orientation===o.key?'#1a6bab':'var(--text-primary)', cursor:'pointer', fontSize:13, fontWeight:printSettings.orientation===o.key?700:400 }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:24 }}>
                <h4 style={{ margin:'0 0 12px', fontSize:14 }}>{lang === 'ar' ? 'العناصر الافتراضية بكل طبعة' : 'Default elements for every print'}</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={printSettings.includeHeader} onChange={() => setPrintSettings(p => ({ ...p, includeHeader: !p.includeHeader }))} />
                    {tr('print_include_header')}
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={printSettings.includeFooter} onChange={() => setPrintSettings(p => ({ ...p, includeFooter: !p.includeFooter }))} />
                    {tr('print_include_footer')}
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={printSettings.includeLogo} onChange={() => setPrintSettings(p => ({ ...p, includeLogo: !p.includeLogo }))} />
                    {tr('print_include_logo')}
                  </label>
                  <p style={{ fontSize:11, color:'var(--text-secondary)', margin:'4px 0 0' }}>{tr('print_logo_note')}</p>
                </div>
              </div>

              <div>
                <h4 style={{ margin:'0 0 6px', fontSize:14 }}>{lang === 'ar' ? 'نص الترويسة والتذييل الافتراضي (اختياري)' : 'Default header & footer text (optional)'}</h4>
                <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 14px', maxWidth:480 }}>{tr('print_global_text_desc')}</p>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <label className="form-label">{tr('print_header_text')}</label>
                    <input
                      type="text"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      value={printSettings.headerText}
                      onChange={e => setPrintSettings(p => ({ ...p, headerText: e.target.value }))}
                      placeholder={getDefaultHeaderText(tr, appName)}
                      className="form-control"
                    />
                  </div>
                  <div>
                    <label className="form-label">{tr('print_footer_text')}</label>
                    <input
                      type="text"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      value={printSettings.footerText}
                      onChange={e => setPrintSettings(p => ({ ...p, footerText: e.target.value }))}
                      placeholder={getDefaultFooterText(lang)}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGO TAB (admin-only, same gating as hospitals/backups/recycle below) ── */}
          {tab === 'logo' && user?.role === 'admin' && (
            <div className="card">
              <h3 style={{ margin:'0 0 8px' }}>🖼️ {tr('set_tab_logo')}</h3>
              <p style={{ margin:'0 0 20px', fontSize:13, color:'var(--text-secondary)', maxWidth:520 }}>{tr('logo_section_desc')}</p>

              <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:24 }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:8 }}>{tr('logo_current_preview')}</div>
                  <div style={{ padding:14, borderRadius:12, background:'var(--bg-secondary)', border:'1px solid var(--border)', display:'inline-flex' }}>
                    <AppLogo size={72} radius={12} fontSize={34} />
                  </div>
                </div>
                {logoUrl && (
                  <button onClick={handleLogoRemove} disabled={logoRemoving} className="btn btn-outline" style={{ color:'#ef4444', borderColor:'#ef4444', alignSelf:'flex-end' }}>
                    🗑️ {logoRemoving ? (lang==='ar'?'جارٍ الإزالة...':'Removing...') : tr('logo_remove_btn')}
                  </button>
                )}
              </div>

              <div>
                <label className="form-label">{tr('logo_upload_label')}</label>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleLogoFileChange}
                  style={{ width:'100%', padding:8, borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg-primary)', color:'var(--text-primary)' }}
                />
                <p style={{ fontSize:11, color:'var(--text-secondary)', margin:'6px 0 0' }}>{tr('logo_upload_hint')}</p>
                <button
                  onClick={handleLogoUpload}
                  disabled={!logoFile || logoUploading}
                  className="btn btn-primary"
                  style={{ marginTop:12 }}
                >
                  📤 {logoUploading ? (lang==='ar'?'جارٍ الرفع...':'Uploading...') : tr('logo_upload_btn')}
                </button>
              </div>
            </div>
          )}

          {/* ── APP NAME TAB (admin-only) — moved out of the Logo tab so it's
               fully visible without scrolling; was previously a sub-section
               below the logo upload UI and got cut off below the fold. ── */}
          {tab === 'appname' && user?.role === 'admin' && (
            <div className="card">
              <h3 style={{ margin:'0 0 8px' }}>🏷️ {tr('set_tab_appname')}</h3>
              <p style={{ margin:'0 0 20px', fontSize:13, color:'var(--text-secondary)', maxWidth:480 }}>{tr('app_name_section_desc')}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:420 }}>
                <div>
                  <label className="form-label">{tr('app_name_label_ar')}</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={appNameForm.ar}
                    onChange={e => setAppNameForm(p => ({ ...p, ar: e.target.value }))}
                    placeholder={DEFAULT_APP_NAME_AR}
                    className="form-control"
                  />
                </div>
                <div>
                  <label className="form-label">{tr('app_name_label_en')}</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={appNameForm.en}
                    onChange={e => setAppNameForm(p => ({ ...p, en: e.target.value }))}
                    placeholder={DEFAULT_APP_NAME_EN}
                    className="form-control"
                  />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={handleAppNameSave} disabled={appNameSaving} className="btn btn-primary">
                    💾 {appNameSaving ? (lang==='ar'?'جارٍ الحفظ...':'Saving...') : tr('app_name_save_btn')}
                  </button>
                  <button onClick={handleAppNameReset} disabled={appNameResetting} className="btn btn-outline">
                    ↺ {appNameResetting ? (lang==='ar'?'جارٍ الإعادة...':'Resetting...') : tr('app_name_reset_btn')}
                  </button>
                </div>
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

          {/* ── CODE BACKUP (source code, separate from the data backup above) ── */}
          {tab === 'backups' && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                <div>
                  <h3 style={{ margin:'0 0 6px' }}>🗂️ {tr('code_backup_title')}</h3>
                  <p style={{ margin:0, fontSize:13, color:'var(--text-secondary)', maxWidth:520 }}>{tr('code_backup_desc')}</p>
                </div>
                <button
                  onClick={runCodeBackup}
                  disabled={codeBackupRunning}
                  className="btn btn-primary"
                  style={{ whiteSpace:'nowrap' }}
                >
                  {codeBackupRunning ? `⏳ ${tr('code_backup_running')}` : `🗂️ ${tr('btn_code_backup_now')}`}
                </button>
              </div>

              {codeBackupsLoading ? (
                <p style={{ color:'var(--text-secondary)' }}>...</p>
              ) : codeBackups.length === 0 ? (
                <p style={{ color:'var(--text-secondary)' }}>{tr('no_code_backups_yet')}</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto' }}>
                  {codeBackups.map(b => (
                    <div key={b.name} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8,
                      padding:'10px 14px', borderRadius:8, background:'var(--bg-card)',
                    }}>
                      <span style={{ fontSize:13, fontFamily:'monospace' }}>
                        📦 {b.name}
                        <span style={{ marginInlineStart:10, color:'var(--text-secondary)', fontSize:12 }}>
                          {formatBytes(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-US')}
                        </span>
                      </span>
                      <a
                        href={`${SERVER_BASE_URL}/api/code-backups/${b.name}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline"
                        style={{ fontSize:12, padding:'6px 12px', textDecoration:'none' }}
                      >
                        ⬇️ {tr('btn_download')}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── UPDATES TAB (Stage 4: git-based differential update) ── */}
          {tab === 'updates' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="card">
                <h3 style={{ margin:'0 0 6px' }}>🔄 {tr('set_tab_updates')}</h3>
                <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--text-secondary)', maxWidth:560 }}>{tr('update_source_desc')}</p>

                <label className="form-label">{tr('update_source_label')}</label>
                <input
                  type="text"
                  dir="ltr"
                  className="form-control"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder="E:\sihatuna-updates.git  |  \\SERVER\share\sihatuna-updates.git  |  https://github.com/..."
                  style={{ marginBottom:8 }}
                />
                <p style={{ margin:'0 0 12px', fontSize:12, color:'var(--text-secondary)' }}>{tr('update_source_hint')}</p>
                <button onClick={saveUpdateSource} disabled={savingSource || !sourceInput.trim()} className="btn btn-primary" style={{ fontSize:13 }}>
                  {savingSource ? '⏳' : '💾'} {tr('btn_save_source')}
                </button>

                <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', flexWrap:'wrap', gap:24 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{tr('update_current_version')}</div>
                    <div style={{ fontSize:13, fontFamily:'monospace' }}>
                      {updateStatusLoading ? '...' : updateStatus ? `${updateStatus.currentBranch}@${updateStatus.currentCommit?.slice(0, 7)}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{tr('update_source_configured')}</div>
                    <div style={{ fontSize:13, fontFamily:'monospace', wordBreak:'break-all', maxWidth:320 }}>
                      {updateStatusLoading ? '...' : (updateStatus?.source || tr('update_no_source_configured'))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{tr('update_last_checked')}</div>
                    <div style={{ fontSize:13 }}>
                      {updateStatusLoading ? '...' : (updateStatus?.lastCheck?.checkedAt ? new Date(updateStatus.lastCheck.checkedAt).toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-US') : tr('update_never_checked'))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:12 }}>
                  <h3 style={{ margin:0 }}>{tr('update_check_title')}</h3>
                  <button onClick={checkForUpdate} disabled={checkingUpdate || !updateStatus?.source} className="btn btn-outline">
                    {checkingUpdate ? `⏳ ${tr('checking_updates')}` : `🔍 ${tr('btn_check_updates')}`}
                  </button>
                </div>

                {checkResult && (
                  <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary)' }}>
                    {checkResult.updateAvailable ? (
                      <>
                        <div style={{ fontWeight:600, marginBottom:8 }}>
                          🆕 {tr('update_available')} — {checkResult.commitsBehind} {tr('update_commits_suffix')}
                        </div>
                        {checkResult.changelog.length > 0 && (
                          <ul style={{ margin:0, paddingInlineStart:20, fontSize:13, fontFamily:'monospace' }}>
                            {checkResult.changelog.map((line, i) => <li key={i} style={{ marginBottom:4 }}>{line}</li>)}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div>✅ {tr('update_up_to_date')}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:12 }}>
                  <div>
                    <h3 style={{ margin:'0 0 6px' }}>{tr('update_install_title')}</h3>
                    <p style={{ margin:0, fontSize:13, color:'var(--text-secondary)', maxWidth:520 }}>{tr('update_install_desc')}</p>
                  </div>
                  <button onClick={installUpdateNow} disabled={installingUpdate || !updateStatus?.source} className="btn btn-primary" style={{ whiteSpace:'nowrap' }}>
                    {installingUpdate ? `⏳ ${tr('installing_update')}` : `⬇️ ${tr('btn_install_update')}`}
                  </button>
                </div>

                {installResult && !installResult.alreadyUpToDate && (
                  <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary)', fontSize:13 }}>
                    <div style={{ marginBottom:6 }}>
                      <strong>{tr('update_current_version')}:</strong>{' '}
                      <span style={{ fontFamily:'monospace' }}>{installResult.beforeCommit?.slice(0,7)} → {installResult.afterCommit?.slice(0,7)}</span>
                    </div>
                    <div style={{ marginBottom:6 }}>
                      <strong>{tr('update_files_changed')}:</strong> {installResult.filesChanged.length}
                    </div>
                    {(installResult.npmInstallRan?.backend || installResult.npmInstallRan?.frontend) && (
                      <div>
                        <strong>npm install:</strong>{' '}
                        {[installResult.npmInstallRan.backend && 'backend', installResult.npmInstallRan.frontend && 'frontend'].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {updateStatus?.lastInstall?.beforeCommit && (
                <div className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                    <div>
                      <h3 style={{ margin:'0 0 6px' }}>{tr('update_rollback_title')}</h3>
                      <p style={{ margin:0, fontSize:13, color:'var(--text-secondary)' }}>
                        {tr('update_rollback_desc')} <span style={{ fontFamily:'monospace' }}>{updateStatus.lastInstall.beforeCommit.slice(0,7)}</span>
                      </p>
                    </div>
                    <button onClick={rollbackUpdate} disabled={rollingBack} className="btn btn-danger" style={{ whiteSpace:'nowrap' }}>
                      {rollingBack ? '⏳' : '⏪'} {tr('btn_rollback')}
                    </button>
                  </div>
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
                <h2 style={{ margin:'0 0 6px', fontSize:24 }}>{appNameEn.toUpperCase()}</h2>
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
