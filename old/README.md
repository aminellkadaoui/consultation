# Amine Editing Team — Website

موقع بورتفوليو ثابت (HTML/CSS/JS) — كل المحتوى يُتحكَّم فيه من ملف واحد.

## الملفات
| الملف | الوظيفة |
| --- | --- |
| `index.html` | الموقع نفسه (يقرأ المحتوى من `config.js`) |
| `config.js` | **كل المحتوى**: العناوين، رابط Book A Call، الريلز، المشاهدات |
| `admin.html` | لوحة التحكم — عدّل بصرياً وصدّر `config.js` جديد |
| `fonts/` | خطوط Satoshi + Instrument Serif (محلية) |

## كيف تعدّل المحتوى
**النشر المباشر (الأسهل):** افتح `admin.html` على موقعك → عدّل → اضغط **🚀 نشر مباشرة** → يتحدّث الموقع خلال دقيقة. (يتطلب ضبط اتصال GitHub مرّة واحدة — انظر الأسفل.)
**معاينة:** زر **👁 معاينة** يفتح الموقع بتعديلاتك محلياً قبل النشر.
**الطريقة اليدوية:** افتح `config.js` وعدّل القيم مباشرة.

## إعداد النشر المباشر (مرّة واحدة)
حتى يعمل زر **🚀 نشر مباشرة**، تحتاج توكن GitHub:
1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** Only select repositories → اختر ريبو هذا الموقع.
3. **Permissions → Repository permissions → Contents:** `Read and write` (هذه فقط).
4. انسخ التوكن (`github_pat_...`).
5. في `admin.html` → القسم **0 (النشر المباشر)** → املأ: اسم المستخدم، اسم الريبو، الفرع (`main`)، والتوكن → **💾 حفظ**.
6. من الآن: كل تعديل + **🚀 نشر مباشرة** = يظهر على الموقع مباشرة.

> 🔐 التوكن يُحفظ في متصفحك فقط (localStorage) ولا يُرفع مع صفحات الموقع.

## المعاينة محلياً
شغّل خادماً بسيطاً داخل المجلد (لأن الخطوط لا تُحمّل من `file://`):
```
python -m http.server 8080
```
ثم افتح: `http://localhost:8080/`

## الرفع على GitHub Pages
1. أنشئ ريبو جديداً على github.com (مثلاً `amine-editing-site`).
2. من داخل مجلد الموقع نفّذ:
```
git remote add origin https://github.com/USERNAME/amine-editing-site.git
git branch -M main
git push -u origin main
```
3. في الريبو: **Settings → Pages → Branch: `main` / root → Save**.
4. بعد دقيقة يكون الموقع على: `https://USERNAME.github.io/amine-editing-site/`

> بديل أسهل للتحديث المستمر: اربط الريبو بـ **Netlify** أو **Cloudflare Pages** — كل `git push` ينشر تلقائياً.

## نطاق مخصّص
في GitHub Pages → Custom domain، أو من إعدادات Netlify/Cloudflare.
