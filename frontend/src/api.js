// frontend/src/api.js
// نقطة اتصال مركزية واحدة بالباك إند الحقيقي (Node.js/Express + JWT)
// كل الموديولات المستقبلية اللي نربطها بالباك إند تمر من هنا

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
// إصلاح: روابط الملفات المرفوعة (مثل مستندات الإضابير) كانت تُستخدَم كما هي
// (مسار نسبي مثل /uploads/xyz.pdf) بعنصر <a href> مباشرة — بما إن الفرونت
// إند والباك إند يشتغلون على منفذين مختلفين (3000 و8000)، هذا يفتح
// localhost:3000/uploads/... (غير موجود بالفرونت إند، فيرجّعك الموجّه
// [React Router] للصفحة الرئيسية بصمت) بدل الملف الفعلي على الباك إند.
export const SERVER_BASE_URL = API_BASE_URL.replace('/api', '');
// Constant URL that always serves whichever logo is currently uploaded (see
// backend/routes/brandingRoutes.js) — deliberately public/no-auth so it can
// render on the login page and the print header. Callers append a cache-bust
// query param (e.g. `?v=${updatedAt}`) so replacing the logo doesn't keep
// showing a stale cached image.
export const LOGO_IMAGE_URL = `${SERVER_BASE_URL}/api/branding/logo`;

// ── إصلاح أمني ────────────────────────────────────────────────────────────────
// كان التوكن يُقرأ من localStorage ويُرسَل يدوياً بـ Authorization header —
// أي كود جافاسكربت يشتغل بالصفحة (حتى عبر ثغرة XSS مستقبلية) كان يقدر يقرأ
// التوكن مباشرة من localStorage ويسرقه. الآن الخادم يضبط التوكن بـ httpOnly
// cookie (كود الجافاسكربت لا يقدر يقرأها إطلاقاً)، والمتصفح يرسلها تلقائياً
// مع كل طلب طالما مررنا credentials:'include' — بدون أي حاجة لقراءة أو
// تخزين التوكن يدوياً هنا نهائياً.
async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' });

  let data = null;
  try { data = await response.json(); } catch { /* استجابة بدون محتوى JSON */ }

  if (!response.ok) {
    // أخطاء التحقق من صحة المدخلات (400) تُعيد مصفوفة "errors" مفصّلة (مثل
    // "الحقل رقم الهاتف مطلوب") — ندمجها برسالة واحدة واضحة بدل رسالة عامة
    // ("بيانات غير صالحة") لا تشرح للمستخدم شنو بالضبط يحتاج يصحّح.
    const detailedMessage = Array.isArray(data?.errors) && data.errors.length > 0
      ? data.errors.join('، ')
      : (data?.message || `خطأ بالاتصال بالخادم (${response.status})`);
    const err = new Error(detailedMessage);
    err.status = response.status; // يتيح للمستدعي (مثل syncToServer) تمييز 401/400 عن باقي الأخطاء
    err.errors = data?.errors || null;
    throw err;
  }
  return data;
}

export const api = {
  get:    (path)         => apiRequest(path, { method: 'GET' }),
  post:   (path, body)   => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    (path, body)   => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch:  (path, body)   => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path)         => apiRequest(path, { method: 'DELETE' }),
};

// رفع ملف (multipart/form-data) — يُستخدم لاستيراد Excel وأي رفع ملفات مستقبلي.
// لا نمرر 'Content-Type' يدوياً هنا عمداً: المتصفح يحدّده تلقائياً مع الـ
// boundary الصحيح عند استخدام FormData، وتحديده يدوياً بالخطأ يكسر الطلب.
// extraFields: حقول نصية إضافية تُرسَل جنب الملف بنفس الطلب (مثل عنوان
// الوثيقة أو نوعها) — تصل للباك إند عبر req.body تلقائياً بفضل multer.
export async function apiUploadFile(path, file, extraFields = {}) {
  const formData = new FormData();
  if (file) formData.append('file', file);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  let data = null;
  try { data = await response.json(); } catch { /* استجابة بدون محتوى JSON */ }
  if (!response.ok) {
    const err = new Error(data?.message || `خطأ بالاتصال بالخادم (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

// تحميل ملف من الخادم (مثل قالب Excel) وتنزيله مباشرة بالمتصفح
export async function apiDownloadFile(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch { /* لا محتوى */ }
    throw new Error(data?.message || `تعذّر تحميل الملف (${response.status})`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// يتحقق هل الباك إند شغّال قبل أي محاولة اتصال (يفيد بعرض رسالة واضحة للمستخدم)
export async function checkBackendReachable() {
  try {
    const res = await fetch(`${API_BASE_URL.replace('/api', '')}/`, { method: 'GET' });
    return res.ok || res.status === 404; // أي رد يعني السيرفر شغّال
  } catch {
    return false;
  }
}

export default api;
